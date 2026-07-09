-- Migration 144: create the missing "user" DB role  ← REAL ROOT CAUSE
--
-- Symptom (reported 2026-07-09): Sector Rotation → Constituents / Flow Map
-- (and any other PostgREST-direct page) fail for logged-in NON-admin users
-- with permission/role errors, while admin sees everything.
--
-- Actual root cause (deeper than the missing-grant theory behind migrations
-- 137 / 142 / 143):
--   * km_profiles.role is NOT NULL DEFAULT 'user' — every regular account
--     has role = 'user'.
--   * kd_auth_login (migration 096, latest form in migration 140) stamps the
--     JWT with role = COALESCE(profile.role, 'user') → 'user' for non-admins.
--   * PostgREST reads that claim and executes each request as DB role "user"
--     (SET ROLE "user").
--   * BUT the "user" DB role was NEVER created — no CREATE ROLE exists in any
--     migration, and 'SELECT ... has_table_privilege(''user'', ...)' errors
--     with 'role "user" does not exist' on the live DB.
--   => Every PostgREST request from a logged-in non-admin fails. The 'admin'
--      role exists (created manually on the VPS), so admin works. Pages fed
--      by the FastAPI backend (:8101, direct psycopg2, no role-switching)
--      work for everyone; only PostgREST-direct reads break for non-admins.
--
-- Consequence: migrations 137 / 142 / 143 that GRANT ... TO "user" were all
-- guarded with IF EXISTS (pg_roles WHERE rolname='user') and therefore did
-- NOTHING. Creating the role here is what actually fixes it — and because we
-- make "user" a member of 'authenticated', it inherits every current AND
-- future SELECT/EXECUTE/USAGE grant that 'authenticated' has, permanently
-- closing the "forgot to grant the user role" bug class.
--
-- Design: "user" is a NOLOGIN switch role that mirrors a logged-in user by
-- being a member of 'authenticated' (INHERIT). PostgREST's 'authenticator'
-- is granted membership in "user" so it can SET ROLE into it. SELECT-only
-- posture is inherited from 'authenticated'; admin-gated writes stay gated by
-- the JWT-claim RLS policies (which compare the claim to 'admin', not the DB
-- role) and by direct admin-only grants.
--
-- Idempotent + guarded on role existence. Run in pgAdmin/psql as vikuna_admin
-- (needs CREATEROLE / role-admin rights) against kaala_dristi_db.

BEGIN;

-- 1. Create the switch role PostgREST assumes for logged-in non-admin users.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'user') THEN
    CREATE ROLE "user" NOLOGIN INHERIT;
  END IF;
END $$;

-- 2. Inherit a logged-in user's privileges: everything 'authenticated' has,
--    now and in the future.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT authenticated TO "user"';
  END IF;
END $$;

-- 3. Let PostgREST's authenticator SET ROLE into "user". Without this the
--    switch itself is denied even though the role now exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'GRANT "user" TO authenticator';
  END IF;
END $$;

-- 4. Schema usage (defensive — already inherited via 'authenticated').
GRANT USAGE ON SCHEMA public TO "user";

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verify after running ──────────────────────────────────────────────────
-- Role now exists and is wired up:
--   SELECT rolname FROM pg_roles WHERE rolname = 'user';
--   SELECT r.rolname AS member, g.rolname AS member_of
--   FROM pg_auth_members m
--   JOIN pg_roles r ON r.oid = m.member
--   JOIN pg_roles g ON g.oid = m.roleid
--   WHERE r.rolname IN ('user','authenticator');
-- Effective read access (should be TRUE, no error):
--   SELECT has_table_privilege('user', 'public.km_index_constituents', 'SELECT');
