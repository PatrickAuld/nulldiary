import type { RawRequest, ParseResult, ParseSource } from "./types.js";

const HEADER_KEYS = ["x-message", "x-secret", "x-prompt"] as const;
const BODY_FIELD_KEYS = ["message", "secret", "prompt"] as const;
const QUERY_KEYS = ["message", "secret"] as const;

function success(message: string, source: ParseSource): ParseResult {
  return { message, status: "success", source };
}

const FAILED: ParseResult = { message: null, status: "failed", source: null };

/** Return trimmed value or null if empty/whitespace-only. */
function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fromHeaders(headers: Record<string, string>): ParseResult | null {
  for (const key of HEADER_KEYS) {
    const value = nonEmpty(headers[key]);
    if (value) return success(value, "header");
  }
  return null;
}

function fromBody(
  body: string | null,
  contentType: string | null,
): ParseResult | null {
  if (!body || !contentType) return null;

  const ct = contentType.toLowerCase();

  if (ct.startsWith("application/json")) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      for (const key of BODY_FIELD_KEYS) {
        const value = nonEmpty(parsed[key]);
        if (value) return success(value, "body");
      }
    } catch {
      // malformed JSON, fall through
    }
    return null;
  }

  if (ct.startsWith("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    for (const key of BODY_FIELD_KEYS) {
      const value = nonEmpty(params.get(key));
      if (value) return success(value, "body");
    }
    return null;
  }

  if (ct.startsWith("text/plain")) {
    const value = nonEmpty(body);
    if (value) return success(value, "body");
    return null;
  }

  return null;
}

function fromQuery(query: Record<string, string>): ParseResult | null {
  for (const key of QUERY_KEYS) {
    const value = nonEmpty(query[key]);
    if (value) return success(value, "query");
  }
  return null;
}

function fromPath(path: string): ParseResult | null {
  const prefix = "/s/";
  const idx = path.indexOf(prefix);
  if (idx === -1) return null;

  const raw = path.slice(idx + prefix.length);
  if (!raw) return null;

  // People often paste URL-encoded text; also treat '+' as space for readability.
  const normalized = raw.replace(/\+/g, " ");
  let decodedRaw: string;
  try {
    decodedRaw = decodeURIComponent(normalized);
  } catch {
    // If decoding fails, fall back to normalized raw.
    decodedRaw = normalized;
  }

  const decoded = nonEmpty(decodedRaw);
  if (decoded) return success(decoded, "path");
  return null;
}

export function parseMessage(raw: RawRequest): ParseResult {
  return (
    fromHeaders(raw.headers) ??
    fromBody(raw.body, raw.contentType) ??
    fromQuery(raw.query) ??
    fromPath(raw.path) ??
    FAILED
  );
}
