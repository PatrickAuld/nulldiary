-- Enable Row Level Security (RLS) + baseline policies.
--
-- Notes:
-- - The service role key bypasses RLS; server-side code using SUPABASE_SERVICE_ROLE_KEY
--   will continue to work.
-- - These policies are intended to make the DB safe-by-default if any anon/authenticated
--   clients are introduced later.

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL UNIQUE,
  "email" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- RLS ON
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingestion_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "moderation_actions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.featured_sets') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "featured_sets" ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.featured_set_messages') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "featured_set_messages" ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Admin membership: allow authenticated users to see their own admin_users row.
DROP POLICY IF EXISTS "admin_users_select_self" ON "admin_users";
CREATE POLICY "admin_users_select_self" ON "admin_users"
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Public reads: allow anon to read approved messages.
DROP POLICY IF EXISTS "messages_select_approved_anon" ON "messages";
CREATE POLICY "messages_select_approved_anon" ON "messages"
  FOR SELECT
  TO anon
  USING (moderation_status = 'approved');

-- Admin access: authenticated users who are listed in admin_users can do anything.
-- Messages
DROP POLICY IF EXISTS "messages_admin_all" ON "messages";
CREATE POLICY "messages_admin_all" ON "messages"
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));

-- Ingestion events
DROP POLICY IF EXISTS "ingestion_events_admin_all" ON "ingestion_events";
CREATE POLICY "ingestion_events_admin_all" ON "ingestion_events"
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));

-- Moderation actions
DROP POLICY IF EXISTS "moderation_actions_admin_all" ON "moderation_actions";
CREATE POLICY "moderation_actions_admin_all" ON "moderation_actions"
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));

-- Featured sets (if present)
DO $$ BEGIN
  IF to_regclass('public.featured_sets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "featured_sets_admin_all" ON "featured_sets"';
    EXECUTE 'CREATE POLICY "featured_sets_admin_all" ON "featured_sets"'
      || ' FOR ALL TO authenticated'
      || ' USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))'
      || ' WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))';
  END IF;
END $$;

-- Featured set messages (if present)
DO $$ BEGIN
  IF to_regclass('public.featured_set_messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "featured_set_messages_admin_all" ON "featured_set_messages"';
    EXECUTE 'CREATE POLICY "featured_set_messages_admin_all" ON "featured_set_messages"'
      || ' FOR ALL TO authenticated'
      || ' USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))'
      || ' WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))';
  END IF;
END $$;
