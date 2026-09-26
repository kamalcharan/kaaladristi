-- ============================================================================
-- Migration 227 — security hotfix follow-up: RECORD of the manual changes
--                 applied on the live DB on 2026-09-26 as vikuna_admin,
--                 after migration 226.
-- Target DB: kaala_dristi_db
-- Rollback:  km_migration_227_security_hotfix_followup_rollback.sql
--
-- These changes are ALREADY LIVE. This file exists so the repo describes the
-- database, and so a rebuilt database converges to the same state. Every
-- statement is guarded, so re-running it is a no-op.
--
--   1. The `admin` role loses EXECUTE on the two JWT signers. After 226 the
--      only non-owner EXECUTE left on kd_generate_token / kd_sign_jwt was
--      `admin=X`. `admin` is a NOLOGIN, BYPASSRLS role; the PostgREST login
--      role (`vikuna_api`) was a member of it, so a request that could
--      `SET ROLE admin` could still mint a token for any user and any role.
--   2. `vikuna_api` (the PostgREST login role, per PGRST_DB_URI — not created
--      by any migration in this repo) is removed from `admin`. It keeps
--      membership of `anon` and `authenticated`, which are the only roles
--      PostgREST needs to switch into. Guarded on the role existing.
--   3. JWT secret rotation — RUNBOOK ONLY (commented, below). The secret is
--      never written into this repo.
--
-- Verified LIVE before this file was written (2026-09-26):
--   has_function_privilege('admin', 'kd_generate_token(uuid,text,text)', 'EXECUTE') = false
--   has_function_privilege('admin', 'kd_sign_jwt(json,text)', 'EXECUTE')            = false
--   pg_proc.proacl on both signers = {vikuna_admin=X/vikuna_admin} only
--   vikuna_api member of: anon, authenticated
--   admin has no members
-- ============================================================================

BEGIN;

-- ── 1. admin loses EXECUTE on the signers ─────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('admin', 'public.kd_generate_token(uuid, text, text)', 'EXECUTE') THEN
    REVOKE EXECUTE ON FUNCTION public.kd_generate_token(uuid, text, text) FROM admin;
    RAISE NOTICE '227: revoked EXECUTE on kd_generate_token from admin';
  ELSE
    RAISE NOTICE '227: admin already has no EXECUTE on kd_generate_token — skipped';
  END IF;

  IF has_function_privilege('admin', 'public.kd_sign_jwt(json, text)', 'EXECUTE') THEN
    REVOKE EXECUTE ON FUNCTION public.kd_sign_jwt(json, text) FROM admin;
    RAISE NOTICE '227: revoked EXECUTE on kd_sign_jwt from admin';
  ELSE
    RAISE NOTICE '227: admin already has no EXECUTE on kd_sign_jwt — skipped';
  END IF;
END $$;

-- ── 2. vikuna_api (PostgREST login role) leaves admin ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vikuna_api') THEN
    RAISE NOTICE '227: role vikuna_api does not exist on this cluster — skipped';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1
             FROM pg_auth_members m
             JOIN pg_roles g ON g.oid = m.roleid
             JOIN pg_roles r ON r.oid = m.member
             WHERE g.rolname = 'admin' AND r.rolname = 'vikuna_api') THEN
    REVOKE admin FROM vikuna_api;
    RAISE NOTICE '227: revoked admin from vikuna_api';
  ELSE
    RAISE NOTICE '227: vikuna_api is already not a member of admin — skipped';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- 3. JWT SECRET ROTATION — RUNBOOK (NOT EXECUTED BY THIS FILE)
-- ============================================================================
-- Applied via an ops script on 2026-09-26 (in progress at the time of
-- writing). The secret value lives ONLY in:
--   /opt/vikuna/docker/docker/.env               (JWT_SECRET — shared compose;
--                                                  PostgREST reads it as
--                                                  PGRST_JWT_SECRET: ${JWT_SECRET…})
--   /opt/vikuna/apps/kaaladristi/kaaladristi/.env (JWT_SECRET — kd-pipeline-api2,
--                                                  via docker-compose.yml:48)
-- and, for signing, ONE database-level GUC. Never in this repository.
--
-- Single source of truth for signing is now the DATABASE level. Before this,
-- the value was set at ROLE level for kd_app, anon, authenticated and
-- service_role (four copies), and a further stale copy sits in
-- postgresql.conf:865 — the cluster-level value is what a session with no
-- role-level override resolves, and it is PENDING REMOVAL. Until that line is
-- deleted, `SHOW app.jwt_secret` from a role with no DB- or role-level
-- override still returns the old value; the DB-level SET below overrides it
-- for every session in kaala_dristi_db.
--
-- Run with psql as vikuna_admin, passing the secret as a psql variable so it
-- never appears in a file or in shell history:
--
--   read -rs JWT_SECRET   # paste, no echo
--   psql "$DSN" -v s="$JWT_SECRET" <<'SQL'
--   ALTER DATABASE kaala_dristi_db SET app.jwt_secret TO :'s';
--   ALTER ROLE kd_app        RESET app.jwt_secret;
--   ALTER ROLE anon          RESET app.jwt_secret;
--   ALTER ROLE authenticated RESET app.jwt_secret;
--   ALTER ROLE service_role  RESET app.jwt_secret;
--   SQL
--   unset JWT_SECRET
--
-- Then restart vikuna-postgrest and kd-pipeline-api2 so PGRST_JWT_SECRET and
-- JWT_SECRET pick up the same value. Every issued session token (7-day exp)
-- stops verifying at that moment; users log in again.
--
-- Order matters: a window where kd_generate_token signs with one value and
-- PostgREST / FastAPI verify with another produces 401s on every request.
-- Apply the DB-level SET and both container restarts in one step.

-- ============================================================================
-- VERIFICATION (read-only; run after COMMIT; output is md5-masked, never raw)
-- ============================================================================
-- Expected:
--   admin_exec_kd_generate_token       = f
--   admin_exec_kd_sign_jwt             = f
--   signer_non_owner_acl_entries       = 0
--   vikuna_api_member_of               = anon,authenticated
--   role_level_app_jwt_secret_rows     = 0     (after rotation step 3)
--   db_level_app_jwt_secret_rows       = 1     (after rotation step 3)
--   db_level_app_jwt_secret_md5        = <32 hex chars> — compare against
--                                        printf %s "$JWT_SECRET" | md5sum
--                                        on the VPS; never print the value
--
-- SELECT 'admin_exec_kd_generate_token' AS check,
--        has_function_privilege('admin','public.kd_generate_token(uuid,text,text)','EXECUTE')::text AS value
-- UNION ALL
-- SELECT 'admin_exec_kd_sign_jwt',
--        has_function_privilege('admin','public.kd_sign_jwt(json,text)','EXECUTE')::text
-- UNION ALL
-- SELECT 'signer_non_owner_acl_entries',
--        (SELECT count(*)::text FROM pg_proc p, unnest(p.proacl) a
--          WHERE p.proname IN ('kd_generate_token','kd_sign_jwt')
--            AND a::text NOT LIKE 'vikuna_admin=%')
-- UNION ALL
-- SELECT 'vikuna_api_member_of',
--        coalesce((SELECT string_agg(g.rolname, ',' ORDER BY g.rolname)
--                    FROM pg_auth_members m
--                    JOIN pg_roles g ON g.oid = m.roleid
--                    JOIN pg_roles r ON r.oid = m.member
--                   WHERE r.rolname = 'vikuna_api'), '(role absent)')
-- UNION ALL
-- SELECT 'role_level_app_jwt_secret_rows',
--        (SELECT count(*)::text FROM pg_db_role_setting s
--           JOIN pg_roles r ON r.oid = s.setrole
--          WHERE r.rolname IN ('kd_app','anon','authenticated','service_role')
--            AND EXISTS (SELECT 1 FROM unnest(s.setconfig) c WHERE c LIKE 'app.jwt_secret=%'))
-- UNION ALL
-- SELECT 'db_level_app_jwt_secret_rows',
--        (SELECT count(*)::text FROM pg_db_role_setting s
--           JOIN pg_database d ON d.oid = s.setdatabase
--          WHERE d.datname = 'kaala_dristi_db' AND s.setrole = 0
--            AND EXISTS (SELECT 1 FROM unnest(s.setconfig) c WHERE c LIKE 'app.jwt_secret=%'))
-- UNION ALL
-- SELECT 'db_level_app_jwt_secret_md5',
--        coalesce((SELECT md5(split_part(c, '=', 2)) || ' (len ' || length(split_part(c, '=', 2)) || ')'
--                    FROM pg_db_role_setting s
--                    JOIN pg_database d ON d.oid = s.setdatabase,
--                         unnest(s.setconfig) c
--                   WHERE d.datname = 'kaala_dristi_db' AND s.setrole = 0
--                     AND c LIKE 'app.jwt_secret=%'
--                   LIMIT 1), '(none)');
