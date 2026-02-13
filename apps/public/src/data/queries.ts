import type { Db, Message } from "@nulldiary/db";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";

const PUBLIC_REVALIDATE_SECONDS = 600;

export type FeaturedSetWithMessages = {
  set: { id: string; slug: string; title: string | null };
  messages: Message[];
};

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
    .not("short_id", "is", null)
    .order("approved_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const { count, error: countError } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "approved")
    .not("short_id", "is", null);

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

async function _getApprovedMessageByShortId(
  db: Db,
  shortId: string,
): Promise<Message | null> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("short_id", shortId)
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

export const getApprovedMessageByShortIdCached = unstable_cache(
  async (shortId: string) => {
    return _getApprovedMessageByShortId(getDb(), shortId);
  },
  ["public:getApprovedMessageByShortId"],
  { revalidate: PUBLIC_REVALIDATE_SECONDS },
);

async function _getCurrentFeaturedSetWithMessages(
  db: Db,
): Promise<FeaturedSetWithMessages | null> {
  const { data: set, error } = await db
    .from("featured_sets")
    .select("id, slug, title")
    .eq("pinned", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!set) return null;

  const { data: rows, error: rowsError } = await db
    .from("featured_set_messages")
    .select("position, message:messages(*)")
    .eq("set_id", set.id)
    .order("position", { ascending: true });

  if (rowsError) throw rowsError;

  const messages = (rows ?? [])
    .map((r) => (r as any).message as Message | null)
    .filter((m): m is Message => m !== null && m.short_id !== null);

  return { set, messages };
}

export const getCurrentFeaturedSetWithMessagesCached = unstable_cache(
  async () => {
    return _getCurrentFeaturedSetWithMessages(getDb());
  },
  ["public:getCurrentFeaturedSetWithMessages"],
  { revalidate: PUBLIC_REVALIDATE_SECONDS },
);
