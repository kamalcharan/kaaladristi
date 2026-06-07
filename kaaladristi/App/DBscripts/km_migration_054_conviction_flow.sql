-- ============================================================================
-- Migration 054: Conviction Flow screener function
--
-- get_conviction_flow(p_date) returns stocks where 5-day delivery value
-- average is outpacing the 22-day norm (delivery_surge_x > 1.5).
--
-- Formula:
--   deliv_value_cr   = delivery_qty × close / 10,000,000
--   avg_amt_5d       = AVG(deliv_value_cr) over rolling 5 trading days
--   avg_amt_22d      = AVG(deliv_value_cr) over rolling 22 trading days
--   delivery_surge_x = avg_amt_5d / avg_amt_22d
--   d_pct            = (close − ema_20) / ema_20 × 100
--
-- Universe gate: only equities with MIN(trade_date) < '2024-01-01'
-- Screener filter: avg_amt_22d > 1.5, d_pct BETWEEN -8 AND 8, surge > 1.5
-- VaNi gate:       surge > 2, d_pct BETWEEN -3 AND 5, close > 100, avg_22d > 2
-- ============================================================================

CREATE OR REPLACE FUNCTION get_conviction_flow(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    equity_id           INTEGER,
    symbol              TEXT,
    trade_date          DATE,
    close               NUMERIC,
    ema_20              NUMERIC,
    d_pct               NUMERIC,
    avg_amt_5d          NUMERIC,
    avg_amt_22d         NUMERIC,
    deliv_value_cr      NUMERIC,
    delivery_surge_x    NUMERIC,
    is_vani_opportunity BOOLEAN
)
LANGUAGE SQL
STABLE
AS $$
WITH
-- Universe: equities with sufficient history (data before 2024)
universe AS (
    SELECT equity_id
    FROM km_equity_eod
    GROUP BY equity_id
    HAVING MIN(trade_date) < '2024-01-01'
),
-- Rank each equity's rows newest-first up to p_date, keep only rows with ema_20
ranked AS (
    SELECT
        e.equity_id,
        e.trade_date,
        e.close,
        e.ema_20,
        ROUND(
            (COALESCE(e.delivery_qty, 0) * e.close / 10000000.0)::NUMERIC,
            4
        ) AS deliv_value_cr,
        ROW_NUMBER() OVER (
            PARTITION BY e.equity_id
            ORDER BY e.trade_date DESC
        ) AS rn
    FROM km_equity_eod e
    JOIN universe u ON u.equity_id = e.equity_id
    WHERE e.trade_date <= p_date
      AND e.close  IS NOT NULL
      AND e.close  > 0
      AND e.ema_20 IS NOT NULL
),
-- Aggregate: pull latest-day values + rolling 5/22-day delivery averages
agg AS (
    SELECT
        equity_id,
        MAX(CASE WHEN rn = 1 THEN trade_date    END)                            AS trade_date,
        MAX(CASE WHEN rn = 1 THEN close         END)                            AS close,
        MAX(CASE WHEN rn = 1 THEN ema_20        END)                            AS ema_20,
        MAX(CASE WHEN rn = 1 THEN deliv_value_cr END)                           AS deliv_value_cr,
        ROUND(AVG(CASE WHEN rn <= 5  THEN deliv_value_cr END)::NUMERIC, 4)     AS avg_amt_5d,
        ROUND(AVG(CASE WHEN rn <= 22 THEN deliv_value_cr END)::NUMERIC, 4)     AS avg_amt_22d
    FROM ranked
    WHERE rn <= 22
    GROUP BY equity_id
),
-- Score: compute d_pct and delivery_surge_x
scored AS (
    SELECT
        a.equity_id,
        a.trade_date,
        a.close,
        a.ema_20,
        a.deliv_value_cr,
        a.avg_amt_5d,
        a.avg_amt_22d,
        ROUND(
            ((a.close - a.ema_20) / NULLIF(a.ema_20, 0) * 100)::NUMERIC,
            2
        ) AS d_pct,
        CASE
            WHEN a.avg_amt_22d > 0
            THEN ROUND((a.avg_amt_5d / a.avg_amt_22d)::NUMERIC, 4)
        END AS delivery_surge_x
    FROM agg a
    WHERE a.trade_date IS NOT NULL
)
SELECT
    sc.equity_id,
    s.symbol::TEXT,
    sc.trade_date,
    sc.close,
    sc.ema_20,
    sc.d_pct,
    sc.avg_amt_5d,
    sc.avg_amt_22d,
    sc.deliv_value_cr,
    sc.delivery_surge_x,
    (
        sc.delivery_surge_x > 2
        AND sc.d_pct BETWEEN -3 AND 5
        AND sc.close > 100
        AND sc.avg_amt_22d > 2
    ) AS is_vani_opportunity
FROM scored sc
JOIN km_equity_symbols s ON s.id = sc.equity_id
WHERE sc.avg_amt_22d      > 1.5
  AND sc.d_pct            BETWEEN -8 AND 8
  AND sc.delivery_surge_x > 1.5
ORDER BY sc.delivery_surge_x DESC;
$$;

GRANT EXECUTE ON FUNCTION get_conviction_flow(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conviction_flow(DATE) TO anon;

-- Verification (run after applying):
-- SELECT * FROM get_conviction_flow('2026-04-20')
--   WHERE symbol IN ('ASKAUTOLTD','WIPRO')
--   ORDER BY symbol;
-- Expected: ASKAUTOLTD → surge ≈ 2.13, is_vani=true  |  WIPRO → surge ≈ 1.54, is_vani=false
