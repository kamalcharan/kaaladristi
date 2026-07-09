-- Migration 144: Restore `authenticated` as the JWT role for all logged-in users
-- Run on kaala_dristi_db.
--
-- WHY
-- ---
-- Migrations 096 and 140 changed kd_auth_login to embed the PROFILE role
-- (km_profiles.role — e.g. 'user') as the JWT `role` claim. But this deployment
-- was built for everyone to run as the `authenticated` DB role:
--   * PostgREST's `authenticator` is a member of `authenticated`, NOT of the
--     `user` role → `SET ROLE "user"` fails with
--     `permission denied to set role "user"`, so EVERY request from a regular
--     user's token errors (even reads) → getProfile() throws → the app treats
--     the user as logged-out / not-onboarded and loops them back to /setup.
--   * All table grants target `authenticated` (blanket SELECT grants, migration
--     096 astro-rule writes, migration 142 constituents reads). The `user`/
--     `admin` roles were never granted those privileges, so even if the role
--     switch had worked, reads/writes would still be denied.
--
-- Admin authorization does NOT depend on the JWT role: it's decided by
-- is_admin() (a SECURITY DEFINER km_profiles lookup keyed on auth.uid()), and
-- the frontend reads profile.role from getProfile(), not from the token. So
-- issuing `authenticated` for everyone is the correct, documented, working
-- model (see CLAUDE.md / LESSONS_LEARNED, 2026-07-09).
--
-- kd_auth_register already issues 'authenticated' (migration 003, never
-- changed); only kd_auth_login needs restoring. The response body still returns
-- the real profile role so the UI's isAdmin gating is unaffected.

BEGIN;

-- 1. Restore kd_auth_login: issue JWT role = 'authenticated' (keep the
--    is_suspended rejection added in migration 140; keep returning the real
--    profile role in the response body).
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

    -- JWT role is ALWAYS 'authenticated' — the DB role every logged-in request
    -- resolves to. Admin-ness is enforced by is_admin(), not the token role.
    v_token := kd_generate_token(v_user.id, v_user.email, 'authenticated');

    RETURN json_build_object(
        'access_token', v_token,
        'user', json_build_object(
            'id', v_user.id,
            'email', v_user.email,
            'full_name', COALESCE(v_full_name, v_user.full_name),
            'role', COALESCE(v_profile_role, 'user')   -- real role, for UI gating
        )
    );
END;
$$;

-- 2. The only policy that read the JWT role CLAIM was km_index_constituents'
--    write policy (migration 022): `...->>'role' = 'admin'`. Under
--    authenticated-for-all that claim is never 'admin', which would silently
--    block admin constituent edits (CustomIndexManagePage writes constituents
--    directly via PostgREST). Switch it to is_admin() — the same profile-lookup
--    admin test used everywhere else — so it works regardless of the JWT role.
DO $$
BEGIN
    IF to_regclass('public.km_index_constituents') IS NOT NULL THEN
        DROP POLICY IF EXISTS idx_const_write ON km_index_constituents;
        CREATE POLICY idx_const_write ON km_index_constituents
            FOR ALL USING (public.is_admin());
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
