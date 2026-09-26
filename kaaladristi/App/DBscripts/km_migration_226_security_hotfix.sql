-- ============================================================================
-- Migration 226 — security hotfix: close anon/PUBLIC access on the auth,
--                 pipeline and user-data surfaces reachable through PostgREST
-- Target DB: kaala_dristi_db
-- Rollback:  km_migration_226_security_hotfix_rollback.sql (same directory)
-- ============================================================================
--
-- WHAT THIS CLOSES (all measured LIVE on 2026-09-26 via pg_proc.proacl /
-- pg_class.relacl, not from migration text — the two disagree, see the audit):
--
--   1. kd_generate_token(uuid,text,text) and kd_sign_jwt(json,text) carried
--      PostgreSQL's default `=X` (PUBLIC EXECUTE). Through /db/rpc/ any caller,
--      including the anon role, could mint an HS256 session token for ANY
--      user id and ANY role using current_setting('app.jwt_secret'), which is
--      set at ROLE level for anon/authenticated/kd_app/service_role.
--   2. Every compute_* / refresh_*_catalog / maintain_fpb_active /
--      compute_index_breadth / snapshot / trigger function was executable by
--      PUBLIC (and most by anon explicitly) — heavy UPDATEs on km_equity_eod
--      and km_index_eod callable unauthenticated.
--   3. anon held INSERT/UPDATE/DELETE (arwdDxtm) on km_index_symbols,
--      km_trading_calendar, km_pipeline_runs, km_fii_dii, km_rule_inference,
--      km_api_sessions, dc_inference, dc_lookup, dc_market_status,
--      kd_vani_opportunity_config, and INSERT/UPDATE on km_equity_weekly and
--      km_equity_monthly, plus USAGE on their sequences.
--   4. anon held SELECT on km_profiles (RLS OFF — every email/phone/tier/role
--      row), user_subscriptions (RLS ON but a `USING (true)` policy),
--      km_admin_audit, km_vani_cache, vani_observation_cache,
--      vn_interaction_log, km_api_sessions, km_config, km_jobs.
--   5. No `ALTER DEFAULT PRIVILEGES` existed, so every future function would
--      ship with PUBLIC EXECUTE again.
--
-- WHAT THIS DELIBERATELY DOES NOT TOUCH:
--   * anon SELECT on market-data tables (km_equity_eod, km_index_eod,
--     km_scan_results, breadth, industry, filings, astro, rules …).
--   * The `admin` role's explicit EXECUTE grants (it has BYPASSRLS and is
--     not a PostgREST-reachable role; the frontend runs as `authenticated`).
--   * authenticated's explicit EXECUTE on refresh_*_catalog,
--     evaluate_dc_inferences, kd_result_returns, kd_update_profile,
--     kd_auth_change_password — the frontend calls these as a logged-in user.
--   * anon EXECUTE on kd_auth_login / kd_auth_register /
--     kd_auth_forgot_password / kd_auth_reset_password — the login flow.
--   * user_frameworks / km_user_bookmarks / km_ux_events anon SELECT: the
--     sub-keyed RLS policies already return 0 rows to anon. Candidates for a
--     follow-up, not this hotfix.
--
-- WHY THE AUTH FUNCTIONS KEEP WORKING:
--   kd_auth_login and kd_auth_register are SECURITY DEFINER, owned by
--   vikuna_admin (superuser). They call kd_generate_token as the owner, whose
--   own `vikuna_admin=X` ACL entry is untouched by REVOKE ... FROM PUBLIC.
--   Verified LIVE: only those two pg_proc bodies reference kd_generate_token;
--   only kd_generate_token references kd_sign_jwt; no backend or frontend
--   code calls either by name.
--
-- WHY kd_app NEEDS RLS POLICIES:
--   kd_app (the FastAPI + worker + scheduler role) has rolbypassrls = false
--   and owns nothing; enabling RLS on km_profiles without a kd_app policy
--   would blank _require_admin(), the admin user list, the framework tier
--   join and the 00:15 tier-expiry sweep. Same for user_subscriptions, whose
--   writers (_activate_tier, admin extend, the sweep) all run as kd_app.
--
-- Run in pgAdmin as vikuna_admin. Verification queries at the tail.
-- ============================================================================

BEGIN;

-- ── 1. JWT minting ─────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.kd_generate_token(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kd_sign_jwt(json, text)
  FROM PUBLIC, anon, authenticated;

-- ── 2. Pipeline / maintenance functions: PUBLIC and anon out, kd_app in ────
-- Exact identity signatures from pg_get_function_identity_arguments (LIVE).
REVOKE EXECUTE ON FUNCTION
  public.compute_all_flow_intelligence(text, text, date, date),
  public.compute_all_index_returns(date),
  public.compute_all_index_scores(date),
  public.compute_all_industry_composites(date),
  public.compute_all_magic_rs(text, text, integer, date),
  public.compute_all_magic_rs_short(text, text, integer, date),
  public.compute_all_pending_indicators(text, text, date, date),
  public.compute_astro_daily_signals(date, date),
  public.compute_custom_index_eod(date, date, integer),
  public.compute_custom_index_scores_scoped(integer, date),
  public.compute_flow_intelligence(text, text, integer, date),
  public.compute_index_breadth(date, date, integer),
  public.compute_index_returns(integer, date),
  public.compute_indicators_batch(text, text, integer, date),
  public.compute_magic_rs_batch(text, text, integer, integer, date),
  public.compute_magic_rs_batch(text, text, integer, integer, date, text, text),
  public.compute_magic_rs_momentum(text, date, date),
  public.refresh_commodity_catalog(),
  public.refresh_equity_catalog(),
  public.refresh_index_catalog(),
  public.maintain_fpb_active(date),
  public.bulk_generate_snapshots(date, date, text[]),
  public.generate_daily_snapshots(date, date, text[]),
  public.evaluate_dc_inferences(text, numeric, numeric, integer),
  public.km_invalidate_leadership_generation(),
  public.record_custom_membership_change(),
  public.handle_new_user()
  FROM PUBLIC, anon;

-- Re-grant to the pipeline role. Every compute_* is called by pipeline2
-- handlers (_rpc(conn, ...)), scripts/compute_custom_index_eod.py, or the
-- FastAPI /api/custom-index/{id}/compute endpoint, all connecting as kd_app.
-- The three functions that carried a NULL acl (default PUBLIC only) had NO
-- kd_app entry at all and would otherwise be unreachable after the revoke.
GRANT EXECUTE ON FUNCTION
  public.compute_all_flow_intelligence(text, text, date, date),
  public.compute_all_index_returns(date),
  public.compute_all_index_scores(date),
  public.compute_all_industry_composites(date),
  public.compute_all_magic_rs(text, text, integer, date),
  public.compute_all_magic_rs_short(text, text, integer, date),
  public.compute_all_pending_indicators(text, text, date, date),
  public.compute_astro_daily_signals(date, date),
  public.compute_custom_index_eod(date, date, integer),
  public.compute_custom_index_scores_scoped(integer, date),
  public.compute_flow_intelligence(text, text, integer, date),
  public.compute_index_breadth(date, date, integer),
  public.compute_index_returns(integer, date),
  public.compute_indicators_batch(text, text, integer, date),
  public.compute_magic_rs_batch(text, text, integer, integer, date),
  public.compute_magic_rs_batch(text, text, integer, integer, date, text, text),
  public.compute_magic_rs_momentum(text, date, date),
  public.refresh_index_catalog(),
  public.maintain_fpb_active(date)
  TO kd_app;

-- Trigger functions. PostgreSQL checks EXECUTE at CREATE TRIGGER time, not
-- when the trigger fires, so this grant is belt-and-braces for the roles
-- that write the triggering tables: kd_app (pipeline, custom-index compute
-- endpoint) and authenticated (admin saves of km_index_constituents /
-- km_index_symbols through PostgREST — migration 148).
GRANT EXECUTE ON FUNCTION
  public.km_invalidate_leadership_generation(),
  public.record_custom_membership_change()
  TO kd_app, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO kd_app;

-- ── 3. anon loses every write privilege in the schema ─────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;
-- Sequences are the other half of INSERT capability (nextval needs USAGE).
-- LIVE: anon holds USAGE on 11 *_id_seq sequences.
REVOKE USAGE, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ── 4. anon loses SELECT on user, cache, ops and config tables ────────────
REVOKE SELECT ON
  public.km_profiles,
  public.user_subscriptions,
  public.km_admin_audit,
  public.km_vani_cache,
  public.vani_observation_cache,
  public.vn_interaction_log,
  public.km_api_sessions,
  public.km_config,
  public.km_jobs
  FROM anon;

-- ── 5. km_profiles: turn RLS on and add the policies that were missing ────
-- LIVE state before this migration: relrowsecurity = false; only two
-- policies exist ("Admins can read all profiles" / "Admins can update any
-- profile", both USING is_admin()). The own-row policies written in
-- km_profiles.sql:58-66 are NOT present on the live database.
ALTER TABLE public.km_profiles ENABLE ROW LEVEL SECURITY;

-- Logged-in user reads own row (services/auth.ts:171). SELECT only: profile
-- writes go through the SECURITY DEFINER kd_update_profile(jsonb) RPC, whose
-- whitelist excludes tier / role / is_suspended. authenticated holds `w` on
-- km_profiles, so WITHOUT an UPDATE policy a direct PATCH now returns 0 rows
-- instead of letting a user edit their own tier.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'km_profiles'
                   AND policyname = 'profiles_self_select') THEN
    CREATE POLICY profiles_self_select ON public.km_profiles
      FOR SELECT TO authenticated
      USING (id = ((current_setting('request.jwt.claims', true)::json ->> 'sub'))::uuid);
  END IF;

  -- Application role (FastAPI, worker, scheduler): _require_admin,
  -- /api/admin/users*, the framework tier join, _tier_expiry_sweep.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'km_profiles'
                   AND policyname = 'profiles_app_all') THEN
    CREATE POLICY profiles_app_all ON public.km_profiles
      FOR ALL TO kd_app, service_role
      USING (true) WITH CHECK (true);
  END IF;

  -- Read-only audit role used by the kaala-postgres MCP. Drop this policy if
  -- the audit role should not see profile rows.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'km_profiles'
                   AND policyname = 'profiles_readonly_select') THEN
    CREATE POLICY profiles_readonly_select ON public.km_profiles
      FOR SELECT TO kd_readonly USING (true);
  END IF;
END $$;
-- `admin` (BYPASSRLS) and vikuna_admin (superuser) are unaffected. The two
-- existing is_admin() policies stay: is_admin() is SECURITY DEFINER and reads
-- km_profiles as the owner, so there is no policy recursion.

-- ── 6. user_subscriptions: replace the USING (true) policy ────────────────
DROP POLICY IF EXISTS service_manage_subscriptions ON public.user_subscriptions;
CREATE POLICY subscriptions_service_all ON public.user_subscriptions
  FOR ALL TO service_role, kd_app
  USING (true) WITH CHECK (true);
-- users_read_own_subscriptions (SELECT, sub = user_id) is kept as is.
-- NOTE, not changed here: `authenticated` has NO table grant on
-- user_subscriptions (LIVE relacl: anon, kd_app, admin, kd_readonly only), so
-- the own-row policy has never been reachable and services/auth.ts:186 fails
-- silently today (its error is discarded). Granting SELECT to authenticated
-- is a functional change and is left out of this hotfix.

-- ── 7. Stop the default PUBLIC EXECUTE on future functions ────────────────
-- Default privileges are per creating role. Functions here are created by
-- vikuna_admin (every migration) and, for pipeline-created objects, kd_app.
ALTER DEFAULT PRIVILEGES FOR ROLE vikuna_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE kd_app IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- PostgREST caches privileges with its schema cache.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- VERIFICATION (read-only; run after COMMIT)
-- ============================================================================
-- 1. No PUBLIC or anon EXECUTE left on the two signers:
--   SELECT proname, array_to_string(proacl,' ') FROM pg_proc
--   WHERE proname IN ('kd_generate_token','kd_sign_jwt');
--   -- expect only vikuna_admin=X and admin=X
-- 2. No anon write privilege anywhere:
--   SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace
--     AND EXISTS (SELECT 1 FROM unnest(relacl) a
--                 WHERE a::text ~ '^anon=[^/]*[awdDxtm]');
--   -- expect 0 rows
-- 3. anon still reads market data:
--   SELECT has_table_privilege('anon','km_equity_eod','SELECT'),
--          has_table_privilege('anon','km_scan_results','SELECT'),
--          has_table_privilege('anon','km_profiles','SELECT');   -- t, t, f
-- 4. km_profiles RLS + policies:
--   SELECT relrowsecurity FROM pg_class WHERE relname='km_profiles';  -- t
--   SELECT policyname, roles, cmd FROM pg_policies WHERE tablename='km_profiles';
-- 5. Login still works (SECURITY DEFINER path):
--   SET ROLE anon; SELECT kd_auth_login('<known email>','<password>'); RESET ROLE;
-- 6. Pipeline role can still call the compute chain:
--   SELECT has_function_privilege('kd_app','compute_all_index_scores(date)','EXECUTE');  -- t
--   SELECT has_function_privilege('anon','compute_all_index_scores(date)','EXECUTE');    -- f
-- 7. Minting is closed for the PostgREST roles:
--   SELECT has_function_privilege('anon','kd_generate_token(uuid,text,text)','EXECUTE'),
--          has_function_privilege('authenticated','kd_generate_token(uuid,text,text)','EXECUTE');  -- f, f
