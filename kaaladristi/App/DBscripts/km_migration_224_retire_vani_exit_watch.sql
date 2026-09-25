-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 224 — retire the "VaNi Weakness Watch" scanner
-- Target database: kaala_dristi_db
-- Owner decision, 2026-09-25.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `vani_exit_watch` was Stage 4 Leaders filtered to the weakest tail: the same
-- death-cross structure PLUS rs_percentile < 20, capped at 25 rows. Its
-- strength twin `vani_opportunity` ("VaNi Strength Watch") was retired the
-- same way on 2026-07-13 and is still `is_active = false` on this table, so
-- this restores the symmetry the Stage strip lost that day.
--
-- NO CAPABILITY IS LOST. Stage 4 Leaders holds the same family on the same
-- gate, and `rs_percentile` is a default column on the stage_analysis field
-- group -- sorting that list by RS percentile ASCENDING reproduces this
-- shortlist exactly, without a second preset to keep in step with the first.
--
-- ⚠ `is_active` is the ONLY retirement mechanism, and it is sufficient:
-- pipeline2_api's /api/scan/presets selects `WHERE is_active = true`, and
-- fetchScanPresets() is what the category strip, the tab row and
-- getPresetMeta() all read. The row is NOT deleted -- the id is an address
-- (?setup= links, the thesis adapter registry, PRESET_COL_OVERRIDES), and a
-- deleted row frees it to be reused by something that means a different thing.
--
-- ⚠ The `SCAN_PRESETS` array in scanEngine.ts carries a copy of this row as
-- the offline fallback, and it has to move in the SAME change or the scanner
-- reappears whenever the API is unreachable -- the migration-218 `universe`
-- trap. The array entry is removed in the commit that carries this file.
--
-- ⚠ This does NOT change Standouts. `vani_side` stays 'caution' on the row,
-- but the Stage presets are not served by km_scan_results at all (they read
-- km_equity_eod directly), so this preset never contributed an agreement
-- count. fetchStandouts now also filters `is_active`, so a retired preset can
-- never be counted in future.
--
-- Holds no data, creates no table, touches one column on one row.
-- Owner runs it in pgAdmin. No REFRESH, no backfill.

BEGIN;

UPDATE kd_scan_presets
   SET is_active  = FALSE,
       updated_at = now()
 WHERE id = 'vani_exit_watch';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verification ────────────────────────────────────────────────────────────
-- Both VaNi-branded Stage presets retired, the four real Stage presets live:
--
--   SELECT id, name, is_active, vani_side
--     FROM kd_scan_presets
--    WHERE category = 'stage_analysis'
--    ORDER BY is_active DESC, id;
--
-- Expect is_active FALSE on vani_exit_watch and vani_opportunity, and TRUE on
-- stage_2_watch / stage_2_leaders / stage_3_watch / stage_4_leaders.
--
-- To bring it back: set is_active = TRUE here AND restore the SCAN_PRESETS
-- array entry. One without the other gives a scanner that appears only when
-- the API is up, or only when it is down.
