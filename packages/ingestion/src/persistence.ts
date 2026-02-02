import { messages, ingestionEvents, type Db } from "@aipromptsecret/db";
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
    await db.insert(messages).values({
      id: messageId,
      content: parsed.message,
      metadata: {},
      moderationStatus: "pending",
    });
  }

  await db.insert(ingestionEvents).values({
    id: uuidv7(),
    method: raw.method,
    path: raw.path,
    query: raw.query,
    headers: raw.headers,
    body: raw.body,
    userAgent: raw.headers["user-agent"] ?? null,
    parsedMessage: parsed.message,
    parseStatus: parsed.status,
    messageId,
  });
}
