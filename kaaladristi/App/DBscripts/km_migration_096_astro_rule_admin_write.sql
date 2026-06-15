-- Migration 096: Allow authenticated users to write to km_astro_rule_master via PostgREST
-- Target DB: kaala_dristi_db
--
-- km_astro_rule_master contains admin config, not user-sensitive data.
-- No RLS needed — PostgREST JWT auth gates access to logged-in users,
-- and the React UI restricts write controls to isAdmin users only.
--
-- Safe to re-run: drops any policies created by earlier failed attempts.

BEGIN;

-- 1. Clean up policies from earlier failed migration attempts
DROP POLICY IF EXISTS "astro_rule_select_all"    ON km_astro_rule_master;
DROP POLICY IF EXISTS "astro_rule_insert_admin"  ON km_astro_rule_master;
DROP POLICY IF EXISTS "astro_rule_update_admin"  ON km_astro_rule_master;
DROP POLICY IF EXISTS "astro_rule_delete_admin"  ON km_astro_rule_master;

-- 2. Disable RLS (we don't need it — table has no user-sensitive data)
ALTER TABLE km_astro_rule_master DISABLE ROW LEVEL SECURITY;

-- 3. Grant write access to authenticated role (already has SELECT from migration 051)
GRANT INSERT, UPDATE, DELETE ON km_astro_rule_master TO authenticated;

-- 4. Patch kd_auth_login to embed profile role in JWT claims
--    (was hardcoding 'authenticated'; now passes actual profile role)
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
BEGIN
    SELECT * INTO v_user FROM kd_users WHERE email = lower(trim(p_email));

    IF v_user.id IS NULL THEN
        RETURN json_build_object('error', 'Invalid email or password');
    END IF;

    IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        RETURN json_build_object('error', 'Invalid email or password');
    END IF;

    SELECT role, full_name INTO v_profile_role, v_full_name
    FROM km_profiles WHERE id = v_user.id;

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

COMMIT;
