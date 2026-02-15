-- ============================================================================
-- km_scale_indexes.sql — Compound indexes for 2000+ user scale
-- ============================================================================
-- These indexes optimize the most common query patterns that were missing
-- from the original schema. Without compound indexes, PostgreSQL must scan
-- one single-column index and then filter rows — with them, it can do an
-- index-only scan for the exact (index_id, trade_date) combination.
-- ============================================================================

-- ── km_index_eod: compound index for (index_id, trade_date) ──
-- Query pattern: WHERE index_id = ? AND trade_date >= ? ORDER BY trade_date
-- Without this: uses idx_index_eod_index, then scans + filters by date
-- With this:    direct index range scan on the compound key
CREATE INDEX IF NOT EXISTS idx_index_eod_compound
  ON km_index_eod (index_id, trade_date DESC);

-- ── km_equity_eod: same compound pattern ──
CREATE INDEX IF NOT EXISTS idx_equity_eod_compound
  ON km_equity_eod (equity_id, trade_date DESC);

-- ── km_daily_snapshots: symbol + date for calendar month queries ──
-- Already has UNIQUE(date, symbol) but we want symbol-first for
-- "give me all snapshots for NIFTY in Feb 2026" queries
-- (covered in km_daily_snapshots.sql but repeated here for completeness)
-- CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_date
--   ON km_daily_snapshots (symbol, date DESC);

-- ── ANALYZE after index creation ──
-- Run this after creating indexes to update query planner statistics:
-- ANALYZE km_index_eod;
-- ANALYZE km_equity_eod;
-- ANALYZE km_daily_snapshots;
