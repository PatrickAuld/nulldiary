"use client";

import { useMemo, useState } from "react";

function normalizeTags(text: string): string[] {
  const parts = text
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

export function TagsForm({
  messageId,
  initialTags,
}: {
  messageId: string;
  initialTags: string[];
}) {
  const initialText = useMemo(() => initialTags.join(", "), [initialTags]);
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string>("");

  const tags = useMemo(() => normalizeTags(text), [text]);
  const featured = tags.includes("featured");

  async function save(nextTags: string[]) {
    setStatus("saving");
    setError("");

    const res = await fetch(`/api/messages/${messageId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save tags");
      setStatus("error");
      return;
    }

    setStatus("success");
    // Keep the UI in sync with what we sent.
    setText(nextTags.join(", "));
    setTimeout(() => setStatus("idle"), 1200);
  }

  function toggleFeatured() {
    const next = new Set(tags);
    if (next.has("featured")) next.delete("featured");
    else next.add("featured");
    void save(Array.from(next));
  }

  return (
    <div className="detail-section">
      <h2>Tags</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={featured}
            onChange={toggleFeatured}
          />
          Featured (public gallery)
        </label>

        <span style={{ color: "#6b7280", fontSize: 13 }}>
          Stored as a comma-separated list.
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="featured, longform, funny"
        />
      </div>

      <div className="actions" style={{ marginTop: 10 }}>
        <button
          onClick={() => save(tags)}
          disabled={status === "saving"}
          data-action="approve"
        >
          Save tags
        </button>
      </div>

      {status === "error" && <p className="error">{error}</p>}
      {status === "success" && <p className="success">Saved</p>}
    </div>
  );
}
