-- Migration 145: Market Breadth movers/thrust columns
-- Run on kaala_dristi_db. Populated by compute_market_breadth.py.
--
-- Adds the "thrust / panic" dimensions on top of the existing MA-participation
-- breadth so the Market Breadth page can render a day-by-day heatmap + raw table
-- (matching the reference layout). All counts are over a SINGLE daily universe =
-- stocks with a valid 150-day MA (so above+below reconciles to universe, and
-- every dimension shares one denominator).
--
--   universe_count   : stocks with a valid 150-MA that day (the shared universe)
--   above_20/50/150  : # of those stocks trading above their 20-EMA / 50-SMA / 150-SMA
--   up_5pct/down_5pct        : # up / down > 5% on the day
--   up_20pct_5d/down_20pct_5d: # up / down > 20% over the trailing 5 sessions
--
-- Existing pct_above_* / breadth_score / stock_count are unchanged (the score
-- chart keeps rendering exactly as before). New columns are nullable so historic
-- rows read fine until the backfill (compute_market_breadth.py --all) runs.

BEGIN;

ALTER TABLE km_market_breadth
    ADD COLUMN IF NOT EXISTS universe_count    INTEGER,
    ADD COLUMN IF NOT EXISTS above_20          INTEGER,
    ADD COLUMN IF NOT EXISTS above_50          INTEGER,
    ADD COLUMN IF NOT EXISTS above_150         INTEGER,
    ADD COLUMN IF NOT EXISTS up_5pct           INTEGER,
    ADD COLUMN IF NOT EXISTS down_5pct         INTEGER,
    ADD COLUMN IF NOT EXISTS up_20pct_5d       INTEGER,
    ADD COLUMN IF NOT EXISTS down_20pct_5d     INTEGER;

GRANT SELECT ON km_market_breadth TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
