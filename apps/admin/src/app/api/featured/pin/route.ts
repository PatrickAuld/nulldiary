import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pinFeaturedSet } from "@/data/featured";
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

  const result = await pinFeaturedSet(getDb(), setId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
