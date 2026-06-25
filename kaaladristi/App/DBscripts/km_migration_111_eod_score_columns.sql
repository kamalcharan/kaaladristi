-- ============================================================
-- Migration 111 · km_equity_eod score + pct + surge columns
--
-- Adds avg_amt_66d, surge_22d, score_5d, score_22d,
-- pct_5d, pct_22d, pct_66d to km_equity_eod and
-- backfills all history in one window-function pass.
--
-- Target DB: kaala_dristi_db
-- ============================================================

-- ── STEP 1: Add columns ────────────────────────────────────────────────────────

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS avg_amt_66d NUMERIC,
  ADD COLUMN IF NOT EXISTS surge_22d   NUMERIC,
  ADD COLUMN IF NOT EXISTS score_5d    NUMERIC,
  ADD COLUMN IF NOT EXISTS score_22d   NUMERIC,
  ADD COLUMN IF NOT EXISTS pct_5d      NUMERIC,
  ADD COLUMN IF NOT EXISTS pct_22d     NUMERIC,
  ADD COLUMN IF NOT EXISTS pct_66d     NUMERIC;

-- ── STEP 2: Backfill all columns in one pass ───────────────────────────────────

WITH computed AS (
  SELECT
    id,

    -- avg_amt_66d
    AVG(delivery_qty * close / 1e7)
      OVER (
        PARTITION BY equity_id
        ORDER BY trade_date
        ROWS BETWEEN 65 PRECEDING AND CURRENT ROW
      ) AS new_avg_amt_66d,

    -- surge_22d = avg_amt_22d / avg_amt_66d
    CASE
      WHEN AVG(delivery_qty * close / 1e7)
        OVER (
          PARTITION BY equity_id
          ORDER BY trade_date
          ROWS BETWEEN 65 PRECEDING AND CURRENT ROW
        ) > 0
      THEN
        AVG(delivery_qty * close / 1e7)
          OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
          ) /
        AVG(delivery_qty * close / 1e7)
          OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN 65 PRECEDING AND CURRENT ROW
          )
      ELSE NULL
    END AS new_surge_22d,

    -- pct_5d = (close - close[T-4]) / close[T-4] * 100
    CASE
      WHEN LAG(close, 4) OVER (
        PARTITION BY equity_id ORDER BY trade_date
      ) > 0
      THEN ROUND(
        (close - LAG(close, 4) OVER (
          PARTITION BY equity_id ORDER BY trade_date
        )) / LAG(close, 4) OVER (
          PARTITION BY equity_id ORDER BY trade_date
        ) * 100, 2)
      ELSE NULL
    END AS new_pct_5d,

    -- pct_22d = (close - close[T-21]) / close[T-21] * 100
    CASE
      WHEN LAG(close, 21) OVER (
        PARTITION BY equity_id ORDER BY trade_date
      ) > 0
      THEN ROUND(
        (close - LAG(close, 21) OVER (
          PARTITION BY equity_id ORDER BY trade_date
        )) / LAG(close, 21) OVER (
          PARTITION BY equity_id ORDER BY trade_date
        ) * 100, 2)
      ELSE NULL
    END AS new_pct_22d,

    -- pct_66d = (close - close[T-65]) / close[T-65] * 100
    CASE
      WHEN LAG(close, 65) OVER (
        PARTITION BY equity_id ORDER BY trade_date
      ) > 0
      THEN ROUND(
        (close - LAG(close, 65) OVER (
          PARTITION BY equity_id ORDER BY trade_date
        )) / LAG(close, 65) OVER (
          PARTITION BY equity_id ORDER BY trade_date
        ) * 100, 2)
      ELSE NULL
    END AS new_pct_66d

  FROM km_equity_eod
),
with_scores AS (
  SELECT
    c.id,
    c.new_avg_amt_66d,
    c.new_surge_22d,
    c.new_pct_5d,
    c.new_pct_22d,
    c.new_pct_66d,
    e.avg_amt_5d,
    e.avg_amt_22d,

    -- score_5d
    CASE
      WHEN e.avg_amt_5d IS NULL
        OR e.avg_amt_22d IS NULL
        OR e.avg_amt_22d = 0
        THEN NULL
      WHEN c.new_pct_5d IS NULL
        OR c.new_pct_5d <= 0
        THEN 0
      WHEN e.avg_amt_5d / e.avg_amt_22d < 1.0
        THEN ROUND(c.new_pct_5d, 2)
      ELSE
        ROUND(
          POWER(e.avg_amt_5d / e.avg_amt_22d, 2) * 25
        , 2)
    END AS new_score_5d,

    -- score_22d
    CASE
      WHEN e.avg_amt_22d IS NULL
        OR c.new_avg_amt_66d IS NULL
        OR c.new_avg_amt_66d = 0
        THEN NULL
      WHEN c.new_pct_22d IS NULL
        OR c.new_pct_22d <= 0
        THEN 0
      WHEN e.avg_amt_22d / c.new_avg_amt_66d < 1.0
        THEN ROUND(c.new_pct_22d, 2)
      ELSE
        ROUND(
          POWER(e.avg_amt_22d / c.new_avg_amt_66d, 2) * 25
        , 2)
    END AS new_score_22d

  FROM computed c
  JOIN km_equity_eod e ON e.id = c.id
)
UPDATE km_equity_eod e
SET
  avg_amt_66d = ws.new_avg_amt_66d,
  surge_22d   = ws.new_surge_22d,
  pct_5d      = ws.new_pct_5d,
  pct_22d     = ws.new_pct_22d,
  pct_66d     = ws.new_pct_66d,
  score_5d    = ws.new_score_5d,
  score_22d   = ws.new_score_22d
FROM with_scores ws
WHERE e.id = ws.id;

-- ── STEP 3: Verify backfill ────────────────────────────────────────────────────

SELECT
  COUNT(*)          AS total_rows,
  COUNT(avg_amt_66d) AS has_66d,
  COUNT(score_5d)   AS has_score_5d,
  COUNT(score_22d)  AS has_score_22d,
  COUNT(pct_5d)     AS has_pct_5d,
  COUNT(pct_22d)    AS has_pct_22d,
  COUNT(pct_66d)    AS has_pct_66d
FROM km_equity_eod;

-- ── STEP 4: Verify CUPID scores match Excel ────────────────────────────────────
-- Expected for CUPID 2026-06-23:
--   score_5d  ≈ 49.96
--   score_22d ≈ 89.91
--   pct_5d    = +9.51%
--   pct_22d   = +51.27%
--   pct_66d   = +138.68%

SELECT
  s.symbol,
  e.trade_date,
  e.close,
  e.avg_amt_5d,
  e.avg_amt_22d,
  e.avg_amt_66d,
  e.score_5d,
  e.score_22d,
  e.pct_5d,
  e.pct_22d,
  e.pct_66d
FROM km_equity_eod e
JOIN km_equity_symbols s ON s.id = e.equity_id
WHERE s.symbol = 'CUPID'
  AND e.trade_date = '2026-06-23';
