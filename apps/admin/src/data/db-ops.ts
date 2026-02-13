import type { Db } from "@nulldiary/db";

export type ModerationStatus = "pending" | "approved" | "denied";

export async function deleteMessagesByStatusOlderThan(
  db: Db,
  status: ModerationStatus,
  olderThanIso: string,
): Promise<{ deleted: number }> {
  // Supabase delete() supports count with select('*', { count: 'exact', head: true })
  // but for deletes we can request count via the `count` option.
  const { error, count } = await db
    .from("messages")
    .delete({ count: "exact" })
    .eq("moderation_status", status)
    .lt("created_at", olderThanIso);

  if (error) throw error;
  return { deleted: count ?? 0 };
}
