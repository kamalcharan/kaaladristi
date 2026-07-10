-- Migration 146: Mercury-event fields on km_rule_transits
-- Run on kaala_dristi_db.
--
-- WHY
-- ---
-- The almanac spec (owner, 2026-07-10) needs each transit window to carry the
-- event's own attributes so combinations can be correlated directly with SQL
-- (e.g. "combust AND ghora AND east" vs Nifty forward returns):
--
--   1. Journey  — zodiac sign, exact start/end time
--   2. Motion   — direct/retrograde, sign, exact start/end time
--   3. Combust  — exact boundary times, direction (east/west), duration,
--                 combustion stage (prakruta/vimishra/sankshipta/tikshna/ghora
--                 = 14° combustion arc split into 5 equal bands, classified by
--                 the MINIMUM Sun-separation reached in the window), and that
--                 minimum separation in degrees.
--
-- All values are COMPUTED ONCE by the (reconciling) generate_*_windows.py
-- scripts via Swiss Ephemeris bisection and STORED here — no dense ephemeris
-- is stored anywhere. Columns are nullable: a field applies only where the
-- event type warrants it (sign windows have no combustion_type, nakshatra-vara
-- day rows have no timestamps, etc.). Typed columns (not conditions_snapshot
-- JSONB) so correlation queries can filter/group without JSON extraction.
--
-- Scope note: populated for Mercury first (launch slice); other planets reuse
-- the same columns when their generators are upgraded.

BEGIN;

ALTER TABLE km_rule_transits
    ADD COLUMN IF NOT EXISTS start_ts        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_ts          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sign            TEXT,
    ADD COLUMN IF NOT EXISTS motion          TEXT
        CHECK (motion IN ('direct', 'retrograde') OR motion IS NULL),
    ADD COLUMN IF NOT EXISTS direction       TEXT
        CHECK (direction IN ('east', 'west') OR direction IS NULL),
    ADD COLUMN IF NOT EXISTS combustion_type TEXT
        CHECK (combustion_type IN ('prakruta','vimishra','sankshipta','tikshna','ghora')
               OR combustion_type IS NULL),
    ADD COLUMN IF NOT EXISTS sun_sep_min     NUMERIC(5,2);

COMMENT ON COLUMN km_rule_transits.start_ts        IS 'Exact event start (Swiss Ephemeris bisection; stored UTC, display IST)';
COMMENT ON COLUMN km_rule_transits.end_ts          IS 'Exact event end (Swiss Ephemeris bisection; stored UTC, display IST)';
COMMENT ON COLUMN km_rule_transits.sign            IS 'Sidereal zodiac sign of the planet during this window';
COMMENT ON COLUMN km_rule_transits.motion          IS 'direct | retrograde (motion windows)';
COMMENT ON COLUMN km_rule_transits.direction       IS 'east (evening, planet ahead of Sun) | west (morning, behind Sun)';
COMMENT ON COLUMN km_rule_transits.combustion_type IS 'Deepest stage reached: 14° arc / 5 bands — prakruta 11.2-14, vimishra 8.4-11.2, sankshipta 5.6-8.4, tikshna 2.8-5.6, ghora 0-2.8';
COMMENT ON COLUMN km_rule_transits.sun_sep_min     IS 'Minimum Sun separation (deg) reached during a combust window';

NOTIFY pgrst, 'reload schema';

COMMIT;
