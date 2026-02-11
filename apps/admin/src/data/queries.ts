import type { Db, Message, IngestionEvent } from "@nulldiary/db";
import type { MessageListFilters } from "./types.js";

export async function listMessages(
  db: Db,
  filters: MessageListFilters,
): Promise<{ messages: Message[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = db.from("messages").select("*");

  if (filters.status) {
    query = query.eq("moderation_status", filters.status);
  }
  if (filters.search) {
    query = query.ilike("content", `%${filters.search}%`);
  }
  if (filters.after) {
    query = query.gt("created_at", filters.after.toISOString());
  }
  if (filters.before) {
    query = query.lt("created_at", filters.before.toISOString());
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Count query with same filters
  let countQuery = db
    .from("messages")
    .select("*", { count: "exact", head: true });

  if (filters.status) {
    countQuery = countQuery.eq("moderation_status", filters.status);
  }
  if (filters.search) {
    countQuery = countQuery.ilike("content", `%${filters.search}%`);
  }
  if (filters.after) {
    countQuery = countQuery.gt("created_at", filters.after.toISOString());
  }
  if (filters.before) {
    countQuery = countQuery.lt("created_at", filters.before.toISOString());
  }

  const { count, error: countError } = await countQuery;

  if (countError) throw countError;

  return { messages: (data ?? []) as Message[], total: count ?? 0 };
}

export async function getMessageById(
  db: Db,
  id: string,
): Promise<Message | null> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;

  return data as Message;
}

export async function getIngestionEventsByMessageId(
  db: Db,
  messageId: string,
): Promise<IngestionEvent[]> {
  const { data, error } = await db
    .from("ingestion_events")
    .select("*")
    .eq("message_id", messageId)
    .order("received_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as IngestionEvent[];
}
