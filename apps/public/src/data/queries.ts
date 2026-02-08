import { eq, desc, sql, and, messages, type Db } from "@nulldiary/db";

export async function getApprovedMessages(
  db: Db,
  opts: { limit?: number; offset?: number },
): Promise<{ messages: (typeof messages.$inferSelect)[]; total: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const where = eq(messages.moderationStatus, "approved");

  const rows = await db
    .select()
    .from(messages)
    .where(where)
    .orderBy(desc(messages.approvedAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(where);

  return { messages: rows, total: Number(countRow.count) };
}

export async function getApprovedMessageById(
  db: Db,
  id: string,
): Promise<typeof messages.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.moderationStatus, "approved")));
  return row ?? null;
}
