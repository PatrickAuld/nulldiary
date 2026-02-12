import type { Db, Message } from "@nulldiary/db";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";

const PUBLIC_REVALIDATE_SECONDS = 600;

async function _getApprovedMessages(
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

async function _getApprovedMessageById(
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

/**
 * Uncached query helpers (useful for tests and any callers that already have a
 * Db instance).
 */
export async function getApprovedMessages(
  db: Db,
  opts: { limit?: number; offset?: number },
): Promise<{ messages: Message[]; total: number }> {
  return _getApprovedMessages(db, opts);
}

export async function getApprovedMessageById(
  db: Db,
  id: string,
): Promise<Message | null> {
  return _getApprovedMessageById(db, id);
}

/**
 * Cached, ISR-friendly query for public pages.
 *
 * NOTE: We intentionally create the DB client inside the cached function so
 * Next.js can memoize results (not the client instance).
 */
export const getApprovedMessagesCached = unstable_cache(
  async (opts: { limit?: number; offset?: number }) => {
    return _getApprovedMessages(getDb(), opts);
  },
  ["public:getApprovedMessages"],
  { revalidate: PUBLIC_REVALIDATE_SECONDS },
);

export const getApprovedMessageByIdCached = unstable_cache(
  async (id: string) => {
    return _getApprovedMessageById(getDb(), id);
  },
  ["public:getApprovedMessageById"],
  { revalidate: PUBLIC_REVALIDATE_SECONDS },
);
