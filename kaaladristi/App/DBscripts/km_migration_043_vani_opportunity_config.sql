-- ============================================================
-- Migration 043 · VaNi Opportunity policy config table
--
-- Admin-configurable opportunity policy. The frontend reads the
-- active row and applies it to each ScanStock to set
-- vaniOpportunity = true when all gates pass.
--
-- Default policy (inserted below):
--   ema_atr_band         1.0  → close within 1× ATR of EMA(20)
--   reward_min_atr_mult  0.0  → any positive reward qualifies
--   magic_rs_zones       ['Strong Bull','Mild Bull']
--   flow_types           ['FRESH_LONGS','SHORT_COVERING']
--   rvol_min             1.2
-- ============================================================

CREATE TABLE IF NOT EXISTS km_vani_opportunity_config (
  id                       SERIAL PRIMARY KEY,
  policy_name              TEXT    NOT NULL DEFAULT 'default',
  ema_atr_band             NUMERIC NOT NULL DEFAULT 1.0,
  reward_min_atr_multiple  NUMERIC NOT NULL DEFAULT 0.0,
  magic_rs_zones           TEXT[]  NOT NULL DEFAULT ARRAY['Strong Bull','Mild Bull'],
  flow_types               TEXT[]  NOT NULL DEFAULT ARRAY['FRESH_LONGS','SHORT_COVERING'],
  rvol_min                 NUMERIC NOT NULL DEFAULT 1.2,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default policy
INSERT INTO km_vani_opportunity_config DEFAULT VALUES
  ON CONFLICT DO NOTHING;

GRANT ALL ON km_vani_opportunity_config TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_vani_opportunity_config_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
