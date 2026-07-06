-- ============================================================================
-- Migration 132 — km_rule_patterns: Astro Pattern Engine storage (Phase 1)
-- Target database: kaala_dristi_db
--
-- POA: docs/POA/POA-astro-pattern-engine.md (approved 2026-07-06)
-- Prerequisites: migration 064 (km_rule_transits), migrations 127-131
-- (four-planet almanac windows + MajorTransit tags).
--
-- One row per rule x benchmark x pattern_type. Populated by
-- pattern_study.py (Phase 2 — one-shot script, rule_discovery.py family).
-- Read by the Patterns tab on /rules/:id (Phase 3).
--
-- Pattern types:
--   level_break      — window high/low break stats + forward returns
--   reaction_profile — indicator event-study curves D-10..D+15 around anchor
--   sequence         — who-moves-first ordering derived from the profiles
--
-- results JSONB shape (per POA — clean stats lead, nothing silently capped):
--   {
--     "overall":        { ...pattern-type-specific stats, "n": int },
--     "clean":          { ...same shape, no same-band peer overlap, "n": int },
--     "peers":          [ { "with": "RULE-CODE", "n": int, "stats": {...} } ],
--     "context_splits": { "jupiter_motion": { "direct": {...}, "retrograde": {...} },
--                         "saturn_motion":  { ... }, ... },
--     "tactical_density": { "avg_events_inside": num }   -- long-window rules only
--   }
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_rule_patterns (
    id                  BIGSERIAL PRIMARY KEY,
    rule_id             INTEGER NOT NULL
                            REFERENCES km_astro_rule_master(id) ON DELETE CASCADE,
    benchmark_index_id  INTEGER NOT NULL
                            REFERENCES km_index_symbols(id) ON DELETE CASCADE,
    pattern_type        TEXT    NOT NULL
                            CHECK (pattern_type IN ('level_break', 'reaction_profile', 'sequence')),

    -- Event anchor used for this computation (POA: window_end for combust/
    -- retrograde rules — the station/release moment; window_start for sign
    -- transits and other entry-anchored rules).
    anchor              TEXT    NOT NULL DEFAULT 'window_start'
                            CHECK (anchor IN ('window_start', 'window_end')),

    -- Frequency band of the rule, classified from its own median window
    -- duration at compute time (tactical <= 10d, trend 11-90d, structural > 90d).
    band                TEXT    NOT NULL
                            CHECK (band IN ('tactical', 'trend', 'structural')),

    -- Computation parameters (windows used, thresholds, indicator list,
    -- relative-axis span, z-threshold for sequence detection, ...) so every
    -- stored result is reproducible and auditable.
    params              JSONB   NOT NULL DEFAULT '{}'::jsonb,

    -- Full nested results — see header for shape.
    results             JSONB   NOT NULL,

    -- Occurrence counts drive the display gate (POA):
    --   n >= 20 publish · 10-19 greyed "insufficient occurrences" · < 10 hidden.
    -- The gate is applied at DISPLAY time — everything computed is stored.
    n_windows           INTEGER NOT NULL,
    n_clean             INTEGER NOT NULL DEFAULT 0,

    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_pattern_counts CHECK (n_clean <= n_windows)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_patterns_rule_bench_type
    ON km_rule_patterns (rule_id, benchmark_index_id, pattern_type);

CREATE INDEX IF NOT EXISTS idx_rule_patterns_rule_id
    ON km_rule_patterns (rule_id);

CREATE INDEX IF NOT EXISTS idx_rule_patterns_benchmark
    ON km_rule_patterns (benchmark_index_id);

-- Publishable rows per benchmark (the Patterns tab's benchmark selector
-- lists benchmarks having at least one n>=10 row for the rule).
CREATE INDEX IF NOT EXISTS idx_rule_patterns_publishable
    ON km_rule_patterns (rule_id, benchmark_index_id) WHERE n_windows >= 10;

COMMENT ON TABLE km_rule_patterns IS
    'Astro Pattern Engine results — one row per rule x benchmark x pattern type. '
    'Populated by pattern_study.py; read by the Patterns tab on /rules/:id. '
    'POA: docs/POA/POA-astro-pattern-engine.md. Display gates: n>=20 publish, '
    '10-19 greyed, <10 hidden — applied in UI, never by deleting rows.';

COMMENT ON COLUMN km_rule_patterns.band IS
    'Rule frequency band from median window duration: tactical <=10d, trend 11-90d, structural >90d. '
    'Same-band overlaps are peers (clean/overlap split); higher bands are context; lower bands are density metadata.';

COMMENT ON COLUMN km_rule_patterns.results IS
    'Nested stats: {overall, clean, peers[], context_splits{}, tactical_density?}. '
    'Clean-subset numbers lead in UI; overall shown secondary.';

-- ── PostgREST grants (same role set as migrations 117/120) ──────────────────
-- The Patterns tab reads via PostgREST; pattern_study.py writes via psycopg2
-- as the owner role. Read-only for API roles — no INSERT/UPDATE from the app.
GRANT SELECT ON km_rule_patterns TO authenticated, anon, kd_app;

-- ── Verification ─────────────────────────────────────────────────────────────
-- \d km_rule_patterns
-- SELECT COUNT(*) FROM km_rule_patterns;   -- 0 until pattern_study.py runs
