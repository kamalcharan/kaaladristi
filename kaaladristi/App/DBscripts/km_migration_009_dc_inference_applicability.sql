-- ============================================================
-- Migration 009 · dc_inference applicability
-- Adds scope + JSONB applicability; backfills existing records
-- ============================================================

ALTER TABLE dc_inference
  ADD COLUMN IF NOT EXISTS applicability_scope TEXT[]
    DEFAULT ARRAY['equity']::TEXT[],
  ADD COLUMN IF NOT EXISTS applicability JSONB
    DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_dc_inference_scope
  ON dc_inference USING GIN(applicability_scope);

CREATE INDEX IF NOT EXISTS idx_dc_inference_applicability
  ON dc_inference USING GIN(applicability);

-- ── Backfill existing records ─────────────────────────────────
-- Default: applies to equity / all sectors
UPDATE dc_inference
SET
  applicability_scope = ARRAY['equity']::TEXT[],
  applicability = '{"equity": {"all_sectors": true, "sectors": []}}'::JSONB
WHERE applicability_scope IS NULL
   OR applicability_scope = '{}'::TEXT[]
   OR applicability = '{}'::JSONB;

DO $$
DECLARE v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'dc_inference: % existing rows backfilled with equity defaults', v_updated;
END $$;
