-- ============================================================================
-- ROLLBACK for migration 227 — restores the state between 226 and 227:
--   * admin regains EXECUTE on kd_generate_token / kd_sign_jwt
--   * vikuna_api regains membership of admin (only if that role exists)
-- Target DB: kaala_dristi_db. Idempotent: re-running is a no-op.
--
-- No secret handling here. The JWT-secret rotation (227 §3) is an ops
-- runbook, not a migration step, and is not reversed by this file.
--
-- Re-opening these re-creates the hole 227 closed: a PostgREST request that
-- can SET ROLE admin could mint a session token for any user and any role.
-- ============================================================================

BEGIN;

-- ── 2. vikuna_api back into admin ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vikuna_api') THEN
    RAISE NOTICE '227-rollback: role vikuna_api does not exist — skipped';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1
                 FROM pg_auth_members m
                 JOIN pg_roles g ON g.oid = m.roleid
                 JOIN pg_roles r ON r.oid = m.member
                 WHERE g.rolname = 'admin' AND r.rolname = 'vikuna_api') THEN
    GRANT admin TO vikuna_api;
    RAISE NOTICE '227-rollback: granted admin to vikuna_api';
  ELSE
    RAISE NOTICE '227-rollback: vikuna_api already a member of admin — skipped';
  END IF;
END $$;

-- ── 1. admin regains EXECUTE on the signers ───────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege('admin', 'public.kd_generate_token(uuid, text, text)', 'EXECUTE') THEN
    GRANT EXECUTE ON FUNCTION public.kd_generate_token(uuid, text, text) TO admin;
    RAISE NOTICE '227-rollback: granted EXECUTE on kd_generate_token to admin';
  ELSE
    RAISE NOTICE '227-rollback: admin already has EXECUTE on kd_generate_token — skipped';
  END IF;

  IF NOT has_function_privilege('admin', 'public.kd_sign_jwt(json, text)', 'EXECUTE') THEN
    GRANT EXECUTE ON FUNCTION public.kd_sign_jwt(json, text) TO admin;
    RAISE NOTICE '227-rollback: granted EXECUTE on kd_sign_jwt to admin';
  ELSE
    RAISE NOTICE '227-rollback: admin already has EXECUTE on kd_sign_jwt — skipped';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
