-- Migration 143: Profile self-update RPC (kd_update_profile)
-- Run on kaala_dristi_db.
--
-- WHY
-- ---
-- Logged-in browser users run PostgREST as their PROFILE role (migrations
-- 096/140 patched kd_auth_login to embed km_profiles.role — 'user' | 'admin' —
-- as the JWT `role` claim, via kd_generate_token). The `user` role has SELECT
-- on km_profiles but NO UPDATE grant, so any direct PostgREST PATCH/upsert to
-- km_profiles from a regular user returns 403 Forbidden.
--
-- Effect: onboarding never persisted (`updateProfile({ onboarded: true })`
-- 403'd), so users were re-looped to /setup on every login and could never
-- reach the dashboard. Theme/mode/name self-updates were silently failing the
-- same way.
--
-- FIX
-- ---
-- A SECURITY DEFINER RPC that runs as the function owner (which has UPDATE) and
-- scopes the write to the CALLER'S OWN row via the JWT `sub` claim — the same
-- claim-reading pattern migration 091 (kd_auth_change_password) already uses
-- live. This is role-agnostic (works whether PostgREST resolves the request to
-- `user`, `admin`, `authenticated`, or anything else) and secure (a caller can
-- only ever update their own profile; no table-level write grant is handed to
-- `user`/`anon`). Only the whitelisted, user-settable columns are touched.

BEGIN;

CREATE OR REPLACE FUNCTION kd_update_profile(p_updates jsonb)
RETURNS km_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id  uuid;
    v_row km_profiles;
BEGIN
    -- Identify the caller from the verified JWT (set per-request by PostgREST).
    v_id := NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- Only keys present in p_updates are changed (partial update, null-safe:
    -- an explicit null in the payload clears the column, an absent key leaves
    -- it untouched). `role`, `is_suspended`, `id`, `email` are intentionally
    -- NOT settable here — privilege columns stay admin-only (FastAPI).
    UPDATE km_profiles SET
        display_name = CASE WHEN p_updates ? 'display_name' THEN p_updates ->> 'display_name'          ELSE display_name END,
        full_name    = CASE WHEN p_updates ? 'full_name'    THEN p_updates ->> 'full_name'             ELSE full_name    END,
        phone        = CASE WHEN p_updates ? 'phone'        THEN p_updates ->> 'phone'                 ELSE phone        END,
        avatar_url   = CASE WHEN p_updates ? 'avatar_url'   THEN p_updates ->> 'avatar_url'            ELSE avatar_url   END,
        onboarded    = CASE WHEN p_updates ? 'onboarded'    THEN (p_updates ->> 'onboarded')::boolean  ELSE onboarded    END,
        theme        = CASE WHEN p_updates ? 'theme'        THEN p_updates ->> 'theme'                 ELSE theme        END,
        mode         = CASE WHEN p_updates ? 'mode'         THEN p_updates ->> 'mode'                  ELSE mode         END,
        icp_mode     = CASE WHEN p_updates ? 'icp_mode'     THEN p_updates ->> 'icp_mode'              ELSE icp_mode     END,
        updated_at   = now()
    WHERE id = v_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Profile not found for caller' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_row;
END;
$$;

-- Callable by every role a logged-in request might resolve to. EXECUTE only —
-- the definer body, not the caller, holds the table write privilege.
GRANT EXECUTE ON FUNCTION kd_update_profile(jsonb) TO anon, authenticated, service_role;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'user', 'kd_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION kd_update_profile(jsonb) TO %I', r);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
