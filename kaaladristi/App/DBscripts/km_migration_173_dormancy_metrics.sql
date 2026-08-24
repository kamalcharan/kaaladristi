-- =====================================================================
-- km_migration_173_dormancy_metrics.sql
-- Target database: kaala_dristi_db
-- Waking Giants / First Ascent — step 2: dormancy gate metrics
-- =====================================================================
-- Current-state per-stock dormancy inputs, computed by
-- scripts/compute_dormancy.py from CLIFF-ADJUSTED closes
-- (lib/breadth_common.adjust_close_cliffs — km_corporate_actions is
-- empty, so raw closes carry split/bonus cliffs that would fake a
-- 50% "dormancy" on the ex-date; see D44).
--
-- The dormancy DECISION (thresholds) lives in the step-4 matview as
-- named constants — these columns are the measured facts:
--   high_3y_adj / low_3y_adj  — cliff-adjusted 3-yr extreme closes
--   pct_from_3y_high          — (last close / high_3y_adj − 1) × 100,
--                               negative = below the high
--   days_since_3y_high        — calendar days since the 3-yr high was
--                               set. Separates a dormant giant (old
--                               high, long sideways) from a fresh
--                               crash (high set last quarter).
--   dormancy_updated_at       — last compute date

ALTER TABLE km_equity_symbols
  ADD COLUMN IF NOT EXISTS high_3y_adj         NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS low_3y_adj          NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS pct_from_3y_high    NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS days_since_3y_high  INTEGER,
  ADD COLUMN IF NOT EXISTS dormancy_updated_at DATE;

COMMENT ON COLUMN km_equity_symbols.high_3y_adj IS
  'Cliff-adjusted 3-yr max close (compute_dormancy.py). Raw bhavcopy closes back-adjusted for split/bonus cliffs.';
COMMENT ON COLUMN km_equity_symbols.low_3y_adj IS
  'Cliff-adjusted 3-yr min close (compute_dormancy.py).';
COMMENT ON COLUMN km_equity_symbols.pct_from_3y_high IS
  '(last close / high_3y_adj - 1) * 100. Negative = below the 3-yr high. Dormancy gate input for Waking Giants / First Ascent.';
COMMENT ON COLUMN km_equity_symbols.days_since_3y_high IS
  'Calendar days since the 3-yr high was set. Old high + deep discount = dormant; recent high + deep discount = fresh crash.';
COMMENT ON COLUMN km_equity_symbols.dormancy_updated_at IS
  'Last run date of compute_dormancy.py.';
