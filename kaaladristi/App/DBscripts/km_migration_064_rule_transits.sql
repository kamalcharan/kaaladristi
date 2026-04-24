-- M055_rule_transits.sql
-- Transit-based backtesting tables for the Rules Engine.
-- Replaces the day-level matched/unmatched approach with transit-period tracking.
--
-- Run in pgAdmin / DBeaver / psql.  No wrapper script needed.
-- Prerequisite: migration 062 (km_rule_signals, km_rule_confidence).

-- ── 1. km_rule_transits ────────────────────────────────────────────────────────
-- One row per contiguous rule-active window (transit period).
-- Grouping rule: consecutive signal dates with gap ≤ 4 calendar days are one transit
-- (covers Friday→Monday and single-day public holidays).

CREATE TABLE IF NOT EXISTS km_rule_transits (
    id                   BIGSERIAL PRIMARY KEY,
    rule_id              INTEGER NOT NULL
                             REFERENCES km_astro_rule_master(id) ON DELETE CASCADE,
    start_date           DATE    NOT NULL,
    end_date             DATE    NOT NULL,
    duration_days        INTEGER GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
    nifty_start_close    NUMERIC(12,4),
    nifty_end_close      NUMERIC(12,4),
    nifty_return_pct     NUMERIC(8,4),
    matched              BOOLEAN,
    conditions_snapshot  JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transit_dates CHECK (end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_transits_rule_start
    ON km_rule_transits (rule_id, start_date);

CREATE INDEX IF NOT EXISTS idx_rule_transits_rule_id
    ON km_rule_transits (rule_id);

CREATE INDEX IF NOT EXISTS idx_rule_transits_start_date
    ON km_rule_transits (start_date);

CREATE INDEX IF NOT EXISTS idx_rule_transits_matched
    ON km_rule_transits (matched) WHERE matched IS NOT NULL;

COMMENT ON TABLE km_rule_transits IS
    'Contiguous transit periods for each rule. '
    'Populated by rule_discovery.py; returns filled by confidence_scoring.py.';


-- ── 2. km_rule_confidence_yearly ──────────────────────────────────────────────
-- Year-by-year win-rate breakdown derived from km_rule_transits.

CREATE TABLE IF NOT EXISTS km_rule_confidence_yearly (
    rule_id      INTEGER  NOT NULL
                     REFERENCES km_astro_rule_master(id) ON DELETE CASCADE,
    year         SMALLINT NOT NULL,
    transits     INTEGER  NOT NULL DEFAULT 0,
    matched      INTEGER  NOT NULL DEFAULT 0,
    win_pct      NUMERIC(5,2),
    avg_return   NUMERIC(8,4),
    avg_duration NUMERIC(5,1),
    PRIMARY KEY (rule_id, year)
);

CREATE INDEX IF NOT EXISTS idx_rule_confidence_yearly_rule_id
    ON km_rule_confidence_yearly (rule_id);

COMMENT ON TABLE km_rule_confidence_yearly IS
    'Per-year win-rate for each rule, derived from km_rule_transits. '
    'Populated by confidence_scoring.py.';


-- ── 3. Extend km_rule_confidence ──────────────────────────────────────────────
-- Add return and duration statistics columns.  All nullable so old rows are valid
-- until confidence_scoring.py re-runs.

ALTER TABLE km_rule_confidence
    ADD COLUMN IF NOT EXISTS avg_return_all        NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS avg_return_matched    NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS avg_return_unmatched  NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS best_return           NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS worst_return          NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS avg_duration_days     NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS historical_transits   INTEGER;

COMMENT ON COLUMN km_rule_confidence.avg_return_all IS
    'Average Nifty return (%) across all historical transits for this rule.';
COMMENT ON COLUMN km_rule_confidence.avg_return_matched IS
    'Average Nifty return (%) when direction matched rule outcome.';
COMMENT ON COLUMN km_rule_confidence.avg_return_unmatched IS
    'Average Nifty return (%) when direction did NOT match rule outcome.';
COMMENT ON COLUMN km_rule_confidence.best_return IS
    'Best single-transit Nifty return (%) for this rule.';
COMMENT ON COLUMN km_rule_confidence.worst_return IS
    'Worst single-transit Nifty return (%) for this rule.';
COMMENT ON COLUMN km_rule_confidence.avg_duration_days IS
    'Average calendar length (days) of a transit for this rule.';
COMMENT ON COLUMN km_rule_confidence.historical_transits IS
    'Count of historical (end_date <= today) transits used for confidence scoring.';


-- ── 4. Reset signal / confidence data ─────────────────────────────────────────
-- Wipe existing day-level signals and old confidence rows so confidence_scoring.py
-- can populate everything fresh from the transit model.
-- km_rule_transits is new so nothing to truncate there.

TRUNCATE TABLE km_rule_signals;
TRUNCATE TABLE km_rule_confidence;


-- ── Verify ─────────────────────────────────────────────────────────────────────
SELECT
    'km_rule_transits'          AS tbl, COUNT(*) AS rows FROM km_rule_transits
UNION ALL
SELECT
    'km_rule_confidence_yearly', COUNT(*) FROM km_rule_confidence_yearly
UNION ALL
SELECT
    'km_rule_confidence cols',
    COUNT(*) FROM information_schema.columns
    WHERE table_name = 'km_rule_confidence'
      AND column_name IN (
          'avg_return_all','avg_return_matched','avg_return_unmatched',
          'best_return','worst_return','avg_duration_days','historical_transits'
      );
