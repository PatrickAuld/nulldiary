/**
 * Lift any inbound `x-seed-*` headers into a structured seed metadata block
 * for `messages.metadata.seed`.
 *
 * Header keys are lowercased, the `x-seed-` prefix is stripped, and remaining
 * dashes are converted to underscores so they sit comfortably inside JSON.
 *
 * Real-user requests do not carry these headers, so this returns null in
 * production traffic. Only the seed harness injects them.
 */
export function extractSeedMetadata(
  headers: Record<string, string | undefined>,
): Record<string, string> | null {
  const result: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    if (typeof rawValue !== "string") continue;

    const key = rawKey.toLowerCase();
    if (!key.startsWith("x-seed-")) continue;

    const value = rawValue.trim();
    if (value.length === 0) continue;

    const fieldName = key.slice("x-seed-".length).replace(/-/g, "_");
    if (fieldName.length === 0) continue;

    result[fieldName] = value;
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}
