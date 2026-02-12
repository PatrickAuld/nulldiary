import {
  inet,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const parseStatusEnum = pgEnum("parse_status", [
  "success",
  "partial",
  "failed",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "denied",
]);

export const moderationActionEnum = pgEnum("moderation_action", [
  "approved",
  "denied",
]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey(),
  content: text("content").notNull(),
  // Optional admin-edited version of content used for public display.
  editedContent: text("edited_content"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  deniedAt: timestamp("denied_at", { withTimezone: true }),
  moderationStatus: moderationStatusEnum("moderation_status")
    .default("pending")
    .notNull(),
  moderatedBy: text("moderated_by"),
  tags: text("tags").array(),
});

export const ingestionEvents = pgTable("ingestion_events", {
  id: uuid("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  query: jsonb("query").$type<Record<string, unknown>>().notNull(),
  headers: jsonb("headers").$type<Record<string, string>>().notNull(),
  body: text("body"),
  sourceIp: inet("source_ip"),
  userAgent: text("user_agent"),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  parsedMessage: text("parsed_message"),
  parseStatus: parseStatusEnum("parse_status").notNull(),
  messageId: uuid("message_id").references(() => messages.id),
});

export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id),
  action: moderationActionEnum("action").notNull(),
  actor: text("actor").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
