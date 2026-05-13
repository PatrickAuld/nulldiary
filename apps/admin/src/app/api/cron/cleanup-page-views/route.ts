import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Daily cleanup: delete page_views rows older than 60 days.
 *
 * Auth: matches the digest cron — header `x-cron-secret` or
 * `authorization: Bearer <CRON_SECRET>`.
 */
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 60;

export async function POST(req: Request): Promise<Response> {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 86_400_000,
    ).toISOString();

    const db = getDb();
    const { error } = await db
      .from("page_views")
      .delete()
      .lt("received_at", cutoff);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      cutoff,
      retention_days: RETENTION_DAYS,
    });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to clean up page_views" },
      { status: 500 },
    );
  }
}

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
