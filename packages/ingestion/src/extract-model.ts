const MAX_LENGTH = 64;

function clean(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_LENGTH);
}

/**
 * Identify the originating model from a normalized (lowercase-keyed)
 * header map. Reads the `X-Model` header only; returns null otherwise.
 */
export function extractOriginatingModel(
  headers: Record<string, string | undefined>,
): string | null {
  const xModel = headers["x-model"];
  if (typeof xModel === "string") {
    const cleaned = clean(xModel);
    if (cleaned) return cleaned;
  }

  return null;
}
