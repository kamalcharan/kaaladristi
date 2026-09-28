-- ============================================================================
-- Migration 232 — user_subscriptions: let a logged-in user read their OWN rows
-- ============================================================================
-- Target: kaala_dristi_db. One GRANT; holds no data; RLS unchanged.
--
-- The own-row policy has existed since the table did:
--   users_read_own_subscriptions  FOR SELECT  USING (user_id = jwt sub)
-- but `authenticated` — the DB role every logged-in browser runs as — never
-- held a table-level SELECT grant, so the policy was unreachable. Migration
-- 226 recorded exactly this ("the own-row policy has never been reachable and
-- services/auth.ts fails silently today") and deliberately left it out of the
-- hotfix. The frontend's profile load reads expires_at from this table right
-- after the login RPC, and PostgREST answered the missing grant with a bare
-- 401 (SQL state 42501). On 2026-09-28 the frontend started treating a 401 on
-- that read as a dead token, so every login on a rebuilt bundle went
-- sign-in → /setup → sign-out. The frontend now tells a token rejection from
-- a permission denial; this migration removes the denial.
--
-- RLS stays ON and the policy stays own-row, so the grant exposes nothing
-- beyond the caller's own subscription rows. No write grant: writes go
-- through kd_app (_activate_tier, admin extend, the 00:15 sweep).
--
-- Rollback:  REVOKE SELECT ON public.user_subscriptions FROM authenticated;
-- ============================================================================

BEGIN;

GRANT SELECT ON public.user_subscriptions TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify (role-independent — information_schema.role_table_grants is blind
-- over a restricted connection):
--   SELECT has_table_privilege('authenticated', 'public.user_subscriptions', 'SELECT');
--   SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'user_subscriptions';
