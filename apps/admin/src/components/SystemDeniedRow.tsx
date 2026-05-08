"use client";

import type { Message } from "@nulldiary/db";
import { useState } from "react";

export function SystemDeniedRow({ message }: { message: Message }) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "overridden" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function override() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/moderation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id, override: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setStatus("overridden");
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  const truncated =
    message.content.length > 200
      ? `${message.content.slice(0, 200)}…`
      : message.content;

  return (
    <li className="system-denied-row" data-status={status}>
      <header className="system-denied-row__header">
        <span className="status-badge" data-status="auto-denied">
          {message.auto_action_reason ?? "auto-deny"}
        </span>
        {typeof message.risk_score === "number" ? (
          <span className="message-card__risk">
            risk {message.risk_score.toFixed(2)}
          </span>
        ) : null}
        <span className="message-card__created">
          {message.denied_at
            ? new Date(message.denied_at).toLocaleString()
            : ""}
        </span>
      </header>

      <p className="system-denied-row__content">{truncated}</p>

      {message.risk_labels && message.risk_labels.length > 0 ? (
        <div className="message-card__labels">
          {message.risk_labels.map((lbl) => (
            <span key={lbl.category} className="message-card__label">
              {lbl.category}·{lbl.score.toFixed(2)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="system-denied-row__actions">
        {status === "overridden" ? (
          <span>Overridden — message is now approved.</span>
        ) : (
          <button
            type="button"
            onClick={override}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Overriding…" : "Override (re-approve)"}
          </button>
        )}
        {status === "error" && error ? (
          <span className="system-denied-row__error">{error}</span>
        ) : null}
      </div>
    </li>
  );
}
