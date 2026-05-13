import { uuidv7 } from "uuidv7";
import type { Db } from "@nulldiary/db";

export type UaClass = "bot" | "browser" | "unknown";

// Cheap heuristic. We do not need a full UA parser; we only want to keep
// dashboards from getting drowned by the obvious bot traffic.
const BOT_PATTERN =
  /bot|crawler|spider|crawl|slurp|fetch|preview|wget|curl|python-requests|node-fetch|libwww|httpclient|monitor|insights|pingdom|uptime|lighthouse|chrome-lighthouse|headlesschrome|phantomjs|googleweblight|mediapartners|outbrain|embedly|quora link preview|whatsapp|skypeuripreview|telegrambot|discordbot|linkedinbot|slackbot|twitterbot|facebookexternalhit/i;

export function classifyUserAgent(ua: string | null | undefined): UaClass {
  if (!ua) return "unknown";
  if (BOT_PATTERN.test(ua)) return "bot";
  if (ua.startsWith("Mozilla/")) return "browser";
  return "unknown";
}

export function parseRefererHost(
  referer: string | null | undefined,
): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

const SKIP_PREFIXES = ["/api/", "/_next/", "/s/", "/og/", "/og."];
const SKIP_SUFFIXES = [
  ".png",
  ".svg",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".js",
  ".css",
  ".map",
  ".txt",
  ".xml",
  ".webmanifest",
];
const SKIP_EXACT = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml"]);
const SKIP_FAVICON_PREFIX = "/favicon";

export function shouldRecordPageView(input: {
  method: string;
  path: string;
}): boolean {
  if (input.method.toUpperCase() !== "GET") return false;
  const path = input.path;
  if (SKIP_EXACT.has(path)) return false;
  if (path.startsWith(SKIP_FAVICON_PREFIX)) return false;
  for (const prefix of SKIP_PREFIXES) {
    if (path.startsWith(prefix)) return false;
  }
  for (const suffix of SKIP_SUFFIXES) {
    if (path.endsWith(suffix)) return false;
  }
  return true;
}

export interface PageViewRow {
  id: string;
  path: string;
  referer: string | null;
  host: string | null;
  ua_class: UaClass;
}

export function buildPageViewRow(input: {
  path: string;
  referer: string | null;
  userAgent: string | null;
}): PageViewRow {
  return {
    id: uuidv7(),
    path: input.path,
    referer: input.referer || null,
    host: parseRefererHost(input.referer),
    ua_class: classifyUserAgent(input.userAgent),
  };
}

/**
 * Fire-and-forget insert. NEVER throws — page-view capture must not break
 * the response. Errors are logged for visibility.
 */
export async function recordPageView(
  db: Db,
  input: { path: string; referer: string | null; userAgent: string | null },
): Promise<boolean> {
  const row = buildPageViewRow(input);
  try {
    const result = await db.from("page_views").insert(row);
    if (result.error) {
      console.error("[page-views] insert failed:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[page-views] insert threw:", err);
    return false;
  }
}
