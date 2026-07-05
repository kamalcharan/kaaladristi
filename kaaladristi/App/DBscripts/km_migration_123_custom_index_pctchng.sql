-- ============================================================
-- Migration 123 · Custom Index Synthetic EOD — pct_chng + value_cr
--
-- The synthetic EOD for category='custom' indices (migrations 119/122)
-- computed only close / ret_5d / ret_22d / ret_66d. Two columns the UI
-- reads were never synthesized:
--
--   pct_chng — daily % change. The Sector Rotation heatmap's micro-trend
--              bars plot it (curated rows rendered as a flat line) and the
--              table's %Chg column showed "—" for curated indices.
--              Synthesized as AVG of constituent pct_chng — the daily
--              return of an equal-weight portfolio.
--   value_cr — traded value (₹ Cr). The heat cell tooltip's "Traded Value"
--              showed ₹0.0 Cr for curated indices. Synthesized as SUM of
--              constituent turnover (turnover aggregates; it is not an
--              average).
--
-- Same 3-parameter signature as migration 122 — all existing callers
-- (pipeline2 index_returns handler, legacy step 6d2, backfill script,
-- /api/custom-index/{id}/compute) work unchanged.
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
  INSERT INTO km_index_eod (index_id, trade_date, close, pct_chng, value_cr,
                            ret_5d, ret_22d, ret_66d)
  SELECT
    c.index_id,
    e.trade_date,
    AVG(e.close)    AS close,
    AVG(e.pct_chng) AS pct_chng,
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
    close    = EXCLUDED.close,
    pct_chng = EXCLUDED.pct_chng,
    value_cr = EXCLUDED.value_cr,
    ret_5d   = EXCLUDED.ret_5d,
    ret_22d  = EXCLUDED.ret_22d,
    ret_66d  = EXCLUDED.ret_66d;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Signature unchanged from migration 122 — grants carry over, but re-grant
-- defensively for fresh databases.
GRANT EXECUTE ON FUNCTION compute_custom_index_eod(DATE, DATE, INT) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
