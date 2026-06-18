-- ============================================================
-- Migration 105: Add Stage 2 Watch and VaNi Opportunity scan presets
-- Target DB: kaala_dristi_db
-- Run: manually in pgAdmin / psql — DO NOT run via Python wrapper
-- ============================================================
--
-- Adds two new rows to kd_scan_presets:
--   stage_2_watch   — S2_CANDIDATE stocks approaching Stage 2 breakout
--   vani_opportunity — confirmed Stage 2 + RS percentile >80 (top 25)
--
-- Also updates the existing stage_2_leaders description and result_limit.
--
-- Frontend scan engine: App/frontend/src/services/scanEngine.ts
-- Catalog items:        App/frontend/src/constants/catalogItems.ts
-- ============================================================

-- ── Update Stage 2 Leaders ────────────────────────────────────────────────────

UPDATE kd_scan_presets
SET
  description  = 'Stocks in confirmed Weinstein Stage 2 — SMA200 rising, proper 52-week position',
  result_limit = 500
WHERE id = 'stage_2_leaders';

-- ── Insert Stage 2 Watch ──────────────────────────────────────────────────────

INSERT INTO kd_scan_presets (id, name, description, tooltip, result_limit)
VALUES (
  'stage_2_watch',
  'Stage 2 Watch',
  'Stocks approaching Stage 2 — MA stacking confirmed, SMA200 not yet rising. Watch for Stage 2 breakout.',
  'S2_CANDIDATE stocks within 50% of SMA150, sorted by RS percentile',
  100
)
ON CONFLICT (id) DO NOTHING;

-- ── Insert VaNi Opportunity ───────────────────────────────────────────────────

INSERT INTO kd_scan_presets (id, name, description, tooltip, result_limit)
VALUES (
  'vani_opportunity',
  'VaNi Opportunity',
  'Highest conviction — confirmed Stage 2 with top RS momentum. Alpha Edge + VaNi RS filter.',
  'Stage 2 + RS percentile >80 + Alpha Edge conditions. Top 25 by RS rank.',
  25
)
ON CONFLICT (id) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────────────

SELECT id, name, result_limit, description
FROM kd_scan_presets
WHERE id IN ('stage_2_leaders', 'stage_2_watch', 'vani_opportunity')
ORDER BY id;
