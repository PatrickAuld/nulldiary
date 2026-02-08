import {
  eq,
  ilike,
  gt,
  lt,
  desc,
  sql,
  and,
  type SQL,
  messages,
  ingestionEvents,
  type Db,
} from "@nulldiary/db";
import type { MessageListFilters } from "./types.js";

export async function listMessages(
  db: Db,
  filters: MessageListFilters,
): Promise<{ messages: (typeof messages.$inferSelect)[]; total: number }> {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(messages.moderationStatus, filters.status));
  }
  if (filters.search) {
    conditions.push(ilike(messages.content, `%${filters.search}%`));
  }
  if (filters.after) {
    conditions.push(gt(messages.createdAt, filters.after));
  }
  if (filters.before) {
    conditions.push(lt(messages.createdAt, filters.before));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const rows = await db
    .select()
    .from(messages)
    .where(where)
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(where);

  return { messages: rows, total: Number(countRow.count) };
}

export async function getMessageById(
  db: Db,
  id: string,
): Promise<typeof messages.$inferSelect | null> {
  const [row] = await db.select().from(messages).where(eq(messages.id, id));
  return row ?? null;
}

export async function getIngestionEventsByMessageId(
  db: Db,
  messageId: string,
): Promise<(typeof ingestionEvents.$inferSelect)[]> {
  return db
    .select()
    .from(ingestionEvents)
    .where(eq(ingestionEvents.messageId, messageId))
    .orderBy(desc(ingestionEvents.receivedAt));
}
