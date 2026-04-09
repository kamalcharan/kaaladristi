-- Migration 020: Market Breadth — physical table + PostgREST grant
-- Populated by compute_market_breadth.py (pandas EMA computation).
-- Breadth Score = 50% × (% above 20 EMA) + 30% × (% above 50 EMA) + 20% × (% above 150 EMA)
-- Regimes: Greed >55 · Neutral 35-55 · Fear <35

-- Drop whatever type km_market_breadth currently is (view / mat-view / table)
-- DROP VIEW IF EXISTS errors on a mat-view even with IF EXISTS — use pg_class instead.
DO $$
DECLARE
  obj_kind char;
BEGIN
  SELECT relkind INTO obj_kind
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  c.relname = 'km_market_breadth'
    AND  n.nspname = 'public';

  IF obj_kind = 'v' THEN
    EXECUTE 'DROP VIEW              km_market_breadth CASCADE';
  ELSIF obj_kind = 'm' THEN
    EXECUTE 'DROP MATERIALIZED VIEW km_market_breadth CASCADE';
  ELSIF obj_kind = 'r' THEN
    EXECUTE 'DROP TABLE             km_market_breadth CASCADE';
  END IF;
  -- If obj_kind IS NULL the object doesn't exist — nothing to do.
END;
$$;

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
