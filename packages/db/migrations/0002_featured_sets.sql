CREATE TABLE IF NOT EXISTS "featured_sets" (
  "id" uuid PRIMARY KEY,
  "slug" text NOT NULL,
  "title" text,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "featured_set_messages" (
  "id" uuid PRIMARY KEY,
  "set_id" uuid NOT NULL REFERENCES "featured_sets"("id"),
  "message_id" uuid NOT NULL REFERENCES "messages"("id"),
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "featured_sets_starts_ends_idx" ON "featured_sets" ("starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "featured_set_messages_set_id_idx" ON "featured_set_messages" ("set_id");
CREATE INDEX IF NOT EXISTS "featured_set_messages_message_id_idx" ON "featured_set_messages" ("message_id");
