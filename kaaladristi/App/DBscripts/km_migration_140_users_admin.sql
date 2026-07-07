-- Migration 140: Users admin — suspension flag, login block, admin audit log
--
-- Feeds the admin-only Users page (/users):
--   1. km_profiles.is_suspended — admin can suspend a user; kd_auth_login
--      rejects suspended accounts at the NEXT login (an already-issued JWT
--      survives until it expires — accepted trade-off, owner 2026-07-07).
--   2. km_admin_audit — every admin action on a user (suspend/unsuspend,
--      plan reassignment, subscription extension, physical delete) is
--      recorded with who did it and to whom. Deletes especially: after a
--      physical delete this table is the only trace the account existed.
--
-- All admin writes go through FastAPI (/api/admin/users/*, psycopg2) with a
-- server-side role check — NOT PostgREST — so no new table grants beyond
-- the audit read for admins.

BEGIN;

-- 1. Suspension flag
ALTER TABLE km_profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- 2. Admin audit log
CREATE TABLE IF NOT EXISTS km_admin_audit (
    id              SERIAL PRIMARY KEY,
    admin_id        UUID NOT NULL,
    action          TEXT NOT NULL,          -- suspend | unsuspend | plan_reassign | extend_subscription | delete_user
    target_user_id  UUID,
    target_email    TEXT,
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_km_admin_audit_target ON km_admin_audit (target_user_id);

-- Lesson from migration 137: the JWT role claim is the PROFILE role.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'kd_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON km_admin_audit TO %I', r);
    END IF;
  END LOOP;
END $$;

-- 3. Patch kd_auth_login — reject suspended accounts.
--    Identical to the migration 096 version plus the is_suspended check.
CREATE OR REPLACE FUNCTION kd_auth_login(
    p_email text,
    p_password text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user         kd_users%ROWTYPE;
    v_token        text;
    v_profile_role text;
    v_full_name    text;
    v_suspended    boolean;
BEGIN
    SELECT * INTO v_user FROM kd_users WHERE email = lower(trim(p_email));

    IF v_user.id IS NULL THEN
        RETURN json_build_object('error', 'Invalid email or password');
    END IF;

    IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        RETURN json_build_object('error', 'Invalid email or password');
    END IF;

    SELECT role, full_name, COALESCE(is_suspended, false)
      INTO v_profile_role, v_full_name, v_suspended
    FROM km_profiles WHERE id = v_user.id;

    IF v_suspended THEN
        RETURN json_build_object('error', 'This account has been suspended. Please contact support.');
    END IF;

    v_token := kd_generate_token(v_user.id, v_user.email, COALESCE(v_profile_role, 'user'));

    RETURN json_build_object(
        'access_token', v_token,
        'user', json_build_object(
            'id', v_user.id,
            'email', v_user.email,
            'full_name', COALESCE(v_full_name, v_user.full_name),
            'role', COALESCE(v_profile_role, 'user')
        )
    );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
