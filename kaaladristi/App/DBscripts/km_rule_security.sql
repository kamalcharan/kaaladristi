-- ============================================================================
-- km_rule_security.sql — Lock down rule engine tables to admin-only writes
-- ============================================================================
-- PROBLEM: km_rules, km_rule_signals, km_candidate_rules currently allow
--   INSERT/UPDATE/DELETE for ANY authenticated user. At 2000+ users, any
--   user could corrupt the rule engine data.
--
-- FIX: Replace permissive write policies with admin-only checks via
--   public.is_admin() SECURITY DEFINER function (created in km_fix_rls_recursion.sql).
-- ============================================================================

-- ── km_rules ──
DROP POLICY IF EXISTS "allow_insert_rules" ON km_rules;
DROP POLICY IF EXISTS "allow_update_rules" ON km_rules;
DROP POLICY IF EXISTS "allow_delete_rules" ON km_rules;

CREATE POLICY "admin_insert_rules" ON km_rules
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_rules" ON km_rules
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_rules" ON km_rules
  FOR DELETE USING (public.is_admin());

-- ── km_rule_signals ──
DROP POLICY IF EXISTS "allow_insert_rule_signals" ON km_rule_signals;
DROP POLICY IF EXISTS "allow_update_rule_signals" ON km_rule_signals;
DROP POLICY IF EXISTS "allow_delete_rule_signals" ON km_rule_signals;

CREATE POLICY "admin_insert_rule_signals" ON km_rule_signals
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_rule_signals" ON km_rule_signals
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_rule_signals" ON km_rule_signals
  FOR DELETE USING (public.is_admin());

-- ── km_candidate_rules ──
DROP POLICY IF EXISTS "allow_insert_candidate_rules" ON km_candidate_rules;
DROP POLICY IF EXISTS "allow_update_candidate_rules" ON km_candidate_rules;
DROP POLICY IF EXISTS "allow_delete_candidate_rules" ON km_candidate_rules;

CREATE POLICY "admin_insert_candidate_rules" ON km_candidate_rules
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_candidate_rules" ON km_candidate_rules
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_candidate_rules" ON km_candidate_rules
  FOR DELETE USING (public.is_admin());
