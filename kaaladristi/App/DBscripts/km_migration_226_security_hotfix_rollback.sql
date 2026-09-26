-- ============================================================================
-- ROLLBACK for migration 226 — restores the LIVE ACL state measured on
-- 2026-09-26 before the hotfix. Target DB: kaala_dristi_db.
--
-- This re-opens every hole the hotfix closed (anon writes, PUBLIC EXECUTE on
-- the JWT signer, km_profiles readable by anon). Use only to recover from a
-- functional regression, then re-apply 226 once the regression is fixed.
--
-- Exactness note: five functions carried a NULL proacl before 226 (default
-- privileges: PUBLIC EXECUTE and nothing else). A NULL acl cannot be
-- recreated with GRANT; the statements below restore the same EFFECTIVE
-- privilege set (owner + PUBLIC) and remove the kd_app / authenticated
-- entries 226 added. `has_function_privilege()` answers identically.
-- ============================================================================

BEGIN;

-- ── 7. Default privileges back to PostgreSQL's default ────────────────────
ALTER DEFAULT PRIVILEGES FOR ROLE vikuna_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE kd_app IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- ── 6. user_subscriptions: original permissive policy back ────────────────
DROP POLICY IF EXISTS subscriptions_service_all ON public.user_subscriptions;
CREATE POLICY service_manage_subscriptions ON public.user_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- ── 5. km_profiles: drop the added policies, RLS off ──────────────────────
DROP POLICY IF EXISTS profiles_self_select     ON public.km_profiles;
DROP POLICY IF EXISTS profiles_app_all         ON public.km_profiles;
DROP POLICY IF EXISTS profiles_readonly_select ON public.km_profiles;
ALTER TABLE public.km_profiles DISABLE ROW LEVEL SECURITY;
-- The two pre-existing is_admin() policies were never dropped.

-- ── 4. anon SELECT back on the nine tables ────────────────────────────────
GRANT SELECT ON
  public.km_profiles,
  public.user_subscriptions,
  public.km_admin_audit,
  public.km_vani_cache,
  public.vani_observation_cache,
  public.vn_interaction_log,
  public.km_api_sessions,
  public.km_config,
  public.km_jobs
  TO anon;

-- ── 3. anon write privileges back, exactly as measured ────────────────────
GRANT ALL ON
  public.dc_inference,
  public.dc_lookup,
  public.dc_market_status,
  public.kd_vani_opportunity_config,
  public.km_api_sessions,
  public.km_index_symbols,
  public.km_trading_calendar,
  public.km_pipeline_runs,
  public.km_fii_dii,
  public.km_rule_inference
  TO anon;
GRANT INSERT, UPDATE ON public.km_equity_weekly, public.km_equity_monthly TO anon;

GRANT SELECT, USAGE ON SEQUENCE
  public.dc_inference_id_seq,
  public.dc_market_status_id_seq,
  public.kd_vani_opportunity_config_id_seq,
  public.km_api_sessions_id_seq,
  public.km_fii_dii_id_seq,
  public.km_pipeline_runs_id_seq,
  public.km_rule_inference_id_seq,
  public.km_score_calibration_id_seq
  TO anon;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.dc_lookup_id_seq TO anon;
GRANT USAGE ON SEQUENCE public.km_equity_weekly_id_seq, public.km_equity_monthly_id_seq TO anon;

-- ── 2. Function EXECUTE back ──────────────────────────────────────────────
-- (a) had PUBLIC + explicit anon before 226
GRANT EXECUTE ON FUNCTION
  public.compute_all_flow_intelligence(text, text, date, date),
  public.compute_all_index_returns(date),
  public.compute_all_industry_composites(date),
  public.compute_all_magic_rs(text, text, integer, date),
  public.compute_all_magic_rs_short(text, text, integer, date),
  public.compute_all_pending_indicators(text, text, date, date),
  public.compute_custom_index_eod(date, date, integer),
  public.compute_flow_intelligence(text, text, integer, date),
  public.compute_index_returns(integer, date),
  public.compute_indicators_batch(text, text, integer, date),
  public.compute_magic_rs_batch(text, text, integer, integer, date),
  public.compute_magic_rs_batch(text, text, integer, integer, date, text, text),
  public.evaluate_dc_inferences(text, numeric, numeric, integer)
  TO PUBLIC, anon;

-- (b) had PUBLIC only (no anon row) before 226
GRANT EXECUTE ON FUNCTION
  public.compute_astro_daily_signals(date, date),
  public.compute_index_breadth(date, date, integer),
  public.maintain_fpb_active(date),
  public.refresh_commodity_catalog(),
  public.refresh_equity_catalog(),
  public.refresh_index_catalog(),
  public.bulk_generate_snapshots(date, date, text[]),
  public.generate_daily_snapshots(date, date, text[]),
  public.handle_new_user()
  TO PUBLIC;

-- (c) had a NULL acl (default) before 226: restore PUBLIC, remove 226's adds
GRANT EXECUTE ON FUNCTION
  public.compute_all_index_scores(date),
  public.compute_custom_index_scores_scoped(integer, date),
  public.compute_magic_rs_momentum(text, date, date),
  public.km_invalidate_leadership_generation(),
  public.record_custom_membership_change()
  TO PUBLIC;
REVOKE EXECUTE ON FUNCTION
  public.compute_all_index_scores(date),
  public.compute_custom_index_scores_scoped(integer, date),
  public.compute_magic_rs_momentum(text, date, date),
  public.km_invalidate_leadership_generation(),
  public.record_custom_membership_change()
  FROM kd_app;
REVOKE EXECUTE ON FUNCTION
  public.km_invalidate_leadership_generation(),
  public.record_custom_membership_change()
  FROM authenticated;
-- kd_app grants 226 added on functions that had no kd_app row before:
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM kd_app;
-- (every other kd_app EXECUTE 226 granted already existed before 226 and is
--  left in place)

-- ── 1. JWT signers back to PUBLIC EXECUTE ─────────────────────────────────
GRANT EXECUTE ON FUNCTION public.kd_generate_token(uuid, text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.kd_sign_jwt(json, text) TO PUBLIC;
-- (anon and authenticated never held an explicit row on these two)

NOTIFY pgrst, 'reload schema';

COMMIT;
