export interface ExtractedHttpRequest {
  method: string;
  url: string;
  body: string | null;
}

const URL_REGEX = /https?:\/\/[^\s)<>"'`]+/i;
const TRAILING_PUNCT = /[.,;:!?)\]}'"`]+$/;
const METHOD_WORDS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

/**
 * Best-effort extraction of an HTTP request from raw text the model produced
 * when it failed to invoke the tool.
 *
 * Returns the first URL on the configured host, an inferred method (POST if
 * the model used a POST keyword nearby, GET otherwise), and a body if the
 * text contains an obvious POST body (a blank-line-separated block, or a
 * curl `-d` argument).
 */
export function extractHttpRequestFromText(
  text: string,
  host: string,
): ExtractedHttpRequest | null {
  if (!text || text.trim().length === 0) return null;

  const match = URL_REGEX.exec(text);
  if (!match) return null;

  const url = match[0].replace(TRAILING_PUNCT, "");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.host !== host) return null;

  const method = inferMethod(text, match.index);
  const body = method === "POST" ? extractBody(text, match.index, url) : null;

  return { method, url, body };
}

function inferMethod(text: string, urlIndex: number): string {
  // Look at up to 32 chars before the URL for a method keyword.
  const lookbackStart = Math.max(0, urlIndex - 32);
  const lookback = text.slice(lookbackStart, urlIndex).toUpperCase();

  for (const m of METHOD_WORDS) {
    if (lookback.includes(m)) return m;
  }

  return "GET";
}

function extractBody(
  text: string,
  urlIndex: number,
  url: string,
): string | null {
  // curl style: ... -d 'body' or -d "body"
  const curlBody = /\s-d\s+(?:'([^']*)'|"([^"]*)"|(\S+))/.exec(
    text.slice(urlIndex),
  );
  if (curlBody) {
    return curlBody[1] ?? curlBody[2] ?? curlBody[3] ?? null;
  }

  // HTTP request shape: blank line after headers, then body.
  const after = text.slice(urlIndex + url.length);
  const blankLineSplit = after.split(/\r?\n\r?\n/);
  if (blankLineSplit.length >= 2) {
    const body = blankLineSplit.slice(1).join("\n\n").trim();
    if (body.length > 0) return body;
  }

  return null;
}
