-- Migration 096: Allow admin users to update km_astro_rule_master via PostgREST
-- Target DB: kaala_dristi_db
--
-- Problem: authenticated role only has SELECT on km_astro_rule_master (migration 051).
-- Admin users need UPDATE access for Rule Engine UI (toggle is_active, catalog_visible,
-- and future inline edits). We enable RLS and add an admin-only UPDATE policy.
--
-- SELECT remains unrestricted (all authenticated + anon can read).

BEGIN;

-- 1. Grant UPDATE to authenticated so PostgREST can attempt the call
GRANT UPDATE ON km_astro_rule_master TO authenticated;

-- 2. Grant INSERT/DELETE to authenticated (needed for Add Rule + soft delete from UI)
GRANT INSERT, DELETE ON km_astro_rule_master TO authenticated;

-- 3. Enable RLS on the table
ALTER TABLE km_astro_rule_master ENABLE ROW LEVEL SECURITY;

-- 4. SELECT policy — everyone can read (matches current behaviour)
CREATE POLICY "astro_rule_select_all"
  ON km_astro_rule_master
  FOR SELECT
  USING (true);

-- 5. INSERT policy — admin only
CREATE POLICY "astro_rule_insert_admin"
  ON km_astro_rule_master
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. UPDATE policy — admin only
CREATE POLICY "astro_rule_update_admin"
  ON km_astro_rule_master
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. DELETE policy — admin only (soft-delete uses UPDATE, but guard hard-delete too)
CREATE POLICY "astro_rule_delete_admin"
  ON km_astro_rule_master
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 8. kd_app role bypasses RLS (backend pipeline can always write)
ALTER TABLE km_astro_rule_master FORCE ROW LEVEL SECURITY;
GRANT ALL ON km_astro_rule_master TO kd_app;
-- kd_app is a superuser-equivalent for this table; bypass RLS so pipeline is unaffected
-- (if kd_app is not a superuser, add: ALTER ROLE kd_app BYPASSRLS; -- run as superuser)

COMMIT;
