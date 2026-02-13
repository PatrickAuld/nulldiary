import { NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
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

  const body = (await req.json()) as {
    setId?: unknown;
    messageId?: unknown;
    op?: unknown;
  };

  const setId = body.setId;
  const messageId = body.messageId;
  const op = body.op;

  if (typeof setId !== "string" || !setId) {
    return NextResponse.json({ error: "setId is required" }, { status: 400 });
  }
  if (typeof messageId !== "string" || !messageId) {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 },
    );
  }
  if (op !== "add" && op !== "remove") {
    return NextResponse.json(
      { error: "op must be add or remove" },
      { status: 400 },
    );
  }

  const db = getDb();

  if (op === "add") {
    // Avoid duplicates (best-effort).
    const { data: existing, error: existingError } = await db
      .from("featured_set_messages")
      .select("id")
      .eq("set_id", setId)
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      const { error } = await db.from("featured_set_messages").insert({
        id: uuidv7(),
        set_id: setId,
        message_id: messageId,
        position: 0,
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await db
    .from("featured_set_messages")
    .delete()
    .eq("set_id", setId)
    .eq("message_id", messageId);

  if (error) throw error;
  return NextResponse.json({ ok: true });
}
