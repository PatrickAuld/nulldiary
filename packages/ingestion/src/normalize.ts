import { createHash } from "node:crypto";

export function normalizeMessage(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashContent(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
