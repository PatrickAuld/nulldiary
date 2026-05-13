import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revertModeration } from "@/data/seed-review";
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
  const { messageId } = body;

  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 },
    );
  }

  const actor = user.email || user.id;

  try {
    const result = await revertModeration(getDb(), { messageId, actor });

    if (!result.ok) {
      const status = result.error === "Message not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e?.message ?? "Failed to revert moderation" },
      { status: 500 },
    );
  }
}
