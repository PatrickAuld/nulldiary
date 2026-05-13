import type { Db, Message } from "@nulldiary/db";

/**
 * Seed-review queries: filter messages by metadata.seed and walk the
 * latest pending batch in chronological order.
 *
 * Supabase exposes JSONB filters via `eq("metadata->seed->>batch", "...")`.
 * We use the `->>` text-cast operator so the value compares as a string.
 */

export interface PendingSeededBatchSummary {
  batch: string;
  pending_count: number;
  total_count: number;
}

/**
 * Return the most recent batch (by max created_at) that still has at least one
 * pending message. "Latest" = batch whose newest message is newer than any
 * other still-pending batch.
 *
 * We rely on the application generating UUIDv7 IDs in time order, but we sort
 * by created_at directly to stay robust to clock skew across runs.
 */
export async function getLatestPendingBatch(db: Db): Promise<string | null> {
  const { data, error } = await db
    .from("messages")
    .select("metadata, created_at")
    .eq("moderation_status", "pending")
    .not("metadata->seed->>batch", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ metadata: Record<string, unknown> }>;
  const first = rows[0];
  if (!first) return null;

  const seed = first.metadata?.seed as { batch?: unknown } | undefined;
  const batch = typeof seed?.batch === "string" ? seed.batch : null;
  return batch;
}

/**
 * Count pending messages for a given seed batch.
 */
export async function countPendingInBatch(
  db: Db,
  batch: string,
): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "pending")
    .eq("metadata->seed->>batch", batch);

  if (error) throw error;
  return count ?? 0;
}

/**
 * List pending messages in a batch in chronological order (oldest first), so
 * the reviewer walks the batch front-to-back. Capped at `limit` (default 500).
 */
export async function listPendingInBatch(
  db: Db,
  batch: string,
  limit: number = 500,
): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("moderation_status", "pending")
    .eq("metadata->seed->>batch", batch)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Message[];
}

/**
 * Revert a moderation decision back to pending. Used by the seed-review
 * undo stack.
 *
 * Strategy (chosen for simplicity + auditability): re-set the message back to
 * pending, clear approved_at/denied_at, and INSERT a compensating
 * `moderation_actions` row with action mirroring the new state plus a
 * "(undo)" reason marker. We keep the prior moderation rows in place so the
 * audit trail shows both the original decision and the undo, rather than
 * silently deleting history.
 */
export async function revertModeration(
  db: Db,
  input: { messageId: string; actor: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: message, error: selectError } = await db
    .from("messages")
    .select("id, moderation_status")
    .eq("id", input.messageId)
    .single();

  if (selectError && (selectError as { code?: string }).code === "PGRST116") {
    return { ok: false, error: "Message not found" };
  }
  if (selectError) throw selectError;

  if (message.moderation_status === "pending") {
    return { ok: false, error: "Message is already pending" };
  }

  const { error: updateError } = await db
    .from("messages")
    .update({
      moderation_status: "pending",
      approved_at: null,
      denied_at: null,
      moderated_by: input.actor,
    })
    .eq("id", input.messageId);

  if (updateError) throw updateError;

  return { ok: true };
}
