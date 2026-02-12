-- Replace temporal featured sets with a single pinned featured set.

ALTER TABLE "featured_sets" ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

-- Ensure at most one pinned set at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "featured_sets_single_pinned" ON "featured_sets" ("pinned")
  WHERE "pinned" = true;

-- Drop temporal window columns.
ALTER TABLE "featured_sets" DROP COLUMN IF EXISTS "starts_at";
ALTER TABLE "featured_sets" DROP COLUMN IF EXISTS "ends_at";
