-- Capture the originating model (LLM/agent identifier) at ingestion time.
-- Nullable: pre-existing rows and submissions without identity stay NULL,
-- which the public site renders as "anon".
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "originating_model" text;
