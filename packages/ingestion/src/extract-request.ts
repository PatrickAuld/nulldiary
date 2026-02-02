import type { RawRequest } from "./types.js";

export async function extractRequest(request: Request): Promise<RawRequest> {
  const url = new URL(request.url);

  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  const contentType = headers["content-type"] ?? null;

  let body: string | null = null;
  try {
    body = await request.text();
    if (body === "") body = null;
  } catch {
    // no body
  }

  return {
    method: request.method,
    path: url.pathname,
    query,
    headers,
    body,
    contentType,
  };
}
