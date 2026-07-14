-- Migration 149: auth.* compatibility shim for self-hosted PostgREST
--
-- THE MISSING PIECE (root-caused 2026-07-14):
-- This project's RLS layer was written in the Supabase idiom — policies and the
-- public.is_admin() helper call auth.uid() / auth.role() / auth.jwt(). Those
-- functions live in Supabase's `auth` schema, which is created by Supabase's
-- platform. This deployment is SELF-HOSTED PostgreSQL + PostgREST, where that
-- schema does not exist and was never shimmed:
--
--   * 8 migration files REFERENCE auth.uid()/auth.role()/auth.jwt()
--   * ZERO migrations DEFINE them
--   * `SELECT nspname FROM pg_namespace WHERE nspname='auth'` returns nothing
--
-- Consequence: any policy expression that reaches auth.uid() ERRORS at
-- evaluation ("schema auth does not exist"). public.is_admin() —
--   SELECT EXISTS(SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role='admin')
-- is therefore broken, so EVERY is_admin()-based write policy is broken. This
-- has been masked because (a) most data tables have RLS DISABLED, and (b) admin
-- writes normally go through the FastAPI backend as the kd_app role. It surfaces
-- on km_index_constituents — the rare table with RLS ENABLED and an is_admin()
-- write policy (idx_const_write) — which the custom-index create/manage pages
-- write to directly via PostgREST (as DB role `authenticated`). Result:
-- "permission denied for table km_index_constituents" (the missing GRANT, fixed
-- in migration 148), and BEHIND it the is_admin() evaluation error.
--
-- THE FIX: define the `auth` shim over PostgREST's per-request GUC
-- `request.jwt.claims` — the exact mechanism the working kd_update_profile /
-- kd_auth_login functions already use. kd_generate_token signs claims
-- {sub, role, email, iss, iat, exp}; sub = user id, role = 'authenticated'.
--
-- All functions are null-safe: with no JWT (internal/backend queries) they
-- return NULL rather than raising, so RLS simply denies instead of erroring.
--
-- Blast radius (enumerated against live pg_policies, 2026-07-14): 14 policies
-- reference is_admin()/auth.*, but only ONE sits on a table with RLS ENABLED —
-- km_index_constituents (idx_const_write). Every other is_admin() policy
-- (km_equity_eod, km_index_symbols, km_profiles, km_commodity_*, km_industry_eod,
-- …) is on a table with RLS DISABLED, so those policies are dormant and this
-- shim does not change their behavior at all. The only observable effect is on
-- km_index_constituents: is_admin() stops erroring and starts evaluating
-- correctly (true for admins, false otherwise). No path that works today reaches
-- an erroring auth.* call, so nothing regresses; admins gain the constituent
-- writes they were always intended to have, and non-admins stay denied.
--
-- NOTE (separate, pre-existing — NOT addressed here): the many tables above with
-- RLS DISABLED but authenticated holding write grants (e.g. km_index_symbols)
-- currently have no row-level write protection. Hardening those is a distinct
-- decision (enable RLS + verify each policy) and is intentionally out of scope.
--
-- Target database: kaala_dristi_db

BEGIN;

CREATE SCHEMA IF NOT EXISTS auth;

-- Caller's user id (JWT `sub`). NULL when unauthenticated.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

-- Caller's JWT role claim (always 'authenticated' on this deployment).
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'role', '');
$$;

-- Caller's email claim.
CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'email', '');
$$;

-- Full claims object. Empty object when unauthenticated.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- Every DB role that runs PostgREST requests must be able to call these from
-- within policy expressions.
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid()   TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.role()  TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.email() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.jwt()   TO PUBLIC;

NOTIFY pgrst, 'reload schema';

COMMIT;
