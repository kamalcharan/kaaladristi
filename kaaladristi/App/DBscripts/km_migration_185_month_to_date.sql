-- Migration 185 — month-to-date reference columns on km_equity_eod
-- Target DB: kaala_dristi_db
--
-- The monthly sibling of migration 183. Backs the "Monthly Movers (MTD)"
-- Price Action screener, reverse-engineered from the owner's monthly export
-- (2026-08-24) and matched to it exactly: its "Breakout" column is the
-- PREVIOUS MONTH'S CLOSE (2026-07-31) and its "% from Breakout" is a
-- month-to-date return. 15 of 15 sampled values matched -- RATNAMANI 2358.90,
-- SIEMENS 3760.00, WELCORP 1650.60, PTCIL 17737.00, RELIANCE 1307.80,
-- TITAN 4875.20, SBIN 1027.40, BOSCHLTD 41085.00.
-- Evidence: docs/claude/price-action-matrix-poa.md section 3b.
--
-- WHY COLUMNS AND NOT A MATVIEW ARM  (same reasoning as 183)
-- The condition is `close > previous month's close` -- a comparison between
-- two COLUMNS. PostgREST filters compare a column to a LITERAL only, so it is
-- unexpressible in a direct query as-is. Precomputing collapses the filter to
-- `pct_mtd > 0`, exactly how breakout_surge uses pct_from_breakout, which is
-- what keeps this preset in the clean direct-query family.
--
-- DEFINITION
--   prev_month_close = the last close STRICTLY BEFORE the 1st of the row's own
--                      month. Gap-safe: implemented as a lag over the months
--                      PRESENT in each symbol's history, so a symbol that did
--                      not trade last month references its last available
--                      close instead of dropping out with a NULL.
--   pct_mtd          = (close - prev_month_close) / prev_month_close * 100
--
-- NOTE: these are DAILY rows carrying a month-to-date value, refreshed every
-- session. They are NOT km_equity_monthly period-close bars, which update only
-- at month end and would leave a monthly screener showing July for all of
-- August (see POA section 1).
--
-- Populated by compute_rolling_range() in indicators/compute_engine.py, written
-- by pipeline step 6g, and by scripts/backfill_period_to_date.py for history.

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS prev_month_close NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pct_mtd          NUMERIC(10,2);

COMMENT ON COLUMN km_equity_eod.prev_month_close IS
  'Last close strictly before the 1st of this row''s month (gap-safe). Reference price for month-to-date.';
COMMENT ON COLUMN km_equity_eod.pct_mtd IS
  'Month-to-date return vs prev_month_close, in percent. Filter column for the Monthly Movers screener.';

CREATE INDEX IF NOT EXISTS idx_equity_eod_pct_mtd
  ON km_equity_eod (trade_date, pct_mtd)
  WHERE pct_mtd IS NOT NULL;

NOTIFY pgrst, 'reload schema';
