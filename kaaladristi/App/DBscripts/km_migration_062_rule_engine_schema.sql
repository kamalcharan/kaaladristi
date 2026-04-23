-- Migration: 062
-- Date: 2026-04-23
-- Description: Rule Engine schema alterations
--   - Extend km_astro_rule_master with rule engine columns
--   - Extend km_rule_signals with backtesting columns
--   - Create km_rule_confidence table

-- ── 1. ALTER km_astro_rule_master ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='scope')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN scope jsonb NOT NULL DEFAULT '["market"]'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='outcome')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN outcome text; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='probability_label')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN probability_label text; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='data_source')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN data_source text DEFAULT 'available'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='is_deleted')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN is_deleted boolean NOT NULL DEFAULT false; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='conditions')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN conditions jsonb; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_astro_rule_master' AND column_name='updated_at')
  THEN ALTER TABLE km_astro_rule_master ADD COLUMN updated_at timestamptz DEFAULT now(); END IF;
END $$;

-- ── 2. ALTER km_rule_signals ───────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_rule_signals' AND column_name='actual_market_return')
  THEN ALTER TABLE km_rule_signals ADD COLUMN actual_market_return numeric; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_rule_signals' AND column_name='matched')
  THEN ALTER TABLE km_rule_signals ADD COLUMN matched boolean; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='km_rule_signals' AND column_name='conditions_snapshot')
  THEN ALTER TABLE km_rule_signals ADD COLUMN conditions_snapshot jsonb; END IF;
END $$;

-- ── 3. CREATE km_rule_confidence ──────────────────────────────
CREATE TABLE IF NOT EXISTS km_rule_confidence (
  rule_id             integer PRIMARY KEY REFERENCES km_astro_rule_master(id),
  total_occurrences   integer DEFAULT 0,
  matched_count       integer DEFAULT 0,
  confidence_score    numeric,
  last_computed_at    timestamptz
);

-- ── VERIFY ────────────────────────────────────────────────────
-- Run these after executing the migration and paste results back:

-- V1: km_astro_rule_master columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'km_astro_rule_master'
ORDER BY ordinal_position;

-- V2: km_rule_signals columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'km_rule_signals'
ORDER BY ordinal_position;

-- V3: km_rule_confidence columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'km_rule_confidence'
ORDER BY ordinal_position;
