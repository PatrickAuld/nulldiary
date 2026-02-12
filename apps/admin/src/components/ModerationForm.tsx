"use client";

import { useState } from "react";

export function ModerationForm({
  messageId,
  defaultEditedContent,
}: {
  messageId: string;
  defaultEditedContent: string;
}) {
  const [reason, setReason] = useState("");
  const [editedContent, setEditedContent] = useState(defaultEditedContent);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAction(action: "approve" | "deny") {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/moderation/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          reason: reason.trim() || undefined,
          ...(action === "approve"
            ? { editedContent: editedContent.trim() || undefined }
            : {}),
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
          data-action="approve"
          disabled={status === "loading"}
          onClick={() => handleAction("approve")}
        >
          Approve
        </button>
        <button
          data-action="deny"
          disabled={status === "loading"}
          onClick={() => handleAction("deny")}
        >
          Deny
        </button>
      </div>
      {status === "error" && <p className="error">{errorMessage}</p>}
      {status === "success" && <p className="success">Action completed.</p>}
    </div>
  );
}
