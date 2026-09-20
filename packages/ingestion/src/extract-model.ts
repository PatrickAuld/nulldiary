const MAX_LENGTH = 64;

function clean(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_LENGTH);
}

/**
 * Identify the originating model from a normalized (lowercase-keyed)
 * header map. Reads the `X-Author` header only; returns null otherwise.
 */
export function extractOriginatingModel(
  headers: Record<string, string | undefined>,
): string | null {
  const xAuthor = headers["x-author"];
  if (typeof xAuthor === "string") {
    const cleaned = clean(xAuthor);
    if (cleaned) return cleaned;
  }

  return null;
}
