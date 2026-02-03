export const runtime = "edge";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getIngestionEventsByMessageId } from "@/data/queries";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const messageId = url.searchParams.get("messageId");

  if (!messageId) {
    return NextResponse.json(
      { error: "messageId query parameter is required" },
      { status: 400 },
    );
  }

  const events = await getIngestionEventsByMessageId(getDb(), messageId);
  return NextResponse.json({ events });
}
