import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { setId } = body as { setId?: unknown };

  if (!setId || typeof setId !== "string") {
    return NextResponse.json({ error: "setId is required" }, { status: 400 });
  }

  const db = getDb();

  // Unpin all, then pin the requested one.
  const { error: unpinError } = await db
    .from("featured_sets")
    .update({ pinned: false, updated_at: new Date().toISOString() })
    .eq("pinned", true);

  if (unpinError) throw unpinError;

  const { error: pinError } = await db
    .from("featured_sets")
    .update({ pinned: true, updated_at: new Date().toISOString() })
    .eq("id", setId);

  if (pinError) throw pinError;

  return NextResponse.json({ ok: true });
}
