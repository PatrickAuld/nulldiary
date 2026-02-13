-- Add short, shareable IDs for public message URLs.
--
-- We keep these nullable so we can backfill progressively.
-- Application code should generate on insert (and can lazily generate on-demand).

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "short_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "messages_short_id_unique" ON "messages" ("short_id")
  WHERE "short_id" IS NOT NULL;
