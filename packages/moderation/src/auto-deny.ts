import type { Db } from "@nulldiary/db";

export type DupeLookup = {
  status: "pending" | "approved" | "denied";
  messageId: string;
};

type MessageRow = {
  id: string;
  moderation_status: "pending" | "approved" | "denied";
};

export async function findDupeByContentHash(
  db: Db,
  contentHash: string,
): Promise<DupeLookup | null> {
  const { data, error } = (await db
    .from("messages")
    .select("id, moderation_status")
    .eq("content_hash", contentHash)
    .order("created_at", { ascending: false })
    .limit(1)) as { data: MessageRow[] | null; error: unknown };

  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { status: row.moderation_status, messageId: row.id };
}
