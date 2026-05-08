const MAX_LENGTH = 64;

const USER_AGENT_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\bOpenAI\b/i, canonical: "openai" },
  { pattern: /\bAnthropic\b/i, canonical: "anthropic" },
  { pattern: /\bGemini\b|\bgoogle-genai\b/i, canonical: "gemini" },
];

function clean(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_LENGTH);
}

/**
 * Identify the originating model from a normalized (lowercase-keyed)
 * header map. Returns null when no signal is present.
 */
export function extractOriginatingModel(
  headers: Record<string, string>,
): string | null {
  const xModel = headers["x-model"];
  if (typeof xModel === "string") {
    const cleaned = clean(xModel);
    if (cleaned) return cleaned;
  }

  const ua = headers["user-agent"];
  if (typeof ua === "string") {
    for (const { pattern, canonical } of USER_AGENT_PATTERNS) {
      if (pattern.test(ua)) return canonical;
    }
  }

  return null;
}
