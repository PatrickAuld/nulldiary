import type { RawRequest } from "./types.js";

export async function extractRequest(request: Request): Promise<RawRequest> {
  const url = new URL(request.url);

  // Use null-prototype objects to avoid prototype pollution via keys like "__proto__".
  const query: Record<string, string> = Object.create(null);
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  const headers: Record<string, string> = Object.create(null);
  // `Headers.entries()` exists at runtime in many environments, but TypeScript's lib.dom types
  // do not always include it depending on the target. `forEach` is universally typed.
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

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
