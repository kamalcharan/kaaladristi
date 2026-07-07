-- Migration 139: per-benchmark rule confidence (inference POA item 4 part 1)
--
-- km_rule_confidence validates every rule against NIFTY 50 only
-- (km_rule_transits.nifty_return_pct). The inference layer captures
-- Applies To (sectors / indexes), but nothing validated against them —
-- "affects auto and metals" was being tested on NIFTY 50.
--
-- This table fans the SCORING out per benchmark. Discovery windows stay
-- universal (astronomy is the same for every instrument); only the
-- return measurement + matched verdict is computed per index, from
-- km_index_eod closes, against the rule's ACTIVE inference (base_bias
-- fallback) — same hypothesis rules as km_rule_confidence.
--
-- Written by confidence_scoring.score_benchmark_confidence():
--   * nightly 19:00 transit-scoring job (all rules x all benchmarks)
--   * manual Compute Confidence
--   * per-rule synchronous pass on inference save/delete
--
-- Read by PostgREST:
--   * chart tooltip RULE OVERALL — row matching the viewed index
--   * /rules/:id "confidence by benchmark" strip (Applies To driven)

BEGIN;

CREATE TABLE IF NOT EXISTS km_rule_confidence_bench (
    rule_id              INTEGER NOT NULL REFERENCES km_astro_rule_master(id) ON DELETE CASCADE,
    benchmark_index_id   INTEGER NOT NULL REFERENCES km_index_symbols(id)     ON DELETE CASCADE,
    total_occurrences    INTEGER,
    matched_count        INTEGER,
    confidence_score     NUMERIC(6,2),
    avg_return_all       NUMERIC(12,4),
    avg_return_matched   NUMERIC(12,4),
    avg_return_unmatched NUMERIC(12,4),
    best_return          NUMERIC(12,4),
    worst_return         NUMERIC(12,4),
    historical_transits  INTEGER,
    hypothesis_source    TEXT CHECK (hypothesis_source IN ('inference', 'base_bias')),
    hypothesis_impact    TEXT,
    last_computed_at     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (rule_id, benchmark_index_id)
);

CREATE INDEX IF NOT EXISTS idx_krcb_benchmark ON km_rule_confidence_bench (benchmark_index_id);

COMMENT ON TABLE km_rule_confidence_bench IS
  'Per-benchmark rule validation: km_rule_transits windows scored against each index''s closes (active inference hypothesis, base_bias fallback). NIFTY 50-only aggregate remains in km_rule_confidence.';

-- Lesson from migration 137: PostgREST runs logged-in browser queries as the
-- PROFILE role (admin/user), not 'authenticated' — grant to all of them.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'user', 'authenticated', 'anon', 'kd_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON km_rule_confidence_bench TO %I', r);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
