ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "normalized_content" text,
  ADD COLUMN IF NOT EXISTS "content_hash" text;

CREATE INDEX IF NOT EXISTS "messages_content_hash_idx"
  ON "messages" ("content_hash")
  WHERE "content_hash" IS NOT NULL;
