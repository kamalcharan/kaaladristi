-- Migration 204: Persona persistence for agentic onboarding (Phase 0 of
-- docs/claude/onboarding-poa.md). Run on kaala_dristi_db.
--
-- WHY
-- ---
-- Onboarding (/setup) asked "investor / trader / both" and threw the answer
-- away — only icp_mode (astro|technical) was ever persisted. The reworked flow
-- infers a persona from three things the user actually does (which live
-- setup they would act on, how long they hold, where they concede) and the
-- Account page lets them correct it later. All four fields are stored so the
-- reasoning is visible, not just the verdict. guide_progress records which
-- "Show me" tours the user has walked (the How-to-use-DristiQ checklist).
--
-- km_ux_events holds exactly two events — first_bookmark and day2_return —
-- the only onboarding numbers we measure this sprint. RLS shape copies
-- km_user_bookmarks (migration 162): a caller sees and writes only rows with
-- their own JWT `sub`. Grants copy migration 199 (kd_app / authenticated /
-- admin), because a GRANT denial happens before RLS is evaluated.
--
-- Vocabulary (mirrored in App/frontend/src/constants/personaConfig.ts — keep
-- the two in sync; the CHECK constraints are the DB side of that contract):
--   persona        investor | swing | intensity
--   acts_on        confirmed | early | extreme     (which setup they would act on)
--   hold_horizon   days | weeks | months
--   concede_level  tight | swing_low | structure   (10-day low | 22-day low | Golden Line)

BEGIN;

-- ── 1. km_profiles columns ──────────────────────────────────────────────────
ALTER TABLE km_profiles
    ADD COLUMN IF NOT EXISTS persona        TEXT
        CHECK (persona IN ('investor', 'swing', 'intensity')),
    ADD COLUMN IF NOT EXISTS acts_on        TEXT
        CHECK (acts_on IN ('confirmed', 'early', 'extreme')),
    ADD COLUMN IF NOT EXISTS hold_horizon   TEXT
        CHECK (hold_horizon IN ('days', 'weeks', 'months')),
    ADD COLUMN IF NOT EXISTS concede_level  TEXT
        CHECK (concede_level IN ('tight', 'swing_low', 'structure')),
    ADD COLUMN IF NOT EXISTS persona_set_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS guide_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN km_profiles.persona        IS 'Derived from acts_on/hold_horizon/concede_level by personaConfig.derivePersona; user may override';
COMMENT ON COLUMN km_profiles.persona_set_at IS 'Stamped by kd_update_profile whenever persona is written; Morning Brief continuity uses it for the first 14 days';
COMMENT ON COLUMN km_profiles.guide_progress IS '{"<scan preset id or page>": "YYYY-MM-DD"} — Show-me tours walked';

-- ── 2. kd_update_profile: whitelist the new keys ────────────────────────────
-- Full body restated (CREATE OR REPLACE replaces the whole function). Same
-- partial-update semantics as migration 143: only keys present in p_updates
-- change; role / is_suspended / id / email remain admin-only (FastAPI).
-- persona_set_at is NOT caller-settable — it is stamped server-side whenever
-- the persona key is present in the payload.
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
    v_id := NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    UPDATE km_profiles SET
        display_name   = CASE WHEN p_updates ? 'display_name'   THEN p_updates ->> 'display_name'            ELSE display_name   END,
        full_name      = CASE WHEN p_updates ? 'full_name'      THEN p_updates ->> 'full_name'               ELSE full_name      END,
        phone          = CASE WHEN p_updates ? 'phone'          THEN p_updates ->> 'phone'                   ELSE phone          END,
        avatar_url     = CASE WHEN p_updates ? 'avatar_url'     THEN p_updates ->> 'avatar_url'              ELSE avatar_url     END,
        onboarded      = CASE WHEN p_updates ? 'onboarded'      THEN (p_updates ->> 'onboarded')::boolean    ELSE onboarded      END,
        theme          = CASE WHEN p_updates ? 'theme'          THEN p_updates ->> 'theme'                   ELSE theme          END,
        mode           = CASE WHEN p_updates ? 'mode'           THEN p_updates ->> 'mode'                    ELSE mode           END,
        icp_mode       = CASE WHEN p_updates ? 'icp_mode'       THEN p_updates ->> 'icp_mode'                ELSE icp_mode       END,
        -- migration 204 ─────────────────────────────────────────────────────
        persona        = CASE WHEN p_updates ? 'persona'        THEN p_updates ->> 'persona'                 ELSE persona        END,
        acts_on        = CASE WHEN p_updates ? 'acts_on'        THEN p_updates ->> 'acts_on'                 ELSE acts_on        END,
        hold_horizon   = CASE WHEN p_updates ? 'hold_horizon'   THEN p_updates ->> 'hold_horizon'            ELSE hold_horizon   END,
        concede_level  = CASE WHEN p_updates ? 'concede_level'  THEN p_updates ->> 'concede_level'           ELSE concede_level  END,
        persona_set_at = CASE WHEN p_updates ? 'persona'        THEN now()                                   ELSE persona_set_at END,
        guide_progress = CASE WHEN p_updates ? 'guide_progress' THEN COALESCE(p_updates -> 'guide_progress', '{}'::jsonb)
                                                                                                             ELSE guide_progress END,
        updated_at     = now()
    WHERE id = v_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Profile not found for caller' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_row;
END;
$$;

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

-- ── 3. km_ux_events — two onboarding events, nothing else ───────────────────
CREATE TABLE IF NOT EXISTS km_ux_events (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES km_profiles(id) ON DELETE CASCADE,
    event      TEXT        NOT NULL CHECK (event IN ('first_bookmark', 'day2_return')),
    payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, event)          -- each event fires once per user
);

CREATE INDEX IF NOT EXISTS idx_km_ux_events_event_at ON km_ux_events (event, created_at);

ALTER TABLE km_ux_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_ux_events ON km_ux_events;
CREATE POLICY users_own_ux_events ON km_ux_events
  USING (user_id = (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid)
  WITH CHECK (user_id = (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid);

GRANT SELECT, INSERT ON km_ux_events TO kd_app, authenticated;
GRANT USAGE, SELECT ON SEQUENCE km_ux_events_id_seq TO kd_app, authenticated;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT, INSERT ON km_ux_events TO %I', r);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE km_ux_events_id_seq TO %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kd_readonly') THEN
    GRANT SELECT ON km_ux_events TO kd_readonly;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verify (run as a logged-in user through PostgREST, or in psql with the
-- claims set) ────────────────────────────────────────────────────────────────
-- SET request.jwt.claims = '{"sub":"<a-profile-uuid>"}';
-- SELECT persona, acts_on, hold_horizon, concede_level, persona_set_at
--   FROM kd_update_profile('{"acts_on":"confirmed","hold_horizon":"weeks","concede_level":"swing_low","persona":"swing"}');
-- Expect: swing | confirmed | weeks | swing_low | <now>
-- SELECT kd_update_profile('{"persona":"cowboy"}');  -- must fail the CHECK
