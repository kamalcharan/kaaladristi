-- km_migration_153_retire_vani_strength_watch.sql
-- Target DB: kaala_dristi_db
--
-- B2 (scanner consolidation, 2026-07-13): retire the "VaNi Strength Watch"
-- scan (id 'vani_opportunity'). It was Stage 2 Leaders filtered to the
-- top-conviction VaNi subset (confirmed Stage 2 structure + top RS percentile).
-- Stage 2 Leaders already computes per-row `vaniOpportunity` and the scanner
-- already carries a "✦ VaNi Highlight" filter button, so the exact same stocks
-- surface there — retiring the standalone tab loses no capability.
--
-- The scanner tab list is built from `kd_scan_presets WHERE is_active = true`
-- (pipeline2_api.py GET /api/scan/presets). Deactivating the row hides the tab.
-- The frontend handler, preset fallback, catalog item, and stage-family layout
-- entries for 'vani_opportunity' were removed in the same change, so no stale
-- dispatch can occur.

UPDATE kd_scan_presets
SET is_active = false,
    updated_at = now()
WHERE id = 'vani_opportunity';

-- Verify: should return the row with is_active = false.
-- SELECT id, name, is_active FROM kd_scan_presets WHERE id = 'vani_opportunity';
