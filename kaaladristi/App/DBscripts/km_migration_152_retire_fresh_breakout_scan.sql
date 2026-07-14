-- km_migration_152_retire_fresh_breakout_scan.sql
-- Target DB: kaala_dristi_db
--
-- B1 (scanner consolidation, 2026-07-13): retire the "Fresh Breakouts" scan.
-- It was a near-duplicate of "Breakout Surge" — both surface stocks closing
-- above a breakout level. Breakout Surge is the robust superset: DB-precomputed
-- breakout_level / pct_from_breakout, full active universe, ranked by conviction
-- (Score 5D). Fresh Breakouts' only extras were a leading-industry gate and
-- rvol>2, both recoverable on Breakout Surge via the ScanFilterBar `industries`
-- filter and the rvol column.
--
-- The scanner tab list is built from `kd_scan_presets WHERE is_active = true`
-- (pipeline2_api.py GET /api/scan/presets). Deactivating the row hides the tab.
-- The frontend handler + preset fallback for 'fresh_breakout' were removed in
-- the same change, so no stale dispatch can occur.

UPDATE kd_scan_presets
SET is_active = false,
    updated_at = now()
WHERE id = 'fresh_breakout';

-- Verify: should return the row with is_active = false.
-- SELECT id, name, is_active FROM kd_scan_presets WHERE id = 'fresh_breakout';
