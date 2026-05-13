"use client";

import { useState } from "react";

/**
 * Inline approve/deny pair for the launch dashboard's recent submissions
 * list. Uses the same /api/moderation/{approve,deny} endpoints as the
 * messages list. After a successful action the row visually marks itself
 * — the dashboard auto-refreshes every 60s, so the message will drop off
 * the pending list on the next render.
 */
interface Props {
  messageId: string;
}

export function LaunchInline({ messageId }: Props) {
  const [state, setState] = useState<
    "idle" | "approving" | "denying" | "approved" | "denied" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function call(action: "approve" | "deny") {
    setState(action === "approve" ? "approving" : "denying");
    setError(null);
    try {
      const res = await fetch(`/api/moderation/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body?.error ?? `HTTP ${res.status}`);
        setState("error");
        return;
      }
      setState(action === "approve" ? "approved" : "denied");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  if (state === "approved") {
    return <span className="launch__inline launch__inline--ok">approved</span>;
  }
  if (state === "denied") {
    return <span className="launch__inline launch__inline--ok">denied</span>;
  }

  const busy = state === "approving" || state === "denying";

  return (
    <div className="launch__inline">
      <button
        type="button"
        onClick={() => void call("approve")}
        disabled={busy}
        aria-label="approve"
      >
        a
      </button>
      <button
        type="button"
        onClick={() => void call("deny")}
        disabled={busy}
        aria-label="deny"
      >
        d
      </button>
      {error && (
        <span className="launch__inline-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
