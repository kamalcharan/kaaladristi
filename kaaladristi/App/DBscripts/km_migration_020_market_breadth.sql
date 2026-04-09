-- Migration 020: Market Breadth — physical table + PostgREST grant
-- Populated by compute_market_breadth.py (pandas EMA computation).
-- Breadth Score = 50% × (% above 20 EMA) + 30% × (% above 50 EMA) + 20% × (% above 150 EMA)
-- Regimes: Greed >55 · Neutral 35-55 · Fear <35

-- Drop any previous attempt (plain view or materialized view)
DROP VIEW             IF EXISTS km_market_breadth CASCADE;
DROP MATERIALIZED VIEW IF EXISTS km_market_breadth CASCADE;
DROP TABLE            IF EXISTS km_market_breadth CASCADE;

CREATE TABLE km_market_breadth (
    trade_date    DATE        PRIMARY KEY,
    pct_above_20  NUMERIC(5,2),   -- % of NSE stocks above their 20-day EMA
    pct_above_50  NUMERIC(5,2),   -- % of NSE stocks above their 50-day EMA
    pct_above_150 NUMERIC(5,2),   -- % of NSE stocks above their 150-day EMA
    breadth_score NUMERIC(5,2),   -- composite score 0-100
    stock_count   INTEGER          -- number of stocks with enough EMA history
);

CREATE INDEX idx_km_market_breadth_date ON km_market_breadth (trade_date DESC);

GRANT SELECT ON km_market_breadth TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
