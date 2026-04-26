-- Migration 068 · Fix km_index_eod prev_close / chng / pct_chng
-- ============================================================
--
-- Root cause: nse_index_bhav.py _safe_float() called .replace('-', '')
-- which stripped the minus sign from every negative number. NSE bhav
-- "Points Change" is negative on down days; after stripping it became
-- positive, making prev_close and pct_chng wrong in sign on any day
-- the index closed lower than the prior session.
--
-- Example (NIFTY 50, 2026-04-24):
--   NSE reported Points Change = -275.10  →  stripped to  275.10
--   prev_close stored as  23,897.95 - 275.10  =  23,622.85  (wrong)
--   pct_chng stored as  +1.14  (wrong sign; market was down -1.14 %)
--
-- Fix: recompute prev_close, chng, pct_chng for every row using
-- LAG(close) partitioned by index_id — the only reliable source.
-- Rows with no prior row (first row per index) are left untouched.

UPDATE km_index_eod AS e
SET
  prev_close = w.lag_close,
  chng       = ROUND((e.close - w.lag_close)::NUMERIC, 2),
  pct_chng   = ROUND(((e.close - w.lag_close) / w.lag_close * 100)::NUMERIC, 2)
FROM (
  SELECT
    index_id,
    trade_date,
    LAG(close) OVER (PARTITION BY index_id ORDER BY trade_date) AS lag_close
  FROM km_index_eod
) AS w
WHERE e.index_id  = w.index_id
  AND e.trade_date = w.trade_date
  AND w.lag_close  IS NOT NULL;
