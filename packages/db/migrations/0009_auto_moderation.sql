-- Auto-moderation funnel: scoring columns on messages, parse_status='rate_limited',
-- and per-IP sliding-window rate-limit buckets.

-- Extend parse_status enum.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'rate_limited'
      AND enumtypid = 'parse_status'::regtype
  ) THEN
    ALTER TYPE parse_status ADD VALUE 'rate_limited';
  END IF;
END $$;

-- Scoring columns on messages.
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "risk_score" real,
  ADD COLUMN IF NOT EXISTS "risk_labels" jsonb,
  ADD COLUMN IF NOT EXISTS "auto_action" text,
  ADD COLUMN IF NOT EXISTS "auto_action_reason" text,
  ADD COLUMN IF NOT EXISTS "scored_at" timestamptz;

-- Speeds up the scoring worker's "find unscored pending" scan.
CREATE INDEX IF NOT EXISTS "messages_unscored_pending_idx"
  ON "messages" ("created_at")
  WHERE "moderation_status" = 'pending' AND "scored_at" IS NULL;

-- Per-IP buckets for sliding-window rate limiting.
CREATE TABLE IF NOT EXISTS "ingestion_rate_buckets" (
  "source_ip" inet NOT NULL,
  "bucket_at" timestamptz NOT NULL,
  "count" int NOT NULL DEFAULT 0,
  PRIMARY KEY ("source_ip", "bucket_at")
);

-- Supports periodic GC of old buckets.
CREATE INDEX IF NOT EXISTS "ingestion_rate_buckets_bucket_at_idx"
  ON "ingestion_rate_buckets" ("bucket_at");

-- Atomic per-bucket increment. Avoids read-modify-write races between
-- concurrent ingestion requests.
CREATE OR REPLACE FUNCTION ingestion_rate_bucket_increment(
  p_ip inet,
  p_bucket_at timestamptz,
  p_inc int
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO ingestion_rate_buckets (source_ip, bucket_at, count)
  VALUES (p_ip, p_bucket_at, p_inc)
  ON CONFLICT (source_ip, bucket_at)
    DO UPDATE SET count = ingestion_rate_buckets.count + EXCLUDED.count;
$$;

REVOKE EXECUTE ON FUNCTION ingestion_rate_bucket_increment(inet, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingestion_rate_bucket_increment(inet, timestamptz, int) TO service_role;
