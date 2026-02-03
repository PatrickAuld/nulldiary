export const runtime = "edge";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { denyMessage } from "@/data/actions";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json();
  const { messageId, actor, reason } = body;

  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 },
    );
  }

  if (!actor || typeof actor !== "string") {
    return NextResponse.json(
      { error: "actor is required" },
      { status: 400 },
    );
  }

  const result = await denyMessage(getDb(), { messageId, actor, reason });

  if (!result.ok) {
    const status = result.error === "Message not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
