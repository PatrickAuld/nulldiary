"use client";

import type { Message } from "@nulldiary/db";
import { useMemo, useState } from "react";

type RowState = {
  editedContent: string;
  status: "idle" | "loading" | "error";
  error?: string;
};

export function MessageList({ messages }: { messages: Message[] }) {
  const initialState = useMemo(() => {
    const map: Record<string, RowState> = {};
    for (const msg of messages) {
      const edited =
        // message.edited_content exists on some branches; fall back to content.
        ("edited_content" in msg &&
        typeof (msg as { edited_content?: unknown }).edited_content === "string"
          ? (msg as { edited_content: string }).edited_content
          : null) ?? msg.content;
      map[msg.id] = {
        editedContent: edited,
        status: "idle",
      };
    }
    return map;
  }, [messages]);

  const [rows, setRows] = useState<Record<string, RowState>>(initialState);

  if (messages.length === 0) {
    return <p>No messages found.</p>;
  }

  async function moderate(
    action: "approve" | "deny",
    messageId: string,
  ): Promise<void> {
    setRows((prev) => ({
      ...prev,
      [messageId]: { ...prev[messageId], status: "loading", error: undefined },
    }));

    try {
      const payload: { messageId: string; editedContent?: string } = {
        messageId,
      };
      if (action === "approve") {
        payload.editedContent =
          rows[messageId]?.editedContent?.trim() || undefined;
      }

      const res = await fetch(`/api/moderation/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        window.location.reload();
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

  return (
    <div className="table-wrap">
      <table className="messages-table">
        <thead>
          <tr>
            <th>Content</th>
            <th>Edited</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((msg) => {
            const row = rows[msg.id] ?? {
              editedContent: msg.content,
              status: "idle" as const,
            };
            const isLoading = row.status === "loading";

            return (
              <tr key={msg.id}>
                <td>
                  {msg.content.length > 100
                    ? msg.content.slice(0, 100) + "..."
                    : msg.content}
                </td>
                <td style={{ minWidth: 320 }}>
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
                    rows={3}
                    style={{ width: "100%" }}
                    placeholder="Edited content used for approval"
                  />
                </td>
                <td>
                  <span
                    className="status-badge"
                    data-status={msg.moderation_status}
                  >
                    {msg.moderation_status}
                  </span>
                </td>
                <td>{new Date(msg.created_at).toLocaleString()}</td>
                <td>
                  <details>
                    <summary style={{ cursor: "pointer" }}>Actions</summary>
                    <div
                      style={{ display: "flex", gap: "0.5rem", paddingTop: 8 }}
                    >
                      <a href={`/messages/${msg.id}`}>View</a>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => moderate("approve", msg.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => moderate("deny", msg.id)}
                      >
                        Deny
                      </button>
                    </div>
                    {row.status === "error" && (
                      <p className="error" style={{ marginTop: 8 }}>
                        {row.error}
                      </p>
                    )}
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
