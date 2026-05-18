-- ============================================================
-- Migration 077 · km_equity_eod Composite Index
--
-- Adds a covering index on (equity_id, trade_date DESC) to
-- support the two most common query patterns:
--   1. Fetch all rows for one equity ordered by date
--      (indicator compute loops, history fetches)
--   2. Scanner queries that filter on equity_id and sort by
--      trade_date to get the latest bar
--
-- Also adds an index on (trade_date DESC) alone to speed up
-- the daily pipeline's "all rows for today" aggregation step.
-- ============================================================

BEGIN;

-- ── Primary access pattern: one equity, ordered by date ──────

CREATE INDEX IF NOT EXISTS idx_equity_eod_equity_date
  ON km_equity_eod(equity_id, trade_date DESC);

-- ── Pending indicator detection (used by compute_all_pending_indicators) ──

CREATE INDEX IF NOT EXISTS idx_equity_eod_pending_indicators
  ON km_equity_eod(equity_id)
  WHERE indicators_computed_at IS NULL;

-- ── Date-only access: daily pipeline aggregations ─────────────

CREATE INDEX IF NOT EXISTS idx_equity_eod_trade_date
  ON km_equity_eod(trade_date DESC);

NOTIFY pgrst, 'reload schema';

COMMIT;
