import type { Db, Message, IngestionEvent } from "@nulldiary/db";
import type { MessageListFilters } from "./types.js";

type AnyQuery = ReturnType<ReturnType<Db["from"]>["select"]>;

function applyFilters(query: AnyQuery, filters: MessageListFilters): AnyQuery {
  let q = query;
  if (filters.status) {
    q = q.eq("moderation_status", filters.status);
  }
  if (filters.search) {
    q = q.ilike("content", `%${filters.search}%`);
  }
  if (filters.after) {
    q = q.gt("created_at", filters.after.toISOString());
  }
  if (filters.before) {
    q = q.lt("created_at", filters.before.toISOString());
  }
  if (filters.autoAction === "any-auto") {
    q = q.not("auto_action", "is", null);
  } else if (filters.autoAction === "human-only") {
    q = q.is("auto_action", null);
  } else if (filters.autoAction) {
    q = q.eq("auto_action", filters.autoAction);
  }
  if (typeof filters.minRiskScore === "number") {
    q = q.gte("risk_score", filters.minRiskScore);
  }
  return q;
}

export async function listMessages(
  db: Db,
  filters: MessageListFilters,
): Promise<{ messages: Message[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const dataQuery = applyFilters(db.from("messages").select("*"), filters);
  const { data, error } = await dataQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const countQuery = applyFilters(
    db.from("messages").select("*", { count: "exact", head: true }),
    filters,
  );
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  return { messages: (data ?? []) as Message[], total: count ?? 0 };
}

export async function listSystemDenied(
  db: Db,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ messages: Message[]; total: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("auto_action", "denied")
    .eq("moderated_by", "system:auto-mod@v1")
    .order("denied_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const { count, error: countError } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("auto_action", "denied")
    .eq("moderated_by", "system:auto-mod@v1");
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
