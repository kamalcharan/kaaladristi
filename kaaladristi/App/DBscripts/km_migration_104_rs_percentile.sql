-- ============================================================
-- Migration 104: rs_percentile column on km_equity_eod
-- Target DB: kaala_dristi_db
-- Run: manually in pgAdmin / psql — DO NOT run via Python wrapper
-- ============================================================
--
-- Adds rs_percentile NUMERIC(5,2) — each equity's percentile rank
-- within the universe on that trade_date, based on magic_rs.
-- 0.00 = weakest RS, 100.00 = strongest RS.
-- Computed nightly in pipeline step 6k (after magic_rs, before vani_flags).
--
-- VaNi Stage 2 scanner query (reference — not executed here):
--
--   SELECT
--       e.equity_id,
--       s.symbol,
--       s.company_name,
--       e.close,
--       e.stage,
--       e.rs_percentile,
--       e.magic_rs,
--       e.sma_50,
--       e.sma_150,
--       e.is_vani_s2
--   FROM km_equity_eod e
--   JOIN km_equity_symbols s ON s.id = e.equity_id
--   WHERE e.trade_date = '2026-06-17'
--     AND e.close > e.sma_150          -- Alpha Edge: price above long-term trend
--     AND e.sma_50 > e.sma_150         -- Alpha Edge: short-term MA above long-term MA
--     AND e.close > 30                 -- Price filter: exclude sub-penny / illiquid
--     AND e.rs_percentile > 80         -- VaNi RS leader: top 20% of universe
--     AND e.stage IN ('S2', 'S2_CANDIDATE')
--   ORDER BY e.rs_percentile DESC
--   LIMIT 20;
-- ============================================================

-- Step 1: Add column
ALTER TABLE km_equity_eod
ADD COLUMN IF NOT EXISTS rs_percentile NUMERIC(5,2);

-- Step 2: Backfill all existing rows where magic_rs is populated
UPDATE km_equity_eod e
SET rs_percentile = sub.pct
FROM (
    SELECT id,
        ROUND(
            PERCENT_RANK() OVER (
                PARTITION BY trade_date
                ORDER BY magic_rs ASC NULLS LAST
            )::numeric * 100, 2
        ) AS pct
    FROM km_equity_eod
    WHERE magic_rs IS NOT NULL
) sub
WHERE e.id = sub.id;

-- Step 3: Verify a recent date (adjust date as needed)
SELECT
    trade_date,
    COUNT(*)                                    AS total_rows,
    COUNT(rs_percentile)                        AS scored,
    MIN(rs_percentile)                          AS min_pct,
    MAX(rs_percentile)                          AS max_pct,
    COUNT(*) FILTER (WHERE rs_percentile > 80)  AS rs_leaders
FROM km_equity_eod
WHERE trade_date = '2026-06-17'
GROUP BY trade_date;
