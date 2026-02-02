import type { Context } from "hono";
import type { RawRequest } from "./types.js";

export async function extractRequest(c: Context): Promise<RawRequest> {
  const url = new URL(c.req.url);

  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of c.req.raw.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  const contentType = headers["content-type"] ?? null;

  let body: string | null = null;
  try {
    body = await c.req.text();
    if (body === "") body = null;
  } catch {
    // no body
  }

  return {
    method: c.req.method,
    path: url.pathname,
    query,
    headers,
    body,
    contentType,
  };
}
