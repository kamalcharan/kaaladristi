-- ============================================================
-- Migration 106: Add vani_rule column to kd_scan_presets
-- Target DB: kaala_dristi_db
-- Run: manually in pgAdmin / psql — DO NOT run via Python wrapper
-- ============================================================
--
-- Adds vani_rule TEXT to kd_scan_presets.
-- This column drives which VaNi Opportunity filter chip logic to apply
-- for each scanner in the frontend (computeVaniOpportunity() switch).
--
-- Rule values:
--   'is_vani_s2'                  → filter on is_vani_s2 = true
--   'always_true'                 → all results qualify (DB pre-filtered)
--   'rvol_surge_and_52wh'         → rvol > 2 AND close >= w52_high * 0.98
--   'is_vani_surge_or_breakout'   → is_vani_surge OR is_vani_breakout
--   'is_vani_distrib_and_weakness'→ is_vani_distrib AND is_vani_weakness
--   NULL                          → no VaNi chip shown for this scanner
--
-- Frontend: App/frontend/src/services/scanEngine.ts
--   computeVaniOpportunity(row, vaniRule) switch statement
-- ============================================================

ALTER TABLE kd_scan_presets
  ADD COLUMN IF NOT EXISTS vani_rule TEXT;

-- ── Stage 2 family + confluences that use is_vani_s2 ─────────────────────────

UPDATE kd_scan_presets
SET vani_rule = 'is_vani_s2'
WHERE id IN (
  'stage_2_leaders',
  'stage_2_watch',
  'power_buy',
  'fresh_breakout',
  'quiet_accumulation',
  'breakout_surge'
);

-- ── VaNi Opportunity — DB already pre-filtered, all results qualify ───────────

UPDATE kd_scan_presets
SET vani_rule = 'always_true'
WHERE id = 'vani_opportunity';

-- ── Bearish / distribution scanners ──────────────────────────────────────────

UPDATE kd_scan_presets
SET vani_rule = 'is_vani_distrib_and_weakness'
WHERE id IN ('power_sell', 'distribution_warning');

-- ── Conviction Flow — delivery surge momentum ─────────────────────────────────

UPDATE kd_scan_presets
SET vani_rule = 'is_vani_surge_or_breakout'
WHERE id = 'conviction_flow';

-- smart_money intentionally left NULL — no VaNi chip for this scanner

-- ── Verify ────────────────────────────────────────────────────────────────────

SELECT id, name, vani_rule
FROM kd_scan_presets
ORDER BY sort_order;
