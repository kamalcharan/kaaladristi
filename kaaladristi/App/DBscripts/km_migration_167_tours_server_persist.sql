-- ============================================================================
-- Migration 167 — Server-persist guided-walk state (tours + beta welcome ack)
-- Target database: kaala_dristi_db
--
-- WHY
-- ---
-- Both the page-explainer walks (useTour) and the BetaWelcomeModal store their
-- "seen / acknowledged" flag ONLY in localStorage (kd_tour_<id>_<uuid> and
-- kd_welcome_ack_<uuid>). Consequence: the same user is re-prompted on every
-- new browser, device, incognito window, or after Safari's aggressive storage
-- eviction — reported as "guided walk shows every login". Multiplied across
-- ~22 page tours + workspace tour, this is repeated friction on returning
-- users.
--
-- FIX
-- ---
-- Three new km_profiles columns:
--   · tours_seen JSONB          — { "<tourId>": "<isoTimestamp>", ... }
--   · welcome_acked_at TIMESTAMPTZ — first-time beta welcome acknowledgement
--   · guided_tours_enabled BOOL — onboarding preference; when false the tour
--                                 auto-start is skipped globally (the ?
--                                 launcher still works for on-demand replay)
--
-- Frontend keeps localStorage as an instant cache to avoid a flash between
-- component mount and the first profile fetch, but the DB is the source of
-- truth. See useTour.ts / BetaWelcomeModal.tsx / ProfileSetup.tsx.
--
-- The kd_update_profile RPC (migration 143) is extended to whitelist the three
-- new keys with proper typed casts so the frontend keeps using its single
-- self-serve update surface — no direct PATCHes, no new grants required.

BEGIN;

-- ── 1. Columns ────────────────────────────────────────────────────────────

ALTER TABLE km_profiles
  ADD COLUMN IF NOT EXISTS tours_seen           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS welcome_acked_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guided_tours_enabled BOOLEAN     NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN km_profiles.tours_seen IS
  'Map of tour-id → ISO timestamp of first completion (workspace, page-<id>). Replaces localStorage kd_tour_* so the walk does not re-fire per device.';
COMMENT ON COLUMN km_profiles.welcome_acked_at IS
  'When the user acknowledged the beta welcome modal. Replaces localStorage kd_welcome_ack_* so it does not re-appear per device.';
COMMENT ON COLUMN km_profiles.guided_tours_enabled IS
  'Onboarding preference. FALSE = skip all tour auto-starts (the ? launcher still replays on demand).';

-- ── 2. Extend kd_update_profile whitelist ─────────────────────────────────
--
-- Same shape as migration 143 — partial update, absent key ⇒ untouched. The
-- three new keys use typed casts (jsonb / timestamptz / boolean) so callers
-- can send the raw value inside p_updates without pre-serialising.

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
        display_name         = CASE WHEN p_updates ? 'display_name'         THEN p_updates ->> 'display_name'                              ELSE display_name         END,
        full_name            = CASE WHEN p_updates ? 'full_name'            THEN p_updates ->> 'full_name'                                 ELSE full_name            END,
        phone                = CASE WHEN p_updates ? 'phone'                THEN p_updates ->> 'phone'                                     ELSE phone                END,
        avatar_url           = CASE WHEN p_updates ? 'avatar_url'           THEN p_updates ->> 'avatar_url'                                ELSE avatar_url           END,
        onboarded            = CASE WHEN p_updates ? 'onboarded'            THEN (p_updates ->> 'onboarded')::boolean                      ELSE onboarded            END,
        theme                = CASE WHEN p_updates ? 'theme'                THEN p_updates ->> 'theme'                                     ELSE theme                END,
        mode                 = CASE WHEN p_updates ? 'mode'                 THEN p_updates ->> 'mode'                                      ELSE mode                 END,
        icp_mode             = CASE WHEN p_updates ? 'icp_mode'             THEN p_updates ->> 'icp_mode'                                  ELSE icp_mode             END,
        tours_seen           = CASE WHEN p_updates ? 'tours_seen'           THEN COALESCE(p_updates -> 'tours_seen', '{}'::jsonb)          ELSE tours_seen           END,
        welcome_acked_at     = CASE WHEN p_updates ? 'welcome_acked_at'     THEN (p_updates ->> 'welcome_acked_at')::timestamptz           ELSE welcome_acked_at     END,
        guided_tours_enabled = CASE WHEN p_updates ? 'guided_tours_enabled' THEN (p_updates ->> 'guided_tours_enabled')::boolean           ELSE guided_tours_enabled END,
        updated_at           = now()
    WHERE id = v_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Profile not found for caller' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_row;
END;
$$;

-- Grants unchanged from 143 — re-assert defensively.
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
