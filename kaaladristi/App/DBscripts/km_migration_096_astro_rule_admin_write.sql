-- Migration 096: Allow admin users to update km_astro_rule_master via PostgREST
-- Target DB: kaala_dristi_db
--
-- Root cause: kd_auth_login always issues JWT with role='authenticated'.
-- The profile role (admin/user) lives in km_profiles but is NOT in the JWT.
--
-- Fix A: patch kd_auth_login to embed app_role in JWT claims.
-- Fix B: RLS policy reads km_profiles using the JWT sub (user UUID).

BEGIN;

-- ── Fix A: embed app_role in JWT so RLS and future code can read it ───────────

CREATE OR REPLACE FUNCTION kd_auth_login(
    p_email text,
    p_password text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user        kd_users%ROWTYPE;
    v_token       text;
    v_profile_role text;
    v_full_name   text;
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

    -- Pass profile role as third arg so JWT carries app_role claim
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

-- ── Fix B: RLS on km_astro_rule_master using sub claim → km_profiles ─────────

GRANT INSERT, UPDATE, DELETE ON km_astro_rule_master TO authenticated;

ALTER TABLE km_astro_rule_master ENABLE ROW LEVEL SECURITY;

-- SELECT: everyone can read
CREATE POLICY "astro_rule_select_all"
  ON km_astro_rule_master
  FOR SELECT
  USING (true);

-- INSERT: admin only — look up profile via JWT sub
CREATE POLICY "astro_rule_insert_admin"
  ON km_astro_rule_master
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM km_profiles
      WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        AND role = 'admin'
    )
  );

-- UPDATE: admin only
CREATE POLICY "astro_rule_update_admin"
  ON km_astro_rule_master
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM km_profiles
      WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM km_profiles
      WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        AND role = 'admin'
    )
  );

-- DELETE: admin only
CREATE POLICY "astro_rule_delete_admin"
  ON km_astro_rule_master
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM km_profiles
      WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        AND role = 'admin'
    )
  );

-- kd_app (backend pipeline) is unaffected — it connects directly via psycopg2,
-- not through PostgREST, so RLS does not apply to its connection.

COMMIT;
