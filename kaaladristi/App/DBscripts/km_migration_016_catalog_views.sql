-- ============================================================
-- Migration 016 · Equity + Commodity Catalog Views
-- Materialized views for Market Data settings pages
-- ============================================================

-- ── 1. Add is_active to equity symbols ─────────────────────
ALTER TABLE km_equity_symbols ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ── 2. mv_equity_catalog ───────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_equity_catalog;
CREATE MATERIALIZED VIEW mv_equity_catalog AS
SELECT
  e.id,
  e.symbol,
  e.exchange,
  COALESCE(e.is_active, TRUE)                     AS is_active,
  e.index_names,
  MIN(eod.trade_date)                             AS data_from,
  MAX(eod.trade_date)                             AS data_to,
  COUNT(eod.id)::int                              AS record_count,
  (
    SELECT eod2.close
    FROM   km_equity_eod eod2
    WHERE  eod2.equity_id = e.id
    ORDER  BY eod2.trade_date DESC
    LIMIT  1
  )                                               AS last_close
FROM km_equity_symbols e
LEFT JOIN km_equity_eod eod ON eod.equity_id = e.id
GROUP BY e.id, e.symbol, e.exchange, e.is_active, e.index_names
ORDER BY e.exchange, e.symbol;

-- Indexes needed for CONCURRENTLY refresh and PostgREST filters
CREATE UNIQUE INDEX ON mv_equity_catalog (id);
CREATE        INDEX ON mv_equity_catalog (exchange);
CREATE        INDEX ON mv_equity_catalog (symbol);

-- Refresh helper — called after toggleEquityActive
CREATE OR REPLACE FUNCTION refresh_equity_catalog()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_equity_catalog;
$$;

-- Permissions
GRANT SELECT ON mv_equity_catalog TO authenticated, anon;
GRANT EXECUTE ON FUNCTION refresh_equity_catalog() TO authenticated;

-- ── 3. mv_commodity_catalog ────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_commodity_catalog;
CREATE MATERIALIZED VIEW mv_commodity_catalog AS
SELECT
  c.id,
  c.symbol,
  c.name,
  c.exchange,
  c.category,
  MIN(eod.trade_date)                             AS data_from,
  MAX(eod.trade_date)                             AS data_to,
  COUNT(eod.id)::int                              AS record_count,
  (
    SELECT eod2.close
    FROM   km_commodity_eod eod2
    WHERE  eod2.commodity_id = c.id
    ORDER  BY eod2.trade_date DESC
    LIMIT  1
  )                                               AS last_close
FROM km_commodity_symbols c
LEFT JOIN km_commodity_eod eod ON eod.commodity_id = c.id
GROUP BY c.id, c.symbol, c.name, c.exchange, c.category
ORDER BY c.exchange, c.symbol;

CREATE UNIQUE INDEX ON mv_commodity_catalog (id);
CREATE        INDEX ON mv_commodity_catalog (exchange);

CREATE OR REPLACE FUNCTION refresh_commodity_catalog()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_commodity_catalog;
$$;

GRANT SELECT ON mv_commodity_catalog TO authenticated, anon;
GRANT EXECUTE ON FUNCTION refresh_commodity_catalog() TO authenticated;

NOTIFY pgrst, 'reload schema';
