import type { Db, Message } from "@nulldiary/db";

export async function getApprovedMessages(
  db: Db,
  opts: { limit?: number; offset?: number },
): Promise<{ messages: Message[]; total: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("moderation_status", "approved")
    .order("approved_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const { count, error: countError } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "approved");

  if (countError) throw countError;

  return { messages: (data ?? []) as Message[], total: count ?? 0 };
}

export async function getApprovedMessageById(
  db: Db,
  id: string,
): Promise<Message | null> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("id", id)
    .eq("moderation_status", "approved")
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;

  return data as Message;
}
