import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { recordPageView, shouldRecordPageView } from "@/lib/page-views";

/**
 * Capture page views for the launch dashboard. Fire-and-forget: any error
 * in this path MUST be swallowed; the user response always wins.
 *
 * The matcher already excludes most static + API paths, but we double-check
 * inside `shouldRecordPageView` since the middleware matcher syntax is finicky
 * and we'd rather over-filter at runtime than under-filter.
 */
export function middleware(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname;
  const method = request.method;

  if (shouldRecordPageView({ method, path })) {
    try {
      const db = getDb();
      const referer =
        request.headers.get("referer") || request.headers.get("referrer");
      const userAgent = request.headers.get("user-agent");
      // Promise intentionally not awaited; recordPageView never rejects.
      void recordPageView(db, { path, referer, userAgent });
    } catch {
      // getDb can throw if env is missing in some preview environments.
      // Never break a page render over a missing analytics insert.
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude API routes, ingestion shortcut, Next internals, OG endpoints,
    // common static assets, and favicons. We re-validate inside the handler.
    "/((?!api/|_next/|s/|og/|og\\.|favicon|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico|js|css|map|txt|xml|webmanifest)$).*)",
  ],
};
