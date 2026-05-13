import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildDailyDigest, renderDigestText } from "@/data/digest";
import { sendDigestEmail } from "@/lib/email";

/**
 * Daily/weekly moderation digest endpoint.
 *
 * Auth: header `x-cron-secret` or `authorization: Bearer <CRON_SECRET>` must
 * match `process.env.CRON_SECRET`. Vercel Cron sends the configured Bearer
 * token in the `authorization` header automatically.
 *
 * Body: returns the rendered digest as JSON for debugging. The email is also
 * dispatched via Resend if `RESEND_API_KEY` and `DIGEST_TO_EMAIL` are set.
 *
 * Mode: `?mode=daily` (default) or `?mode=weekly`. The mode toggles only the
 * subject line and is intended for the steady-state weekly cadence post-launch.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") as "daily" | "weekly") || "daily";

  try {
    const db = getDb();
    const digest = await buildDailyDigest(db);
    const adminUrl =
      process.env.ADMIN_PUBLIC_URL ?? "https://admin.nulldiary.io";
    const rendered = renderDigestText(digest, { admin_url: adminUrl, mode });

    const sendResult = await sendDigestEmail(rendered);

    return NextResponse.json({
      ok: true,
      mode,
      digest,
      email: sendResult,
      subject: rendered.subject,
      text: rendered.text,
    });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to build digest" },
      { status: 500 },
    );
  }
}

// Vercel Cron currently issues GET requests (with the Bearer header). Accept
// GET as an alias so the same route serves both cron drivers.
export async function GET(req: Request): Promise<Response> {
  return POST(req);
}

function checkCronAuth(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  const provided =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
