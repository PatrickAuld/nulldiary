import {
  MARKDOWN_CONTENT_TYPE,
  addVaryAccept,
} from "@/lib/content-negotiation";
import { renderMarkdownPage } from "@/lib/markdown-page";

export const revalidate = 600;

async function handler(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "/";
  const page = await renderMarkdownPage(path);
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": MARKDOWN_CONTENT_TYPE,
    "X-Content-Type-Options": "nosniff",
  });
  addVaryAccept(headers);

  return new Response(page.body, { status: page.status, headers });
}

export const GET = handler;
export const HEAD = handler;
