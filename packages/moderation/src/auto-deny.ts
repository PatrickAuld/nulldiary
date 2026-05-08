import type { Db } from "@nulldiary/db";
import { uuidv7 } from "uuidv7";

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

export type ApplyAutoDenyInput = {
  messageId: string;
  reason: string;
  actor: string;
};

export async function applyAutoDeny(
  db: Db,
  input: ApplyAutoDenyInput,
): Promise<void> {
  // Race-safe: filter on `moderation_status='pending'` so a human moderator
  // who already acted between scan and apply wins. We look at the returned
  // rows to decide whether to write the audit row.
  const { data, error } = (await db
    .from("messages")
    .update({
      moderation_status: "denied",
      auto_action: "denied",
      auto_action_reason: input.reason,
      denied_at: new Date().toISOString(),
      moderated_by: input.actor,
    })
    .eq("id", input.messageId)
    .eq("moderation_status", "pending")
    .select()) as { data: unknown[] | null; error: unknown };

  if (error) throw error;
  if (!data || data.length === 0) return;

  const { error: insertError } = (await db.from("moderation_actions").insert({
    id: uuidv7(),
    message_id: input.messageId,
    action: "denied",
    actor: input.actor,
    reason: input.reason,
  })) as { error: unknown };

  if (insertError) throw insertError;
}

export type ApplyFlagInput = {
  messageId: string;
  riskScore: number;
  labels: { category: string; score: number }[];
};

export async function applyFlag(db: Db, input: ApplyFlagInput): Promise<void> {
  const { error } = (await db
    .from("messages")
    .update({
      auto_action: "flagged",
      auto_action_reason: null,
      risk_score: input.riskScore,
      risk_labels: input.labels,
      scored_at: new Date().toISOString(),
    })
    .eq("id", input.messageId)) as { error: unknown };

  if (error) throw error;
}

export async function applyClear(db: Db, messageId: string): Promise<void> {
  const { error } = (await db
    .from("messages")
    .update({
      auto_action: "cleared",
      scored_at: new Date().toISOString(),
    })
    .eq("id", messageId)) as { error: unknown };

  if (error) throw error;
}
