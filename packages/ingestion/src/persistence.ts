import type { Db } from "@nulldiary/db";
import { uuidv7 } from "uuidv7";
import { normalizeMessage, hashContent } from "./normalize.js";
import { randomShortId } from "./short-id.js";
import type { RawRequest, ParseResult } from "./types.js";

export async function persistIngestion(
  db: Db,
  raw: RawRequest,
  parsed: ParseResult,
): Promise<void> {
  let messageId: string | null = null;

  if (parsed.status === "success") {
    messageId = uuidv7();

    const normalized = normalizeMessage(parsed.message);
    const contentHash = hashContent(normalized);

    // Generate a short, shareable ID for public URLs.
    // Retry a few times on the extremely unlikely chance of collision.
    let inserted = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await db.from("messages").insert({
        id: messageId,
        content: parsed.message,
        normalized_content: normalized,
        content_hash: contentHash,
        metadata: {},
        moderation_status: "pending",
        short_id: randomShortId(),
      });

      if (!error) {
        inserted = true;
        break;
      }
      // Postgres unique violation
      if ((error as any).code === "23505") continue;
      throw error;
    }

    if (!inserted) {
      throw new Error("Failed to generate unique short_id for message");
    }
  }

  const forwarded = raw.headers["x-forwarded-for"];
  const sourceIp = forwarded ? forwarded.split(",")[0]?.trim() : null;

  const { error } = await db.from("ingestion_events").insert({
    id: uuidv7(),
    method: raw.method,
    path: raw.path,
    query: raw.query,
    headers: raw.headers,
    body: raw.body,
    source_ip: sourceIp || null,
    user_agent: raw.headers["user-agent"] ?? null,
    parsed_message: parsed.message,
    parse_status: parsed.status,
    message_id: messageId,
  });
  if (error) throw error;
}
