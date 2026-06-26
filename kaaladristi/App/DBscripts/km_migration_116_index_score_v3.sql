-- ============================================================
-- Migration 116 — compute_all_index_scores() v3
-- Target DB: kaala_dristi_db
-- ============================================================
--
-- Replaces v2 (migration 115) which averaged constituent
-- score_5d/22d values (wrong — averaged pre-computed scores
-- instead of applying index-level formula).
--
-- New logic per Index_Score_Spec_v1.0 + D29-D30:
--
--   avg_amt_5d/22d/66d = SUM of constituent avg_amt values
--                        (total delivery flow into the index)
--
--   score_5d  = idx_ret_5d  + max(0, pct_amt_chg_5)
--               if idx_ret_5d > 0, else 0
--   score_22d = idx_ret_22d + max(0, pct_amt_chg_22)
--               if idx_ret_22d > 0, else 0
--
--   where:
--     idx_ret_5d/22d  = real index return from km_index_eod
--     pct_amt_chg_5   = (idx_amt_5d  - idx_amt_22d) / idx_amt_22d x 100
--     pct_amt_chg_22  = (idx_amt_22d - idx_amt_66d) / idx_amt_66d x 100
--
-- India VIX (index_id=94) has no constituents -> constituent_agg
-- produces no rows -> UPDATE never matches -> scores stay 0. Expected.
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

  -- Step 1: Sum constituent rolling amounts per (index, date).
  -- Date filter applied here — rolling metrics already stored in
  -- km_equity_eod; no window look-back needed in this function.
  constituent_agg AS (
    SELECT
      c.index_id,
      e.trade_date,
      SUM(e.avg_amt_5d)  AS idx_amt_5d,
      SUM(e.avg_amt_22d) AS idx_amt_22d,
      SUM(e.avg_amt_66d) AS idx_amt_66d
    FROM km_index_constituents c
    JOIN km_equity_eod e ON e.equity_id = c.equity_id
    WHERE (p_from_date IS NULL OR e.trade_date >= p_from_date)
    GROUP BY c.index_id, e.trade_date
  ),

  -- Step 2: Join real index returns from km_index_eod and derive scores.
  with_scores AS (
    SELECT
      ca.index_id,
      ca.trade_date,
      ca.idx_amt_5d,
      ca.idx_amt_22d,
      ca.idx_amt_66d,
      -- Real index N-session returns (already stored by daily pipeline)
      ie.ret_5d  AS idx_ret_5d,
      ie.ret_22d AS idx_ret_22d,
      -- Index-level surge terms
      (ca.idx_amt_5d  - ca.idx_amt_22d) / NULLIF(ca.idx_amt_22d, 0) * 100
        AS pct_amt_chg_5,
      (ca.idx_amt_22d - ca.idx_amt_66d) / NULLIF(ca.idx_amt_66d, 0) * 100
        AS pct_amt_chg_22
    FROM constituent_agg ca
    JOIN km_index_eod ie
      ON  ie.index_id   = ca.index_id
      AND ie.trade_date = ca.trade_date
  ),

  updated AS (
    UPDATE km_index_eod idx
    SET
      avg_amt_5d  = ws.idx_amt_5d,
      avg_amt_22d = ws.idx_amt_22d,
      avg_amt_66d = ws.idx_amt_66d,
      score_5d = CASE
        WHEN ws.idx_ret_5d IS NULL OR ws.idx_ret_5d <= 0 THEN 0
        ELSE ROUND(ws.idx_ret_5d + GREATEST(0, ws.pct_amt_chg_5), 2)
      END,
      score_22d = CASE
        WHEN ws.idx_ret_22d IS NULL OR ws.idx_ret_22d <= 0 THEN 0
        ELSE ROUND(ws.idx_ret_22d + GREATEST(0, ws.pct_amt_chg_22), 2)
      END
    FROM with_scores ws
    WHERE idx.index_id   = ws.index_id
      AND idx.trade_date = ws.trade_date
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
