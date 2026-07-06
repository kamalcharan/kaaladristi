-- ============================================================
-- Migration 125 · Scanner standardization — breakout merge + VaNi renames
--
-- 1. MERGE the two breakout scanners into one (owner decision 2026-07-06:
--    "breakouts can merge into 1, both does not make sense").
--    - breakout_surge becomes the single merged scan: close above the 20-day
--      breakout level on a green day, close >= 50, full NSE universe (the old
--      Daily variant's Rs 10,000 Cr large-cap gate is now just the MCap
--      filter), ranked by Score 5D, VaNi = is_vani_surge_or_breakout.
--    - breakout_surge_daily is deactivated (kept as a row for history;
--      the frontend also aliases its id to the merged scan).
--
-- 2. RENAME the two Stage Analysis scanners whose names collided with the
--    per-scan "VaNi Opportunity" highlight (which marks the best names
--    WITHIN any scan's list — now labeled "VaNi Highlight" in the UI):
--    - vani_opportunity  -> 'VaNi Strength Watch'
--    - vani_exit_watch   -> 'VaNi Weakness Watch'
--    IDs are unchanged — only display names.
--
-- Companion frontend/backend changes: merged fetchBreakoutSurge scan,
-- /api/scan/presets now returns vani_rule (DB is the source of truth for
-- engine behavior), "VaNi Highlight" labels.
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

-- ── 1. Merged Breakout Surge ────────────────────────────────────
UPDATE kd_scan_presets SET
  name           = 'Breakout Surge',
  description    = 'NSE stocks closing above their 20-day high on a green day — ranked by Score 5D',
  tooltip        = 'A stock clearing the highest close of its prior 20 sessions on an up day is exiting consolidation with participation. Ranked by Score 5D (money-flow conviction), so the names attracting delivery money rank first. Use the MCap filter to restrict to large caps.',
  result_limit   = 500,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily',
  vani_rule      = 'is_vani_surge_or_breakout',
  is_default_tab = true,
  is_active      = true
WHERE id = 'breakout_surge';

UPDATE kd_scan_presets SET
  is_active      = false,
  is_default_tab = false
WHERE id = 'breakout_surge_daily';

-- ── 2. VaNi scanner renames (IDs unchanged) ─────────────────────
UPDATE kd_scan_presets SET
  name = 'VaNi Strength Watch'
WHERE id = 'vani_opportunity';

UPDATE kd_scan_presets SET
  name = 'VaNi Weakness Watch'
WHERE id = 'vani_exit_watch';

-- ── Verify ──────────────────────────────────────────────────────
-- SELECT id, name, is_active, vani_rule, result_limit
-- FROM kd_scan_presets
-- WHERE id IN ('breakout_surge','breakout_surge_daily','vani_opportunity','vani_exit_watch');

COMMIT;
