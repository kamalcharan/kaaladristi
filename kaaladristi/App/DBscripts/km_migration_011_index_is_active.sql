-- ============================================================
-- Migration 011 · is_active flag on km_index_symbols
-- Allows deactivating indexes from the Market Data Explorer
-- ============================================================

ALTER TABLE km_index_symbols
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── Rebuild materialized view to include is_active ──────────
DROP MATERIALIZED VIEW IF EXISTS mv_index_catalog;

CREATE MATERIALIZED VIEW mv_index_catalog AS
SELECT
  s.id,
  s.name,
  s.category,
  COALESCE(s.exchange, 'NSE') AS exchange,
  s.is_active,
  COALESCE(s.is_tri, FALSE)   AS is_tri,
  MIN(e.trade_date)            AS data_from,
  MAX(e.trade_date)            AS data_to,
  COUNT(e.id)::INT             AS record_count,
  (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1] AS last_close
FROM km_index_symbols s
LEFT JOIN km_index_eod e ON e.index_id = s.id
GROUP BY s.id, s.name, s.category, s.exchange, s.is_active, s.is_tri;

CREATE UNIQUE INDEX idx_mv_index_catalog_id ON mv_index_catalog (id);

-- ── Permissions ─────────────────────────────────────────────
GRANT SELECT ON mv_index_catalog TO authenticated, kd_app, anon;
GRANT ALL ON km_index_symbols TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
