import { eq, messages, type Db } from "@nulldiary/db";

export async function setMessageTags(
  db: Db,
  input: { messageId: string; tags: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db.select().from(messages).where(eq(messages.id, input.messageId));
  if (!row) return { ok: false, error: "Message not found" };

  // Store null when empty to match existing schema usage.
  const tags = input.tags.length > 0 ? input.tags : null;

  await db.update(messages).set({ tags }).where(eq(messages.id, input.messageId));

  return { ok: true };
}
