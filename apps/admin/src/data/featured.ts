import type { Db } from "@nulldiary/db";

export type FeaturedSetRow = {
  id: string;
  slug: string;
  title: string | null;
  pinned: boolean;
};

export async function listFeaturedSets(db: Db): Promise<FeaturedSetRow[]> {
  const { data, error } = await db
    .from("featured_sets")
    .select("id, slug, title, pinned")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as FeaturedSetRow[];
}

export async function listFeaturedMemberships(
  db: Db,
  messageIds: string[],
): Promise<Array<{ set_id: string; message_id: string }>> {
  if (messageIds.length === 0) return [];

  const { data, error } = await db
    .from("featured_set_messages")
    .select("set_id, message_id")
    .in("message_id", messageIds);

  if (error) throw error;
  return (data ?? []) as Array<{ set_id: string; message_id: string }>;
}

export async function pinFeaturedSet(
  db: Db,
  setId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Unpin all, then pin the requested one.
  const { error: unpinError } = await db
    .from("featured_sets")
    .update({ pinned: false, updated_at: new Date().toISOString() })
    .eq("pinned", true);

  if (unpinError) {
    const msg =
      (unpinError as any)?.message ?? "Failed to unpin existing featured set";
    return { ok: false, error: msg };
  }

  const { error: pinError } = await db
    .from("featured_sets")
    .update({ pinned: true, updated_at: new Date().toISOString() })
    .eq("id", setId);

  if (pinError) {
    const e = pinError as any;

    // Common “schema cache / missing column” failures when migrations aren’t applied.
    if (e?.code === "PGRST204" || e?.code === "42703") {
      return {
        ok: false,
        error:
          "Pinned featured sets require the latest DB migrations (missing pinned column).",
      };
    }

    const msg = e?.message ?? "Failed to pin featured set";
    return { ok: false, error: msg };
  }

  return { ok: true };
}
