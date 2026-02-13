"use client";

import { useState } from "react";

export function ModerationForm({
  messageId,
  defaultEditedContent,
  canApprove,
  canDeny,
}: {
  messageId: string;
  defaultEditedContent: string;
  canApprove?: boolean;
  canDeny?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [editedContent, setEditedContent] = useState(defaultEditedContent);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAction(action: "approve" | "deny" | "edit") {
    setStatus("loading");
    setErrorMessage("");

    try {
      const endpoint =
        action === "edit" ? "/api/messages/edit" : `/api/moderation/${action}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          ...(action === "approve"
            ? {
                reason: reason.trim() || undefined,
                editedContent: editedContent.trim() || undefined,
              }
            : action === "deny"
              ? { reason: reason.trim() || undefined }
              : { editedContent: editedContent.trim() || null }),
        }),
      });

      if (res.ok) {
        setStatus("success");
        window.location.reload();
        return;
      }

      let body: { error?: string } | null = null;
      try {
        body = (await res.json()) as { error?: string };
      } catch {
        // If the server returns HTML/plaintext, avoid leaving the UI stuck.
      }

      setErrorMessage(body?.error ?? `Request failed (${res.status})`);
      setStatus("error");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error while moderating",
      );
      setStatus("error");
    }
  }

  return (
    <div className="detail-section">
      <h2>Moderate</h2>
      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="editedContent">Edited content</label>
        <textarea
          id="editedContent"
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          placeholder="The version that will be shown publicly"
          rows={6}
        />
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="reason">Reason (optional)</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason for this decision"
        />
      </div>
      <div className="actions">
        <button
          data-action="edit"
          disabled={status === "loading"}
          onClick={() => handleAction("edit")}
        >
          Save edit
        </button>
        {(canApprove ?? true) && (
          <button
            data-action="approve"
            disabled={status === "loading"}
            onClick={() => handleAction("approve")}
          >
            Approve
          </button>
        )}
        {(canDeny ?? true) && (
          <button
            data-action="deny"
            disabled={status === "loading"}
            onClick={() => handleAction("deny")}
          >
            Deny
          </button>
        )}
      </div>
      {status === "error" && <p className="error">{errorMessage}</p>}
      {status === "success" && <p className="success">Action completed.</p>}
    </div>
  );
}
