-- Migration 020: Market Breadth materialized view + RPC
-- Aggregates NSE equity advances/declines/unchanged per trading day.
-- Refresh daily after EOD pipeline completes.

-- ── 1. Materialized view ──────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS km_market_breadth AS
SELECT
    e.trade_date,
    COUNT(*) FILTER (WHERE e.pct_chng > 0)   AS advances,
    COUNT(*) FILTER (WHERE e.pct_chng < 0)   AS declines,
    COUNT(*) FILTER (WHERE e.pct_chng = 0)   AS unchanged,
    ROUND(
        COUNT(*) FILTER (WHERE e.pct_chng > 0) * 100.0
        / NULLIF(COUNT(*), 0),
        2
    )                                         AS advance_pct
FROM km_equity_eod  e
JOIN km_equity_symbols s ON s.id = e.equity_id
WHERE s.exchange   = 'NSE'
  AND e.close      IS NOT NULL
  AND e.pct_chng   IS NOT NULL    -- exclude rows with no prev_close (IPO day etc.)
GROUP BY e.trade_date
ORDER BY e.trade_date;

-- Unique index required for REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_km_market_breadth_date
    ON km_market_breadth (trade_date);

GRANT SELECT ON km_market_breadth TO authenticated, anon;

-- ── 2. RPC: get_market_breadth ────────────────────────────────────────────────
-- Called by the frontend.  Supports daily / weekly / monthly resolution
-- so 5Y and MAX ranges stay fast (Recharts renders fewer points).
--
-- p_days  = 0 means "all history"
-- p_resolution: 'daily' | 'weekly' | 'monthly'

CREATE OR REPLACE FUNCTION get_market_breadth(
    p_days       INT  DEFAULT 60,
    p_resolution TEXT DEFAULT 'daily'
)
RETURNS TABLE (
    trade_date   DATE,
    advances     BIGINT,
    declines     BIGINT,
    unchanged    BIGINT,
    advance_pct  NUMERIC
)
LANGUAGE sql STABLE AS $$
    SELECT
        CASE p_resolution
            WHEN 'weekly'  THEN date_trunc('week',  mb.trade_date)::DATE
            WHEN 'monthly' THEN date_trunc('month', mb.trade_date)::DATE
            ELSE                mb.trade_date
        END                           AS trade_date,
        SUM(mb.advances)::BIGINT      AS advances,
        SUM(mb.declines)::BIGINT      AS declines,
        SUM(mb.unchanged)::BIGINT     AS unchanged,
        ROUND(AVG(mb.advance_pct), 2) AS advance_pct
    FROM km_market_breadth mb
    WHERE (
        p_days <= 0
        OR mb.trade_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    )
    GROUP BY 1
    ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_market_breadth(INT, TEXT) TO authenticated, anon;

-- ── 3. Notify PostgREST ───────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
