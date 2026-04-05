-- ============================================================
-- Migration 008 · dc_lookup
-- Common reference lookup table (sectors, indexes, commodities)
-- Seeds from existing km_sectors + km_index_symbols tables
-- ============================================================

CREATE TABLE IF NOT EXISTS dc_lookup (
  id          SERIAL PRIMARY KEY,
  category    TEXT        NOT NULL,   -- 'sector' | 'index' | 'commodity'
  code        TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  sort_order  SMALLINT    DEFAULT 0,
  is_active   BOOLEAN     DEFAULT TRUE,
  UNIQUE(category, code)
);

CREATE INDEX IF NOT EXISTS idx_dc_lookup_category ON dc_lookup(category) WHERE is_active = TRUE;

GRANT ALL ON dc_lookup           TO authenticated, kd_app, anon;
GRANT ALL ON dc_lookup_id_seq    TO authenticated, kd_app, anon;

-- ── Seed sectors from km_sectors ─────────────────────────────
INSERT INTO dc_lookup (category, code, label, sort_order)
SELECT 'sector', name, name, ROW_NUMBER() OVER (ORDER BY id)
FROM   km_sectors
ON CONFLICT (category, code) DO NOTHING;

-- ── Seed indexes from km_index_symbols ───────────────────────
INSERT INTO dc_lookup (category, code, label, sort_order)
SELECT 'index', name, name, ROW_NUMBER() OVER (ORDER BY id)
FROM   km_index_symbols
ON CONFLICT (category, code) DO NOTHING;

-- ── Seed commodities (MCX / NCDEX instruments) ───────────────
INSERT INTO dc_lookup (category, code, label, sort_order) VALUES
  ('commodity', 'gold',        'Gold',         1),
  ('commodity', 'silver',      'Silver',       2),
  ('commodity', 'crude_oil',   'Crude Oil',    3),
  ('commodity', 'natural_gas', 'Natural Gas',  4),
  ('commodity', 'copper',      'Copper',       5),
  ('commodity', 'zinc',        'Zinc',         6),
  ('commodity', 'lead',        'Lead',         7),
  ('commodity', 'nickel',      'Nickel',       8),
  ('commodity', 'aluminium',   'Aluminium',    9),
  ('commodity', 'cotton',      'Cotton',      10),
  ('commodity', 'soybean',     'Soybean',     11),
  ('commodity', 'wheat',       'Wheat',       12),
  ('commodity', 'castor_seed', 'Castor Seed', 13),
  ('commodity', 'mentha_oil',  'Mentha Oil',  14),
  ('commodity', 'turmeric',    'Turmeric',    15),
  ('commodity', 'cardamom',    'Cardamom',    16)
ON CONFLICT (category, code) DO NOTHING;

-- ── Verify ───────────────────────────────────────────────────
DO $$
DECLARE
  v_sectors    INTEGER;
  v_indexes    INTEGER;
  v_commodities INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sectors    FROM dc_lookup WHERE category = 'sector';
  SELECT COUNT(*) INTO v_indexes    FROM dc_lookup WHERE category = 'index';
  SELECT COUNT(*) INTO v_commodities FROM dc_lookup WHERE category = 'commodity';
  RAISE NOTICE 'dc_lookup seeded: % sectors, % indexes, % commodities',
    v_sectors, v_indexes, v_commodities;
END $$;
