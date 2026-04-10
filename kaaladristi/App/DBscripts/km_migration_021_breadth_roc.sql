-- Migration 021: Breadth ROC Oscillator — physical table
-- Populated by compute_breadth_roc.py
--
-- ROC_13  = GroupAvg( (Close - Close[13]) / Close[13] × 100 ) / 13
-- ROC_55  = GroupAvg( (Close - Close[55]) / Close[55] × 100 ) / 55
-- SMA     = 5-period rolling average of ROC_13 (smoothed signal)
--
-- Positive values = group momentum accelerating upward
-- Negative values = group momentum decelerating / falling
-- Zero line crossing = momentum regime change

DO $$
DECLARE
  obj_kind char;
BEGIN
  SELECT relkind INTO obj_kind
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  c.relname = 'km_breadth_roc'
    AND  n.nspname = 'public';

  IF obj_kind = 'v' THEN
    EXECUTE 'DROP VIEW              km_breadth_roc CASCADE';
  ELSIF obj_kind = 'm' THEN
    EXECUTE 'DROP MATERIALIZED VIEW km_breadth_roc CASCADE';
  ELSIF obj_kind = 'r' THEN
    EXECUTE 'DROP TABLE             km_breadth_roc CASCADE';
  END IF;
END;
$$;

CREATE TABLE km_breadth_roc (
    trade_date   DATE        PRIMARY KEY,
    roc_13       NUMERIC(8,4),   -- avg 13-day ROC across NSE stocks / 13
    roc_55       NUMERIC(8,4),   -- avg 55-day ROC across NSE stocks / 55
    sma_breadth  NUMERIC(8,4),   -- 5-period SMA of roc_13 (smoothed signal)
    stock_count  INTEGER          -- number of stocks contributing to the reading
);

CREATE INDEX idx_km_breadth_roc_date ON km_breadth_roc (trade_date DESC);

GRANT SELECT ON km_breadth_roc TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
