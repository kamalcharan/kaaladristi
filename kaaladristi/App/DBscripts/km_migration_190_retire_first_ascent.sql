-- =====================================================================
-- Migration 190 — re-retire the `first_ascent` scan preset
-- Target DB: kaala_dristi_db
--
-- WHY
-- ---
-- Migration 177 retired `first_ascent` (`is_active = FALSE`): the 6-10y
-- age band became a tier badge + filter inside every Waking Giants tab,
-- so the separate tab had nothing left to say.
--
-- Migration 181 then re-INSERTed it as part of a "v3 copy" preset block
-- carried forward from before 177, with `is_active = TRUE` and
-- `ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active`. That
-- silently undid the retirement. Evidence: kd_scan_presets.first_ascent
-- has is_active = TRUE with updated_at = 2026-08-25 11:48, the same
-- timestamp as waking_giants -- i.e. migration 181's run, not 177's.
--
-- WHAT THE USER SEES
-- ------------------
-- The scanner rail is DB-driven (ScanView builds its category groups from
-- kd_scan_presets), so `first_ascent` renders as a live tab under
-- Discovery. The frontend has ZERO references to it -- no fetcher, no
-- column override -- so:
--   * executeScan() falls through to `throw new Error('Unknown scan: ...')`
--     and the tab shows "Failed to run scan";
--   * even if it loaded, its category ('discovery') resolved through
--     getFieldsForGroup to the 3-column fallback.
-- A preset that is active in the DB but unknown to the frontend is always
-- a broken tab; the two must not drift.
--
-- The matview arm that emits preset_id='first_ascent' rows is LEFT IN
-- PLACE deliberately -- it is inert once the preset is inactive
-- (fetchScanPresets filters on is_active), it costs ~11 rows a night, and
-- keeping it makes this reversible with a one-line UPDATE if the age-band
-- tab is ever wanted back.
-- =====================================================================

BEGIN;

UPDATE public.kd_scan_presets
SET is_active  = FALSE,
    updated_at = now()
WHERE id = 'first_ascent';

COMMIT;

-- Verify (expect is_active = f):
--   SELECT id, name, is_active, updated_at
--   FROM kd_scan_presets WHERE id = 'first_ascent';
--
-- Any future preset block that re-INSERTs the catalog must NOT carry
-- retired ids forward. The contract audit now fails on a DB preset with
-- no frontend route, so a repeat of this shows up the same night:
--   cd App/backend && python scripts/audit_scanner_contract.py
