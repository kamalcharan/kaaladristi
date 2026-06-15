-- Migration 096: Allow admin users to update km_astro_rule_master via PostgREST
-- Target DB: kaala_dristi_db
--
-- Problem: authenticated role only has SELECT on km_astro_rule_master (migration 051).
-- Admin users need UPDATE access for Rule Engine UI (toggle is_active, catalog_visible,
-- insert new rules, soft-delete). Uses self-hosted PostgREST JWT claims pattern.

BEGIN;

-- 1. Grant write privileges to authenticated role
GRANT INSERT, UPDATE, DELETE ON km_astro_rule_master TO authenticated;

-- 2. Enable RLS
ALTER TABLE km_astro_rule_master ENABLE ROW LEVEL SECURITY;

-- 3. SELECT — open to everyone (no change in behaviour)
CREATE POLICY "astro_rule_select_all"
  ON km_astro_rule_master
  FOR SELECT
  USING (true);

-- 4. INSERT — admin only (role claim in JWT)
CREATE POLICY "astro_rule_insert_admin"
  ON km_astro_rule_master
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- 5. UPDATE — admin only
CREATE POLICY "astro_rule_update_admin"
  ON km_astro_rule_master
  FOR UPDATE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- 6. DELETE — admin only
CREATE POLICY "astro_rule_delete_admin"
  ON km_astro_rule_master
  FOR DELETE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- 7. kd_app (backend pipeline) bypasses RLS so daily scripts are unaffected.
--    Run this line as a PostgreSQL superuser if kd_app is not already a superuser:
--    ALTER ROLE kd_app BYPASSRLS;

COMMIT;
