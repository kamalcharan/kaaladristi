-- ============================================================
-- Migration 096 · Custom Index Synthetic EOD RPC
--
-- Wraps the synthetic-EOD computation that previously lived only
-- in the standalone script scripts/compute_custom_index_eod.py
-- into a callable RPC so the daily pipeline can run it every day
-- (fixes lesson D41 — custom indices no longer need a manual run).
--
-- For every km_index_symbols row where category = 'custom' and
-- is_active = true, upserts one km_index_eod row per trading date
-- using the equal-weight average of that index's constituents
-- (km_index_constituents JOIN km_equity_eod).
--
-- Date range (both bounds optional, inclusive):
--   (NULL, NULL)              → recompute ALL trading dates (full backfill, slow)
--   ('2026-05-25', NULL)      → from that date to latest (targeted backfill)
--   (d, d)                    → a single date (daily pipeline use)
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

-- Drop the earlier single-date signature if it was already applied, so only
-- the range version below remains (avoids an ambiguous overload).
DROP FUNCTION IF EXISTS compute_custom_index_eod(DATE);

CREATE OR REPLACE FUNCTION compute_custom_index_eod(
  p_from_date DATE DEFAULT NULL,
  p_to_date   DATE DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  affected INT := 0;
BEGIN
  INSERT INTO km_index_eod (index_id, trade_date, close, ret_5d, ret_22d, ret_66d)
  SELECT
    c.index_id,
    e.trade_date,
    AVG(e.close)   AS close,
    AVG(e.ret_5d)  AS ret_5d,
    AVG(e.ret_22d) AS ret_22d,
    AVG(e.ret_66d) AS ret_66d
  FROM km_index_constituents c
  JOIN km_equity_eod   e ON e.equity_id = c.equity_id
  JOIN km_index_symbols s ON s.id = c.index_id
  WHERE s.category = 'custom'
    AND s.is_active = true
    AND (p_from_date IS NULL OR e.trade_date >= p_from_date)
    AND (p_to_date   IS NULL OR e.trade_date <= p_to_date)
  GROUP BY c.index_id, e.trade_date
  ON CONFLICT (index_id, trade_date) DO UPDATE SET
    close   = EXCLUDED.close,
    ret_5d  = EXCLUDED.ret_5d,
    ret_22d = EXCLUDED.ret_22d,
    ret_66d = EXCLUDED.ret_66d;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ── Permissions ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION compute_custom_index_eod(DATE, DATE) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
