-- ============================================================================
-- KALA-DRISHTI: Self-Hosted Auth (replaces Supabase GoTrue)
-- Migration 003 — Run on kaala_dristi_db as vikuna_admin
-- ============================================================================
--
-- Creates:
--   1. kd_users table (email, bcrypt password, reset tokens)
--   2. Updated km_profiles (linked to kd_users instead of auth.users)
--   3. PostgREST RPC functions: kd_auth_register, kd_auth_login,
--      kd_auth_forgot_password, kd_auth_reset_password
--   4. JWT signing helper using pgcrypto HMAC-SHA256
--
-- Prerequisites:
--   - pgcrypto extension (for bcrypt + HMAC)
--   - Roles: anon, service_role, kd_app, authenticator
--   - JWT_SECRET set in PostgREST config
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS kd_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    reset_token     TEXT,
    reset_token_exp TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kd_users_email ON kd_users (email);
CREATE INDEX IF NOT EXISTS idx_kd_users_reset_token ON kd_users (reset_token) WHERE reset_token IS NOT NULL;

-- ============================================================================
-- 2. UPDATE km_profiles — drop auth.users FK, link to kd_users
-- ============================================================================

-- Remove old Supabase FK if it exists (may fail silently if already gone)
DO $$ BEGIN
    ALTER TABLE km_profiles DROP CONSTRAINT IF EXISTS km_profiles_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add FK to kd_users (only if not already there)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'km_profiles_kd_users_fk'
    ) THEN
        -- Don't add FK constraint since existing profiles may have IDs not in kd_users yet
        -- We'll link them after the first admin registers
        NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. JWT SIGNING HELPER
-- ============================================================================

-- Base64url encode (URL-safe, no padding)
-- NOTE: PG encode('base64') inserts newlines every 76 chars — must strip them
CREATE OR REPLACE FUNCTION kd_base64url_encode(data bytea)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT replace(replace(replace(rtrim(encode(data, 'base64'), '='), E'\n', ''), '+', '-'), '/', '_');
$$;

-- Sign a JWT using HMAC-SHA256
CREATE OR REPLACE FUNCTION kd_sign_jwt(payload json, secret text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT
        kd_base64url_encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'))
        || '.' ||
        kd_base64url_encode(convert_to(payload::text, 'utf8'))
        || '.' ||
        kd_base64url_encode(
            hmac(
                kd_base64url_encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'))
                || '.' ||
                kd_base64url_encode(convert_to(payload::text, 'utf8')),
                secret,
                'sha256'
            )
        );
$$;

-- Generate a JWT for a user
CREATE OR REPLACE FUNCTION kd_generate_token(user_id uuid, user_email text, user_role text DEFAULT 'authenticated')
RETURNS text LANGUAGE sql STABLE AS $$
    SELECT kd_sign_jwt(
        json_build_object(
            'role', user_role,
            'sub', user_id,
            'email', user_email,
            'iss', 'kaaladristi',
            'iat', extract(epoch from now())::int,
            'exp', extract(epoch from (now() + interval '7 days'))::int
        ),
        current_setting('app.jwt_secret')
    );
$$;

-- ============================================================================
-- 4. AUTH RPC FUNCTIONS (exposed via PostgREST)
-- ============================================================================

-- ── REGISTER ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kd_auth_register(
    p_email text,
    p_password text,
    p_full_name text DEFAULT ''
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid;
    v_token text;
    v_profile_role text;
BEGIN
    -- Validate
    IF p_email IS NULL OR p_email = '' THEN
        RETURN json_build_object('error', 'Email is required');
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RETURN json_build_object('error', 'Password must be at least 6 characters');
    END IF;

    -- Check duplicate
    IF EXISTS (SELECT 1 FROM kd_users WHERE email = lower(trim(p_email))) THEN
        RETURN json_build_object('error', 'An account with this email already exists');
    END IF;

    -- Insert user
    INSERT INTO kd_users (email, password_hash, full_name)
    VALUES (lower(trim(p_email)), crypt(p_password, gen_salt('bf', 10)), trim(p_full_name))
    RETURNING id INTO v_user_id;

    -- Create profile
    INSERT INTO km_profiles (id, email, full_name)
    VALUES (v_user_id, lower(trim(p_email)), trim(p_full_name))
    ON CONFLICT (id) DO NOTHING;

    -- Get role from profile
    SELECT role INTO v_profile_role FROM km_profiles WHERE id = v_user_id;

    -- Generate JWT
    v_token := kd_generate_token(v_user_id, lower(trim(p_email)), 'authenticated');

    RETURN json_build_object(
        'access_token', v_token,
        'user', json_build_object(
            'id', v_user_id,
            'email', lower(trim(p_email)),
            'full_name', trim(p_full_name),
            'role', COALESCE(v_profile_role, 'user')
        )
    );
END;
$$;

-- ── LOGIN ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kd_auth_login(
    p_email text,
    p_password text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user kd_users%ROWTYPE;
    v_token text;
    v_profile_role text;
    v_full_name text;
BEGIN
    -- Find user
    SELECT * INTO v_user FROM kd_users WHERE email = lower(trim(p_email));

    IF v_user.id IS NULL THEN
        RETURN json_build_object('error', 'Invalid email or password');
    END IF;

    -- Verify password
    IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        RETURN json_build_object('error', 'Invalid email or password');
    END IF;

    -- Get profile info
    SELECT role, full_name INTO v_profile_role, v_full_name
    FROM km_profiles WHERE id = v_user.id;

    -- Generate JWT
    v_token := kd_generate_token(v_user.id, v_user.email, 'authenticated');

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

-- ── FORGOT PASSWORD ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kd_auth_forgot_password(
    p_email text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid;
    v_token text;
BEGIN
    SELECT id INTO v_user_id FROM kd_users WHERE email = lower(trim(p_email));

    -- Always return success (don't leak whether email exists)
    IF v_user_id IS NULL THEN
        RETURN json_build_object('message', 'If that email exists, a reset link has been sent');
    END IF;

    -- Generate a random reset token (32 hex chars)
    v_token := encode(gen_random_bytes(16), 'hex');

    -- Store token with 1-hour expiry
    UPDATE kd_users
    SET reset_token = v_token,
        reset_token_exp = now() + interval '1 hour',
        updated_at = now()
    WHERE id = v_user_id;

    -- TODO: Send email with reset link containing v_token
    -- For now, return the token directly (dev mode)
    RETURN json_build_object(
        'message', 'If that email exists, a reset link has been sent',
        'reset_token', v_token  -- REMOVE THIS IN PRODUCTION
    );
END;
$$;

-- ── RESET PASSWORD ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kd_auth_reset_password(
    p_token text,
    p_new_password text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RETURN json_build_object('error', 'Password must be at least 6 characters');
    END IF;

    -- Find user with valid (non-expired) token
    SELECT id INTO v_user_id
    FROM kd_users
    WHERE reset_token = p_token
      AND reset_token_exp > now();

    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Invalid or expired reset token');
    END IF;

    -- Update password, clear token
    UPDATE kd_users
    SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
        reset_token = NULL,
        reset_token_exp = NULL,
        updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('message', 'Password has been reset. You can now sign in.');
END;
$$;

-- ============================================================================
-- 5. PERMISSIONS — allow anon to call auth functions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Auth RPCs callable by anyone (anon)
GRANT EXECUTE ON FUNCTION kd_auth_register(text, text, text) TO anon, service_role;
GRANT EXECUTE ON FUNCTION kd_auth_login(text, text) TO anon, service_role;
GRANT EXECUTE ON FUNCTION kd_auth_forgot_password(text) TO anon, service_role;
GRANT EXECUTE ON FUNCTION kd_auth_reset_password(text, text) TO anon, service_role;

-- kd_users: only auth functions access it (SECURITY DEFINER), not direct queries
REVOKE ALL ON kd_users FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON kd_users TO service_role;

-- km_profiles: authenticated users can read/update their own
GRANT SELECT, UPDATE ON km_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON km_profiles TO service_role;

-- Master/reference tables: read-only for authenticated users, full access for service_role
GRANT SELECT ON km_planets TO anon, authenticated;
GRANT SELECT ON km_nakshatras TO anon, authenticated;
GRANT SELECT ON km_nakshatra_lords TO anon, authenticated;
GRANT SELECT ON km_zodiac_signs TO anon, authenticated;
GRANT SELECT ON km_zodiac_lords TO anon, authenticated;
GRANT SELECT ON km_days_of_week TO anon, authenticated;
GRANT SELECT ON km_day_lords TO anon, authenticated;
GRANT SELECT ON km_sectors TO anon, authenticated;
GRANT SELECT ON km_sector_lords TO anon, authenticated;
GRANT SELECT ON km_index_master TO anon, authenticated;
GRANT SELECT ON km_index_composition TO anon, authenticated;

GRANT ALL ON km_planets TO service_role;
GRANT ALL ON km_nakshatras TO service_role;
GRANT ALL ON km_nakshatra_lords TO service_role;
GRANT ALL ON km_zodiac_signs TO service_role;
GRANT ALL ON km_zodiac_lords TO service_role;
GRANT ALL ON km_days_of_week TO service_role;
GRANT ALL ON km_day_lords TO service_role;
GRANT ALL ON km_sectors TO service_role;
GRANT ALL ON km_sector_lords TO service_role;
GRANT ALL ON km_index_master TO service_role;
GRANT ALL ON km_index_composition TO service_role;

-- Sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- 6. PostgREST CONFIG — set JWT secret as app setting
-- ============================================================================
-- PostgREST needs this in its config or docker env:
--   PGRST_APP_SETTINGS_APP.JWT_SECRET=<your-jwt-secret>
--
-- This allows kd_generate_token() to call current_setting('app.jwt_secret')
-- ============================================================================

-- ============================================================================
-- 7. CREATE FIRST ADMIN
-- ============================================================================
-- After running this migration, register via the app, then promote yourself:
--
--   UPDATE km_profiles SET role = 'admin' WHERE email = 'your-email@example.com';
--
-- ============================================================================
