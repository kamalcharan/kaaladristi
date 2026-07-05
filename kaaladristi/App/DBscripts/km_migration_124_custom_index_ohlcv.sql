-- ============================================================
-- Migration 124 · Custom Index Synthetic EOD — OHLC + volume
--
-- The synthetic EOD for category='custom' indices (migrations 119/122/123)
-- computed close / pct_chng / value_cr / ret_5d / ret_22d / ret_66d but
-- never open / high / low / volume. Every candlestick chart in the product
-- (Workspace chart, Index Detail → Chart tab) reads OHLC from km_index_eod,
-- so custom indices rendered broken/empty candles.
--
-- Synthesis (equal-weight basket, consistent with close = AVG(close)):
--   open   — AVG of constituent opens
--   high   — AVG of constituent highs
--   low    — AVG of constituent lows
--   volume — SUM of constituent volumes (volume aggregates; not an average)
--
-- Note: AVG(high) of an equal-weight basket is the mean of each name's
-- intraday high, not the basket's true intraday high (constituent highs
-- don't occur simultaneously). This is the standard equal-weight
-- approximation and is consistent with the close series.
--
-- Same 3-parameter signature as migrations 122/123 — all existing callers
-- (pipeline2 index_returns handler, legacy step 6d2, backfill script,
-- /api/custom-index/{id}/compute ⚡ Calculate button) work unchanged.
-- After applying, run ⚡ Calculate on each custom index (or the backfill
-- script) to fill history.
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION compute_custom_index_eod(
  p_from_date DATE DEFAULT NULL,
  p_to_date   DATE DEFAULT NULL,
  p_index_id  INT  DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  affected INT := 0;
BEGIN
  INSERT INTO km_index_eod (index_id, trade_date, open, high, low, close,
                            pct_chng, volume, value_cr,
                            ret_5d, ret_22d, ret_66d)
  SELECT
    c.index_id,
    e.trade_date,
    AVG(e.open)     AS open,
    AVG(e.high)     AS high,
    AVG(e.low)      AS low,
    AVG(e.close)    AS close,
    AVG(e.pct_chng) AS pct_chng,
    SUM(e.volume)   AS volume,
    SUM(e.value_cr) AS value_cr,
    AVG(e.ret_5d)   AS ret_5d,
    AVG(e.ret_22d)  AS ret_22d,
    AVG(e.ret_66d)  AS ret_66d
  FROM km_index_constituents c
  JOIN km_equity_eod   e ON e.equity_id = c.equity_id
  JOIN km_index_symbols s ON s.id = c.index_id
  WHERE s.category = 'custom'
    AND s.is_active = true
    AND (p_from_date IS NULL OR e.trade_date >= p_from_date)
    AND (p_to_date   IS NULL OR e.trade_date <= p_to_date)
    AND (p_index_id  IS NULL OR c.index_id = p_index_id)
  GROUP BY c.index_id, e.trade_date
  ON CONFLICT (index_id, trade_date) DO UPDATE SET
    open     = EXCLUDED.open,
    high     = EXCLUDED.high,
    low      = EXCLUDED.low,
    close    = EXCLUDED.close,
    pct_chng = EXCLUDED.pct_chng,
    volume   = EXCLUDED.volume,
    value_cr = EXCLUDED.value_cr,
    ret_5d   = EXCLUDED.ret_5d,
    ret_22d  = EXCLUDED.ret_22d,
    ret_66d  = EXCLUDED.ret_66d;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Signature unchanged from migration 122/123 — grants carry over, but
-- re-grant defensively for fresh databases.
GRANT EXECUTE ON FUNCTION compute_custom_index_eod(DATE, DATE, INT) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
