"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Message } from "@nulldiary/db";

interface UndoEntry {
  messageId: string;
  action: "approved" | "denied";
  /** Index in the original list, used to restore cursor position. */
  position: number;
}

interface Props {
  batch: string;
  initialMessages: Message[];
}

const UNDO_STACK_LIMIT = 10;

type Mode = "review" | "help" | "bulk-deny-confirm";

interface SeedMetadata {
  batch?: string;
  run?: string;
  model?: string;
  skill_version?: string;
  prompt_id?: string;
}

function readSeedMetadata(message: Message): SeedMetadata {
  const seed = (message.metadata as { seed?: unknown })?.seed;
  if (!seed || typeof seed !== "object") return {};
  return seed as SeedMetadata;
}

export function SeedReviewClient({ batch, initialMessages }: Props) {
  const [pending, setPending] = useState<Message[]>(initialMessages);
  const [decided, setDecided] = useState<Map<string, Message>>(new Map());
  const [cursor, setCursor] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [mode, setMode] = useState<Mode>("review");
  const [bulkDenyInput, setBulkDenyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const current: Message | undefined = pending[cursor];
  const remaining = pending.length;

  const moveNext = useCallback(() => {
    setCursor((c) => Math.min(c + 1, Math.max(0, pending.length - 1)));
  }, [pending.length]);

  const movePrev = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack((s) => {
      const next = [...s, entry];
      if (next.length > UNDO_STACK_LIMIT) next.shift();
      return next;
    });
  }, []);

  const decide = useCallback(
    async (action: "approve" | "deny") => {
      if (!current || busy) return;
      setBusy(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/moderation/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: current.id }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setErrorMessage(body?.error ?? `Request failed (${res.status})`);
          return;
        }
        const newStatus = action === "approve" ? "approved" : "denied";
        const decidedMessage = { ...current, moderation_status: newStatus };
        setDecided((d) =>
          new Map(d).set(current.id, decidedMessage as Message),
        );
        pushUndo({
          messageId: current.id,
          action: newStatus,
          position: cursor,
        });
        setPending((p) => p.filter((m) => m.id !== current.id));
        // After removing the current item, cursor naturally points to the next.
        // Clamp it so we don't run past the end.
        setCursor((c) => Math.min(c, Math.max(0, pending.length - 2)));
        setStatusMessage(`${newStatus}: ${current.id.slice(0, 8)}…`);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, cursor, pending.length, pushUndo],
  );

  const undoLast = useCallback(async () => {
    if (busy) return;
    const last = undoStack[undoStack.length - 1];
    if (!last) {
      setStatusMessage("Nothing to undo.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/moderation/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: last.messageId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(body?.error ?? `Undo failed (${res.status})`);
        return;
      }
      const reverted = decided.get(last.messageId);
      if (reverted) {
        const restored = {
          ...reverted,
          moderation_status: "pending",
        } as Message;
        setPending((p) => {
          const insertAt = Math.min(last.position, p.length);
          const next = [...p];
          next.splice(insertAt, 0, restored);
          return next;
        });
        setDecided((d) => {
          const next = new Map(d);
          next.delete(last.messageId);
          return next;
        });
        setCursor(last.position);
      }
      setUndoStack((s) => s.slice(0, -1));
      setStatusMessage(`undo: ${last.messageId.slice(0, 8)}…`);
    } finally {
      setBusy(false);
    }
  }, [busy, undoStack, decided]);

  const bulkDenyAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErrorMessage(null);
    let denied = 0;
    let failed = 0;
    try {
      // Sequential to avoid hammering the API and to keep error reporting simple.
      for (const m of pending) {
        const res = await fetch(`/api/moderation/deny`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: m.id,
            reason: "bulk-deny via seed-review",
          }),
        });
        if (res.ok) denied++;
        else failed++;
      }
    } finally {
      setBusy(false);
    }
    // Bulk deny intentionally clears local pending; undo for bulk is not supported.
    setPending([]);
    setUndoStack([]);
    setMode("review");
    setBulkDenyInput("");
    setCursor(0);
    setStatusMessage(
      `bulk-denied ${denied}${failed ? `, ${failed} failed` : ""}`,
    );
  }, [busy, pending]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't intercept when user is typing in an input/textarea (e.g.,
      // bulk-deny confirm input).
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (mode === "help") {
        if (e.key === "?" || e.key === "Escape") {
          setMode("review");
          e.preventDefault();
        }
        return;
      }
      if (mode === "bulk-deny-confirm") {
        if (e.key === "Escape") {
          setMode("review");
          setBulkDenyInput("");
          e.preventDefault();
        }
        return;
      }
      switch (e.key) {
        case "j":
          moveNext();
          e.preventDefault();
          break;
        case "k":
          movePrev();
          e.preventDefault();
          break;
        case "a":
          void decide("approve");
          e.preventDefault();
          break;
        case "d":
          void decide("deny");
          e.preventDefault();
          break;
        case "D":
          if (pending.length > 0) {
            setMode("bulk-deny-confirm");
            setBulkDenyInput("");
          }
          e.preventDefault();
          break;
        case "u":
          void undoLast();
          e.preventDefault();
          break;
        case "?":
          setMode("help");
          e.preventDefault();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, moveNext, movePrev, decide, undoLast, pending.length]);

  const seed = current ? readSeedMetadata(current) : ({} as SeedMetadata);
  const totalDecided = decided.size;
  const totalOriginal = useMemo(
    () => initialMessages.length,
    [initialMessages.length],
  );

  return (
    <div className="seed-review">
      <header className="seed-review__header">
        <div>
          <h1>Seed review</h1>
          <p className="seed-review__batch">
            batch <code>{batch}</code> · {remaining} pending · {totalDecided}{" "}
            decided this session ·{" "}
            <span title="undo stack depth">{undoStack.length} undoable</span> of{" "}
            {totalOriginal} loaded
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "help" ? "review" : "help"))}
          >
            help (?)
          </button>
        </div>
      </header>

      {mode === "help" && <HelpOverlay onClose={() => setMode("review")} />}

      {mode === "bulk-deny-confirm" && (
        <BulkDenyConfirm
          remaining={remaining}
          input={bulkDenyInput}
          setInput={setBulkDenyInput}
          onConfirm={bulkDenyAll}
          onCancel={() => {
            setMode("review");
            setBulkDenyInput("");
          }}
          busy={busy}
        />
      )}

      {!current && pending.length === 0 && (
        <div className="seed-review__done">
          <h2>Done.</h2>
          <p>
            All {totalOriginal} messages in this batch were processed in this
            session. Reload to fetch the next pending batch, or visit{" "}
            <a href="/messages">/messages</a>.
          </p>
        </div>
      )}

      {current && (
        <main className="seed-review__card">
          <dl className="seed-review__meta">
            <div>
              <dt>model</dt>
              <dd>{seed.model ?? "—"}</dd>
            </div>
            <div>
              <dt>run</dt>
              <dd>{seed.run ?? "—"}</dd>
            </div>
            <div>
              <dt>batch</dt>
              <dd>{seed.batch ?? "—"}</dd>
            </div>
            <div>
              <dt>skill</dt>
              <dd>{seed.skill_version ?? "—"}</dd>
            </div>
            {seed.prompt_id && (
              <div>
                <dt>prompt</dt>
                <dd>{seed.prompt_id}</dd>
              </div>
            )}
            <div>
              <dt>id</dt>
              <dd>
                <a
                  href={`/messages/${current.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {current.id.slice(0, 8)}…
                </a>
              </dd>
            </div>
          </dl>

          <article className="seed-review__content">{current.content}</article>

          <div className="seed-review__cursor">
            {cursor + 1} / {pending.length}
          </div>
        </main>
      )}

      <footer className="seed-review__footer" aria-live="polite">
        {errorMessage && (
          <span className="seed-review__error">{errorMessage}</span>
        )}
        {!errorMessage && statusMessage && (
          <span className="seed-review__status">{statusMessage}</span>
        )}
        {!errorMessage && !statusMessage && (
          <span className="seed-review__hint">
            j/k = next/prev · a = approve · d = deny · D = bulk deny · u = undo
            · ? = help
          </span>
        )}
      </footer>
    </div>
  );
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="seed-review__overlay" role="dialog" aria-modal="true">
      <div className="seed-review__overlay-card">
        <h2>Keyboard shortcuts</h2>
        <table className="seed-review__shortcuts">
          <tbody>
            <tr>
              <td>
                <kbd>j</kbd>
              </td>
              <td>next pending message</td>
            </tr>
            <tr>
              <td>
                <kbd>k</kbd>
              </td>
              <td>previous pending message</td>
            </tr>
            <tr>
              <td>
                <kbd>a</kbd>
              </td>
              <td>approve current message</td>
            </tr>
            <tr>
              <td>
                <kbd>d</kbd>
              </td>
              <td>deny current message</td>
            </tr>
            <tr>
              <td>
                <kbd>D</kbd>
              </td>
              <td>
                bulk-deny ALL remaining pending in this batch (with confirm)
              </td>
            </tr>
            <tr>
              <td>
                <kbd>u</kbd>
              </td>
              <td>undo last action (up to 10 deep, this session only)</td>
            </tr>
            <tr>
              <td>
                <kbd>?</kbd>
              </td>
              <td>toggle this help</td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>
    </div>
  );
}

function BulkDenyConfirm({
  remaining,
  input,
  setInput,
  onConfirm,
  onCancel,
  busy,
}: {
  remaining: number;
  input: string;
  setInput: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const armed = input.trim().toLowerCase() === "deny";
  return (
    <div className="seed-review__overlay" role="dialog" aria-modal="true">
      <div className="seed-review__overlay-card">
        <h2>
          Bulk-deny {remaining} message{remaining === 1 ? "" : "s"}?
        </h2>
        <p>
          This will deny every remaining pending message in the current batch.
          Bulk denials are NOT undoable from this page. Type <code>deny</code>{" "}
          below to confirm, or press Escape to cancel.
        </p>
        <input
          type="text"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="type deny to confirm"
          aria-label="confirmation"
        />
        <div className="seed-review__overlay-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!armed || busy}
            data-action="bulk-deny"
          >
            {busy ? "denying…" : "confirm bulk deny"}
          </button>
        </div>
      </div>
    </div>
  );
}
