import type { Db } from "@nulldiary/db";
import { uuidv7 } from "uuidv7";
import type { RawRequest, ParseResult } from "./types.js";

export async function persistIngestion(
  db: Db,
  raw: RawRequest,
  parsed: ParseResult,
): Promise<void> {
  let messageId: string | null = null;

  if (parsed.status === "success") {
    messageId = uuidv7();
    const { error } = await db.from("messages").insert({
      id: messageId,
      content: parsed.message,
      metadata: {},
      moderation_status: "pending",
    });
    if (error) throw error;
  }

  const { error } = await db.from("ingestion_events").insert({
    id: uuidv7(),
    method: raw.method,
    path: raw.path,
    query: raw.query,
    headers: raw.headers,
    body: raw.body,
    user_agent: raw.headers["user-agent"] ?? null,
    parsed_message: parsed.message,
    parse_status: parsed.status,
    message_id: messageId,
  });
  if (error) throw error;
}
