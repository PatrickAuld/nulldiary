-- Layer 3 launch-week visibility: capture page views server-side so the launch
-- dashboard can surface top referrers alongside submission metrics.
-- 60-day retention (cleaned by /api/cron/cleanup-page-views).
CREATE TABLE IF NOT EXISTS "page_views" (
  "id" uuid PRIMARY KEY,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "path" text NOT NULL,
  "referer" text,
  "ua_class" text,
  "host" text
);

CREATE INDEX IF NOT EXISTS "page_views_received_at_idx"
  ON "page_views" ("received_at" DESC);

CREATE INDEX IF NOT EXISTS "page_views_host_received_at_idx"
  ON "page_views" ("host", "received_at" DESC);
