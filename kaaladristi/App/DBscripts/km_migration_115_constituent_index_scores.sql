-- ============================================================
-- Migration 115 — compute_all_index_scores() v2
-- Target DB: kaala_dristi_db
-- ============================================================
--
-- Replaces value_cr rolling window approach (v1) with constituent
-- equity aggregate approach (v2):
--
--   avg_amt_5d/22d/66d = SUM of constituent avg_amt values
--                        (total delivery flow into the index)
--   score_5d/22d       = AVG of constituent score values
--                        (equal weight — weight_pct not populated)
--
-- Source: km_equity_eod rolling metrics (already pre-computed
--         by backfill_rolling_metrics_fast.py and daily pipeline).
-- Join:   km_index_constituents (equity_id → index_id mapping).
--
-- India VIX (index_id=94) has no constituents → UPDATE never
-- matches → stays NULL.  That is correct.
--
-- Function signature and return type unchanged from migration 113.
-- ============================================================

CREATE OR REPLACE FUNCTION compute_all_index_scores(
  p_from_date DATE DEFAULT NULL
)
RETURNS TABLE(out_index_id INT, rows_updated INT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH

  -- Aggregate pre-computed rolling metrics from constituent equities.
  -- Date filter is applied here (safe — rolling metrics already stored
  -- in km_equity_eod; no window look-back needed in this function).
  constituent_agg AS (
    SELECT
      c.index_id,
      e.trade_date,
      SUM(e.avg_amt_5d)   AS new_avg_amt_5d,
      SUM(e.avg_amt_22d)  AS new_avg_amt_22d,
      SUM(e.avg_amt_66d)  AS new_avg_amt_66d,
      AVG(e.score_5d)     AS new_score_5d,
      AVG(e.score_22d)    AS new_score_22d
    FROM km_index_constituents c
    JOIN km_equity_eod e ON e.equity_id = c.equity_id
    WHERE (p_from_date IS NULL OR e.trade_date >= p_from_date)
    GROUP BY c.index_id, e.trade_date
  ),

  updated AS (
    UPDATE km_index_eod idx
    SET
      avg_amt_5d  = ca.new_avg_amt_5d,
      avg_amt_22d = ca.new_avg_amt_22d,
      avg_amt_66d = ca.new_avg_amt_66d,
      score_5d    = ROUND(ca.new_score_5d::NUMERIC,  2),
      score_22d   = ROUND(ca.new_score_22d::NUMERIC, 2)
    FROM constituent_agg ca
    WHERE idx.index_id   = ca.index_id
      AND idx.trade_date = ca.trade_date
    RETURNING idx.index_id
  )

  SELECT
    u.index_id::INT AS out_index_id,
    COUNT(*)::INT   AS rows_updated
  FROM updated u
  GROUP BY u.index_id
  ORDER BY u.index_id;

END;
$$;
