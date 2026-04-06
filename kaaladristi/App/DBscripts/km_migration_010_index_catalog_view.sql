-- ============================================================
-- Migration 010 · Materialized view: mv_index_catalog
-- Pre-aggregated index catalog for Settings → Market Data
-- Avoids expensive JOIN + GROUP BY on every frontend request
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_index_catalog;

CREATE MATERIALIZED VIEW mv_index_catalog AS
SELECT
  s.id,
  s.name,
  s.category,
  COALESCE(s.exchange, 'NSE') AS exchange,
  MIN(e.trade_date)            AS data_from,
  MAX(e.trade_date)            AS data_to,
  COUNT(e.id)::INT             AS record_count,
  -- last close (from most recent trade_date)
  (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1] AS last_close
FROM km_index_symbols s
LEFT JOIN km_index_eod e ON e.index_id = s.id
GROUP BY s.id, s.name, s.category, s.exchange;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_index_catalog_id ON mv_index_catalog (id);

-- ── Permissions ──────────────────────────────────────────────
GRANT SELECT ON mv_index_catalog TO authenticated, kd_app, anon;

-- ── Helper: refresh function (call after data sync) ─────────
CREATE OR REPLACE FUNCTION refresh_index_catalog()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_index_catalog;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_index_catalog() TO authenticated, kd_app;

-- ── Initial refresh ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
