-- Migration 134: km_rule_inference — the theory-vs-evidence layer
--
-- Context: docs/POA/POA-astro-pattern-engine.md gave us the *evidence*
-- (level-break / reaction-profile / sequence stats via km_rule_patterns +
-- the correlation engine). This table adds the *theory* — what a domain
-- expert (or VaNi, drafting from the same domain knowledge) expects a
-- rule, or a specific pair of rules, to mean for the market — so the
-- Patterns tab can show "Expected" next to "Evidence" instead of only
-- ever showing a statistic with no context for WHY it should exist.
--
-- Deliberately shaped close to the parked PlanetPulse spec's confidence
-- framework (docs/scanners/PLANETPULSE_RULE.md — VALIDATED / INDICATIVE /
-- UNVALIDATED, driven by occurrence count) so this slots into PlanetPulse
-- later instead of being replaced by it. confidence_tier is NOT authored —
-- it is computed from km_rule_confidence.total_occurrences (single-rule
-- rows) or from the correlation engine's n_instances (pair rows), same
-- n-gate already governing the Patterns tab (>=20 VALIDATED, 10-19
-- INDICATIVE, <10 UNVALIDATED).
--
-- rule_b_id is nullable: NULL = single-rule inference (item 1's original
-- ask), set = pair/combination inference (owner decision 2026-07-07,
-- "pair up" — e.g. Saturn x Mercury). Pair evidence is fetched via the
-- existing /api/correlation/compute engine (already handles astro_rule:
-- and astro_group: items), not a new stats pipeline.
--
-- Safe against the table already existing from an earlier ad-hoc single-
-- rule-id CREATE TABLE run directly on the VPS on 2026-07-07 — the ALTER
-- block below upgrades that shape to this one without data loss.

BEGIN;

CREATE TABLE IF NOT EXISTS km_rule_inference (
  id              SERIAL PRIMARY KEY,
  rule_a_id       INT NOT NULL REFERENCES km_astro_rule_master(id),
  rule_b_id       INT REFERENCES km_astro_rule_master(id),
  inference_text  TEXT NOT NULL,
  market_impact   TEXT CHECK (market_impact IN
                    ('bullish','bearish','volatile','neutral','mixed')),
  source          TEXT NOT NULL CHECK (source IN ('manual','ai_generated')),
  confidence_tier TEXT NOT NULL DEFAULT 'UNVALIDATED' CHECK (confidence_tier IN
                    ('VALIDATED','INDICATIVE','UNVALIDATED')),
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT km_rule_inference_pair_order
    CHECK (rule_b_id IS NULL OR rule_b_id <> rule_a_id)
);

-- ── Upgrade an already-existing single-rule-id table (ad-hoc VPS run) ──────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'km_rule_inference' AND column_name = 'rule_id'
  ) THEN
    ALTER TABLE km_rule_inference RENAME COLUMN rule_id TO rule_a_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'km_rule_inference' AND column_name = 'rule_b_id'
  ) THEN
    ALTER TABLE km_rule_inference ADD COLUMN rule_b_id INT REFERENCES km_astro_rule_master(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_km_rule_inference_rule_a ON km_rule_inference(rule_a_id);
CREATE INDEX IF NOT EXISTS idx_km_rule_inference_rule_b ON km_rule_inference(rule_b_id) WHERE rule_b_id IS NOT NULL;

DO $$ BEGIN
  CREATE TRIGGER trg_km_rule_inference_updated_at
    BEFORE UPDATE ON km_rule_inference
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON km_rule_inference TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_rule_inference_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
