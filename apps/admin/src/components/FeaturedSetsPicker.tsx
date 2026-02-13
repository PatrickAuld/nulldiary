"use client";

import { useMemo, useState } from "react";
import type { FeaturedSetRow } from "@/data/featured";

export function FeaturedSetsPicker({
  messageId,
  sets,
  selectedSetIds,
}: {
  messageId: string;
  sets: FeaturedSetRow[];
  selectedSetIds: string[];
}) {
  const initial = useMemo(() => new Set(selectedSetIds), [selectedSetIds]);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function toggle(setId: string) {
    const isSelected = selected.has(setId);
    const op = isSelected ? "remove" : "add";

    setStatus("loading");

    try {
      const res = await fetch("/api/featured/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, messageId, op }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setSelected((prev) => {
        const next = new Set(prev);
        if (op === "add") next.add(setId);
        else next.delete(setId);
        return next;
      });

      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (sets.length === 0) return <p>No featured sets yet.</p>;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sets.map((s) => (
          <label key={s.id} style={{ display: "flex", gap: 8 }}>
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              disabled={status === "loading"}
            />
            <span>
              <code>{s.slug}</code>
              {s.pinned ? " (pinned)" : ""}
            </span>
          </label>
        ))}
      </div>
      {status === "error" && (
        <p className="error" style={{ marginTop: 8 }}>
          Failed to update featured membership.
        </p>
      )}
    </div>
  );
}
