-- km_migration_206_onboarding_version.sql
-- Target DB: kaala_dristi_db
--
-- Re-onboarding, version-stamped instead of blanket-cleared.
--
-- Migration 165 forced everyone back through setup with
-- `UPDATE km_profiles SET onboarded = false`. That works exactly once and is
-- indiscriminate: it cannot tell who already satisfies the new step, it
-- re-asks every question, and it has to be rewritten from scratch the next
-- time onboarding changes. It also disarms the guard in ProfileSetup that
-- stops an onboarded user re-walking the wizard and re-applying the starter
-- template over a workspace they built.
--
-- Instead: km_profiles.onboarding_version records WHICH onboarding a user
-- last completed. The app carries ONBOARDING_VERSION (constants/onboarding.ts)
-- and sends anyone behind it back to /setup. Bumping that constant plus one
-- stamping UPDATE here is the whole procedure for every future change, and
-- because the resume rules can read the stored version we can skip steps a
-- user has already satisfied rather than making them redo everything.
--
-- Version 1 is "the persona/ICP flow" (migration 204). It is what makes the
-- VaNi opening brief personal: concede_level names the price line the user
-- trades on, which selects the breadth timeframe their read is built around.
-- Without it the brief has no line to mark and falls back to a generic
-- market read.
--
-- TARGETED first run (owner decision 2026-09-12): a user who already carries
-- persona_set_at has completed the v1 questions — stamp them 1 and leave them
-- alone. Everyone else lands on 0 by DEFAULT and is sent back.
--
-- AND a valid phone (owner, same day: "if there is no phone number we will
-- force it now"). Step 1 of the wizard is the only place a phone is ever
-- captured, so exempting a persona-holder who has no number would exempt them
-- permanently. That combination is not hypothetical: of the two profiles
-- carrying a persona on 2026-09-12, one had no phone. The stamp therefore
-- requires both, and the frontend resume rule refuses to skip step 1 for the
-- same reason.
--
-- `onboarded` is deliberately NOT touched: a user who is mid-flow stays
-- mid-flow, and the ProfileSetup guard keeps working for everyone who is
-- already current.

BEGIN;

-- ── 1. The column ───────────────────────────────────────────────────────────
ALTER TABLE km_profiles
    ADD COLUMN IF NOT EXISTS onboarding_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN km_profiles.onboarding_version IS
    'Which onboarding flow this user last completed. Compared against ONBOARDING_VERSION in App/frontend/src/constants/onboarding.ts; behind = sent back to /setup. Stamped only when the final step completes.';

-- ── 2. kd_update_profile — whitelist the new key ────────────────────────────
-- Caller-settable on purpose: the wizard stamps it from finishOnboarding(),
-- the same place `onboarded` flips, so the two can never disagree. Nothing
-- else writes it.
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
        -- migration 206 ─────────────────────────────────────────────────────
        onboarding_version = CASE WHEN p_updates ? 'onboarding_version'
                                 THEN (p_updates ->> 'onboarding_version')::integer
                                 ELSE onboarding_version END,
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

-- ── 3. Targeted stamp ───────────────────────────────────────────────────────
-- Exempt only a profile that has BOTH the v1 answers and a usable phone.
-- On 2026-09-12: 2 of 17 carried a persona, but only 1 of those also had a
-- phone — so this stamps 1 profile and sends the other 16 back.
--
-- The phone test mirrors lib/phone.ts isValidIndianMobile() EXACTLY: strip to
-- digits, drop a leading 91 only when that leaves 12 digits and a leading 0
-- only when it leaves 11, then require ten digits starting 6-9.
--
-- The length conditions are not decoration. A plain `^(\+?91|0)` strip looks
-- equivalent and is not: it mangles a genuine ten-digit mobile that happens to
-- START with 91 (9123456789 -> 23456789, rejected) while the wizard accepts
-- it. Keep the two definitions in step, or a user is bounced back to step 1
-- to re-enter the number the app already considers valid.
UPDATE km_profiles
   SET onboarding_version = 1,
       updated_at = now()
 WHERE persona_set_at IS NOT NULL
   AND (
     WITH d AS (SELECT regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS x)
     SELECT CASE
              WHEN length(x) = 12 AND left(x, 2) = '91' THEN right(x, 10)
              WHEN length(x) = 11 AND left(x, 1) = '0'  THEN right(x, 10)
              ELSE x
            END
       FROM d
   ) ~ '^[6-9][0-9]{9}$';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect: version_1 = the count that already had a persona; version_0 = the
-- users who will be sent back to /setup on their next page load.
--
-- SELECT onboarding_version,
--        count(*)                                    AS users,
--        count(*) FILTER (WHERE onboarded)           AS marked_onboarded,
--        count(*) FILTER (WHERE persona IS NOT NULL) AS has_persona,
--        count(*) FILTER (WHERE phone IS NOT NULL)   AS has_phone
--   FROM km_profiles
--  GROUP BY onboarding_version
--  ORDER BY onboarding_version;
--
-- Nobody should be exempt without a phone — this must return 0 rows:
--
-- SELECT id FROM km_profiles WHERE onboarding_version >= 1 AND phone IS NULL;
--
-- To re-run the drive for a future flow: bump ONBOARDING_VERSION in
-- constants/onboarding.ts, then stamp whoever should be exempt. To undo this
-- one without a code change:
--   UPDATE km_profiles SET onboarding_version = 1;
