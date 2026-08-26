-- Migration 187 — 20-day breakdown level on km_equity_eod
-- Target DB: kaala_dristi_db
--
-- The exact mirror of the existing breakout_level pair (migration 112). Backs
-- the "Breakdown Watch" daily Price Action screener, the counterpart to
-- Breakout Surge.
--
-- DEFINITION (mirror of compute_engine.py:308-310)
--   breakdown_level    = rolling 20-bar MINIMUM of the PRIOR close
--                        (breakout_level is the 20-bar MAXIMUM)
--   pct_from_breakdown = (close - breakdown_level) / breakdown_level * 100
--                        NEGATIVE when price has broken below the level.
--
-- WHY A NEW COLUMN AND NOT pct_from_breakout < 0
-- Because that is a different, useless question. On 2026-08-25, 2,242 of 2,517
-- eligible NSE rows (89 percent) had pct_from_breakout < 0 -- that only says
-- "not at a 20-day high", which nearly the whole market satisfies on any day.
-- A breakdown needs its own floor: close below the 20-day LOW returns 248 rows,
-- a screener-sized set comparable to Breakout Surge.
--
-- WARM-UP: compute_rolling_range uses min_periods=1 for the existing breakout
-- window, so a 3-bar symbol gets a trivially-cleared "20-day" level. The
-- fetcher gates on bar count for the same reason (migration-169 lesson); the
-- column itself keeps the existing convention so the two stay mirror images.
--
-- Populated by compute_rolling_range() in indicators/compute_engine.py (nightly,
-- pipeline step 6g) and by scripts/backfill_rolling_metrics_fast.py for history.

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS breakdown_level    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pct_from_breakdown NUMERIC(10,2);

COMMENT ON COLUMN km_equity_eod.breakdown_level IS
  'Rolling 20-bar minimum of the prior close. Mirror of breakout_level.';
COMMENT ON COLUMN km_equity_eod.pct_from_breakdown IS
  'Percent of close vs breakdown_level. Negative = broken below the 20-day low.';

CREATE INDEX IF NOT EXISTS idx_equity_eod_pct_from_breakdown
  ON km_equity_eod (trade_date, pct_from_breakdown)
  WHERE pct_from_breakdown IS NOT NULL;

NOTIFY pgrst, 'reload schema';
