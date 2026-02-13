"use client";

import type { Message } from "@nulldiary/db";
import { useMemo, useState } from "react";
import { FeaturedSetsPicker } from "@/components/FeaturedSetsPicker";

type RowState = {
  editedContent: string;
  status: "idle" | "loading" | "error";
  error?: string;
};

export function MessageList({
  messages,
  featuredSets,
  featuredMemberships,
}: {
  messages: Message[];
  featuredSets: import("@/data/featured").FeaturedSetRow[];
  featuredMemberships: Record<string, string[]>;
}) {
  const initialState = useMemo(() => {
    const map: Record<string, RowState> = {};
    for (const msg of messages) {
      const editedRaw =
        // message.edited_content exists on some branches; fall back to content.
        "edited_content" in msg &&
        typeof (msg as { edited_content?: unknown }).edited_content === "string"
          ? (msg as { edited_content: string }).edited_content
          : null;

      const edited =
        editedRaw && editedRaw.trim().length > 0 ? editedRaw : msg.content;

      map[msg.id] = {
        editedContent: edited,
        status: "idle",
      };
    }
    return map;
  }, [messages]);

  const [rows, setRows] = useState<Record<string, RowState>>(initialState);
  const [approveAddSet, setApproveAddSet] = useState<Record<string, string>>(
    {},
  );
  const [autoApproveAddSetId, setAutoApproveAddSetId] = useState("");

  if (messages.length === 0) {
    return <p>No messages found.</p>;
  }

  async function moderate(
    action: "approve" | "deny" | "edit",
    messageId: string,
    opts: { reload?: boolean } = {},
  ): Promise<void> {
    setRows((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], status: "loading", error: undefined },
    }));

    try {
      const payload: { messageId: string; editedContent?: string | null } = {
        messageId,
      };

      if (action === "approve") {
        payload.editedContent =
          rows[messageId]?.editedContent?.trim() || undefined;
      }

      if (action === "edit") {
        payload.editedContent = rows[messageId]?.editedContent?.trim() || null;
      }

      const endpoint =
        action === "edit" ? "/api/messages/edit" : `/api/moderation/${action}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (opts.reload ?? true) {
          window.location.reload();
        }
        return;
      }

      let body: { error?: string } | null = null;
      try {
        body = (await res.json()) as { error?: string };
      } catch {
        // ignore
      }

      setRows((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          status: "error",
          error: body?.error ?? `Request failed (${res.status})`,
        },
      }));
    } catch (err) {
      setRows((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          status: "error",
          error: err instanceof Error ? err.message : "Network error",
        },
      }));
    }
  }

  async function addToFeaturedSet(messageId: string, setId: string) {
    const res = await fetch("/api/featured/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "add", messageId, setId }),
    });

    if (!res.ok) {
      let body: { error?: string } | null = null;
      try {
        body = (await res.json()) as { error?: string };
      } catch {
        // ignore
      }

      throw new Error(
        body?.error ?? `Failed to add to featured set (${res.status})`,
      );
    }
  }

  async function approveAndMaybeFeature(messageId: string) {
    await moderate("approve", messageId, { reload: false });

    const setId = approveAddSet[messageId] || autoApproveAddSetId;
    if (setId) {
      await addToFeaturedSet(messageId, setId);
    }

    window.location.reload();
  }

  return (
    <div className="message-cards">
      <div className="message-cards__toolbar">
        <label>
          Auto-add approved messages to featured set (optional)
          <select
            value={autoApproveAddSetId}
            onChange={(e) => setAutoApproveAddSetId(e.target.value)}
          >
            <option value="">—</option>
            {featuredSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.title ?? set.slug}
              </option>
            ))}
          </select>
        </label>
      </div>

      {messages.map((msg) => {
        const row = rows[msg.id] ?? {
          editedContent:
            "edited_content" in msg &&
            typeof (msg as { edited_content?: unknown }).edited_content ===
              "string" &&
            (msg as { edited_content: string }).edited_content.trim().length > 0
              ? (msg as { edited_content: string }).edited_content
              : msg.content,
          status: "idle" as const,
        };
        const isLoading = row.status === "loading";

        return (
          <article key={msg.id} className="message-card">
            <header className="message-card__header">
              <span
                className="status-badge"
                data-status={msg.moderation_status}
              >
                {msg.moderation_status}
              </span>
              <span className="message-card__created">
                {new Date(msg.created_at).toLocaleString()}
              </span>
              <a className="message-card__view" href={`/messages/${msg.id}`}>
                View
              </a>
            </header>

            <div className="message-card__box">
              <div className="message-card__box-title">Original message</div>
              <p className="message-card__content">{msg.content}</p>
            </div>

            <div className="message-card__box">
              <div className="message-card__box-title">
                What will be shown
                {msg.moderation_status === "approved" ? " (approved)" : ""}
              </div>
              <p className="message-card__content">{row.editedContent}</p>
            </div>

            <details className="message-card__edit">
              <summary>Edit what will be shown</summary>
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={row.editedContent}
                  onChange={(e) =>
                    setRows((prev) => ({
                      ...prev,
                      [msg.id]: {
                        ...prev[msg.id],
                        editedContent: e.target.value,
                      },
                    }))
                  }
                  rows={5}
                  placeholder="The version that will be shown publicly"
                />
                <div className="message-card__actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => moderate("edit", msg.id)}
                  >
                    Save edit
                  </button>
                </div>
              </div>
            </details>

            {msg.moderation_status === "approved" ? (
              <details className="message-card__featured">
                <summary>Featured sets</summary>
                <div style={{ marginTop: 8 }}>
                  <FeaturedSetsPicker
                    messageId={msg.id}
                    sets={featuredSets}
                    selectedSetIds={featuredMemberships[msg.id] ?? []}
                  />
                </div>
              </details>
            ) : (
              <div className="message-card__quick-feature">
                <label>
                  Add to featured set on approve (optional)
                  <select
                    value={approveAddSet[msg.id] ?? ""}
                    onChange={(e) =>
                      setApproveAddSet((prev) => ({
                        ...prev,
                        [msg.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {featuredSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.title ?? set.slug}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="message-card__actions">
              <button
                type="button"
                disabled={isLoading || msg.moderation_status !== "pending"}
                onClick={() => approveAndMaybeFeature(msg.id)}
                data-action="approve"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={isLoading || msg.moderation_status === "denied"}
                onClick={() => moderate("deny", msg.id)}
                data-action="deny"
              >
                Deny
              </button>
            </div>

            {row.status === "error" && <p className="error">{row.error}</p>}
          </article>
        );
      })}
    </div>
  );
}
