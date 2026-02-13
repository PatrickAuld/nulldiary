import type { Db } from "@nulldiary/db";
import { uuidv7 } from "uuidv7";
import type { ModerationInput, ModerationResult } from "./types.js";

export async function approveMessage(
  db: Db,
  input: ModerationInput,
): Promise<ModerationResult> {
  const { data: message, error: selectError } = await db
    .from("messages")
    .select("id, content, moderation_status")
    .eq("id", input.messageId)
    .single();

  if (selectError && selectError.code === "PGRST116") {
    return { ok: false, error: "Message not found" };
  }
  if (selectError) throw selectError;

  if (message.moderation_status !== "pending") {
    return {
      ok: false,
      error: `Message is not pending (current status: ${message.moderation_status})`,
    };
  }

  const { error: updateError } = await db
    .from("messages")
    .update({
      moderation_status: "approved",
      approved_at: new Date().toISOString(),
      moderated_by: input.actor,
      edited_content:
        input.editedContent?.trim() || (message.content ?? "").trim() || null,
    })
    .eq("id", input.messageId);

  if (updateError) throw updateError;

  const { error: insertError } = await db.from("moderation_actions").insert({
    id: uuidv7(),
    message_id: input.messageId,
    action: "approved",
    actor: input.actor,
    reason: input.reason ?? null,
  });

  if (insertError) throw insertError;

  return { ok: true };
}

export async function updateEditedContent(
  db: Db,
  input: { messageId: string; actor: string; editedContent: string | null },
): Promise<ModerationResult> {
  const { data: message, error: selectError } = await db
    .from("messages")
    .select("id")
    .eq("id", input.messageId)
    .single();

  if (selectError && selectError.code === "PGRST116") {
    return { ok: false, error: "Message not found" };
  }
  if (selectError) throw selectError;
  if (!message) return { ok: false, error: "Message not found" };

  const { error: updateError } = await db
    .from("messages")
    .update({
      edited_content: input.editedContent,
      moderated_by: input.actor,
    })
    .eq("id", input.messageId);

  if (updateError) throw updateError;

  return { ok: true };
}

export async function denyMessage(
  db: Db,
  input: ModerationInput,
): Promise<ModerationResult> {
  const { data: message, error: selectError } = await db
    .from("messages")
    .select("id, moderation_status")
    .eq("id", input.messageId)
    .single();

  if (selectError && selectError.code === "PGRST116") {
    return { ok: false, error: "Message not found" };
  }
  if (selectError) throw selectError;

  if (message.moderation_status === "denied") {
    return {
      ok: false,
      error: "Message is already denied",
    };
  }

  // Allow retroactive denial of previously-approved messages.
  const { error: updateError } = await db
    .from("messages")
    .update({
      moderation_status: "denied",
      denied_at: new Date().toISOString(),
      // If we are revoking approval, clear approved_at so timelines stay consistent.
      approved_at: null,
      moderated_by: input.actor,
    })
    .eq("id", input.messageId);

  if (updateError) throw updateError;

  const { error: insertError } = await db.from("moderation_actions").insert({
    id: uuidv7(),
    message_id: input.messageId,
    action: "denied",
    actor: input.actor,
    reason: input.reason ?? null,
  });

  if (insertError) throw insertError;

  return { ok: true };
}
