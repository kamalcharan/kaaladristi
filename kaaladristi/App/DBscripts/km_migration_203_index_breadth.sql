-- ============================================================================
-- km_migration_203_index_breadth.sql
-- Target DB: kaala_dristi_db
--
-- PER-INDEX BREADTH, PIPELINE-COMPUTED.
--
-- Until now the only precomputed breadth was market-wide (km_market_breadth,
-- km_breadth_roc — all NSE, one row per day). Every per-INDEX breadth read —
-- the Workspace "breadth & momentum" panel, Sector Rotation's index detail,
-- BreadthRotation — recomputed the series in the BROWSER from the index's
-- constituents (services/sectorRotation.ts fetchIndexBreadth): 50–500
-- stocks × 404 calendar days of bars pulled through PostgREST on every page
-- load, then percentages, thrust counts and ROC computed client-side. The
-- 252-session lookback (2026-08-28) made that a 3.9 s DISTINCT ON sort per
-- load and the Workspace panel stopped loading (2026-09-07). Owner decision
-- the same day: "it should be pipeline enabled and should be consistent".
--
-- WHAT THIS ADDS
--
--   km_index_breadth (index_id, trade_date) — one row per index per session,
--   the SAME numbers fetchIndexBreadth computed, so both pages read one table:
--
--     pct_above_20/50/150, breadth_score, stock_count            (§2 of the
--       Breadth_ROC_Spec: p20 on ema_20, p50 on sma_50, p150 on sma_150;
--       score = 100 × (0.50·p20 + 0.30·p50 + 0.20·p150); a constituent with a
--       NULL/0 indicator leaves THAT ratio's denominator — D40, and the
--       "no-fallback note" in CLAUDE.md)
--     universe_count, above_20/50/150, up_5pct, down_5pct,
--       up_20pct_5d, down_20pct_5d                                 (movers /
--       thrust over ONE universe = constituents with a valid 150-MA, mirroring
--       the market-wide compute so above + below = universe; migration 145)
--     roc_13, roc_55, sma_breadth                                  (index-level
--       average of per-constituent 13- and 55-session ROC; 5-session SMA of
--       roc_13 — the ROC badge's inputs)
--
--   compute_index_breadth(p_from_date, p_to_date, p_index_id) — set-based
--   upsert for every index that has km_index_constituents rows (standard AND
--   custom), or one index. Trailing returns (5/13/55 sessions) are LAGs over
--   each equity's OWN bars, so a stock that did not trade a day is compared
--   with its previous traded bar — the same thing the client's per-equity
--   series did, with one improvement: the client's lags started at the fetch
--   window's edge (the first 5/13/55 sessions of every load had no value);
--   here the lag reaches back before p_from_date, so the earliest rows of a
--   window carry values too.
--
-- WHAT STAYS CLIENT-SIDE (cheap, on ≤ 404 rows): zoneMode / percentileRank
-- (rank of the latest score within the index's own 252-session history) and
-- the ROC badge — presentation, not data. fetchIndexBreadth now reads this
-- table first and falls back to the constituent computation only when the
-- table has no rows for the index (a custom index created since the last
-- nightly run, or this migration not yet applied).
--
-- Pipeline: dimension `index_breadth` (pipeline2), after `breadth_roc`, before
-- `dots` — reads km_index_constituents + km_equity_eod indicators, which
-- are final by then. The custom-index Calculate endpoint also calls the
-- function for that one index so a fresh index shows breadth immediately.
--
-- After COMMIT, backfill (see the tail of this file).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS km_index_breadth (
    index_id        INTEGER      NOT NULL REFERENCES km_index_symbols(id) ON DELETE CASCADE,
    trade_date      DATE         NOT NULL,
    -- § breadth (percent of constituents above each MA; NULL when no
    --   constituent had a valid indicator that day)
    pct_above_20    NUMERIC(5,2),
    pct_above_50    NUMERIC(5,2),
    pct_above_150   NUMERIC(5,2),
    breadth_score   NUMERIC(5,2),
    stock_count     INTEGER      NOT NULL,   -- constituents with a bar that day
    -- § movers / thrust over the 150-MA universe (NULL when that universe is empty)
    universe_count  INTEGER,
    above_20        INTEGER,
    above_50        INTEGER,
    above_150       INTEGER,
    up_5pct         INTEGER,
    down_5pct       INTEGER,
    up_20pct_5d     INTEGER,                 -- NULL until any constituent has a 5-session return
    down_20pct_5d   INTEGER,
    -- § ROC (index-level average of constituent ROC; NULL during warm-up)
    roc_13          NUMERIC(9,4),
    roc_55          NUMERIC(9,4),
    sma_breadth     NUMERIC(9,4),            -- 5-session SMA of roc_13 (needs 5 consecutive values)
    computed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (index_id, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_index_breadth_date ON km_index_breadth (trade_date);

COMMENT ON TABLE km_index_breadth IS
    'Per-index constituent breadth, one row per index per session, computed nightly by pipeline2 dimension index_breadth via compute_index_breadth(). Same formulas as the former client-side fetchIndexBreadth (migration 203).';

-- ---------------------------------------------------------------------------
-- compute_index_breadth(p_from_date, p_to_date, p_index_id)
--
-- Upserts [p_from_date, p_to_date] for every index with constituents (or the
-- one index). Returns the number of (index, date) rows written.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_index_breadth(
    p_from_date DATE,
    p_to_date   DATE DEFAULT NULL,
    p_index_id  INTEGER DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_to   DATE := COALESCE(p_to_date, p_from_date);
    v_rows INTEGER := 0;
BEGIN
    WITH members AS (
        SELECT DISTINCT c.index_id, c.equity_id
        FROM km_index_constituents c
        WHERE p_index_id IS NULL OR c.index_id = p_index_id
    ),
    -- Every bar of every member from ~120 calendar days before the window:
    -- enough for LAG 55 sessions (~80 calendar days) plus holidays.
    bars AS (
        SELECT e.equity_id, e.trade_date, e.close, e.pct_chng,
               e.ema_20, e.sma_50, e.sma_150,
               lag(e.close, 5)  OVER w AS c5,
               lag(e.close, 13) OVER w AS c13,
               lag(e.close, 55) OVER w AS c55
        FROM km_equity_eod e
        WHERE e.equity_id IN (SELECT equity_id FROM members)
          AND e.trade_date >= p_from_date - INTERVAL '120 days'
          AND e.trade_date <= v_to
        WINDOW w AS (PARTITION BY e.equity_id ORDER BY e.trade_date)
    ),
    -- Per (index, session) aggregates. Computed from 14 days before the
    -- window so sma_breadth's 4 preceding sessions exist; trimmed below.
    agg AS (
        SELECT m.index_id, b.trade_date,
               count(*)                                                                    AS stock_count,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.ema_20  > 0)                AS n20,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.ema_20  > 0 AND b.close > b.ema_20)  AS a20,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_50  > 0)                AS n50,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_50  > 0 AND b.close > b.sma_50)  AS a50,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0)                AS n150,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.close > b.sma_150) AS a150,
               -- one universe for movers / thrust: valid 150-MA
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0)                AS universe,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.ema_20 > 0 AND b.close > b.ema_20) AS au20,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.sma_50 > 0 AND b.close > b.sma_50) AS au50,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.close > b.sma_150) AS au150,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.pct_chng >  5)   AS up5,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.pct_chng < -5)   AS dn5,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.c5 > 0)          AS any5d,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.c5 > 0 AND (b.close / b.c5 - 1) * 100 >  20) AS up20,
               count(*) FILTER (WHERE b.close IS NOT NULL AND b.sma_150 > 0 AND b.c5 > 0 AND (b.close / b.c5 - 1) * 100 < -20) AS dn20,
               avg((b.close / b.c13 - 1) * 100) FILTER (WHERE b.close > 0 AND b.c13 > 0)   AS roc_13,
               avg((b.close / b.c55 - 1) * 100) FILTER (WHERE b.close > 0 AND b.c55 > 0)   AS roc_55
        FROM bars b
        JOIN members m USING (equity_id)
        WHERE b.trade_date >= p_from_date - INTERVAL '14 days'
        GROUP BY m.index_id, b.trade_date
    ),
    sma AS (
        SELECT a.*,
               CASE WHEN count(a.roc_13) OVER w5 = 5
                    THEN avg(a.roc_13) OVER w5 END AS sma_breadth
        FROM agg a
        WINDOW w5 AS (PARTITION BY a.index_id ORDER BY a.trade_date
                      ROWS BETWEEN 4 PRECEDING AND CURRENT ROW)
    ),
    up AS (
        INSERT INTO km_index_breadth (
            index_id, trade_date,
            pct_above_20, pct_above_50, pct_above_150, breadth_score, stock_count,
            universe_count, above_20, above_50, above_150,
            up_5pct, down_5pct, up_20pct_5d, down_20pct_5d,
            roc_13, roc_55, sma_breadth, computed_at)
        SELECT s.index_id, s.trade_date,
               CASE WHEN s.n20  > 0 THEN round(s.a20  * 100.0 / s.n20,  1) END,
               CASE WHEN s.n50  > 0 THEN round(s.a50  * 100.0 / s.n50,  1) END,
               CASE WHEN s.n150 > 0 THEN round(s.a150 * 100.0 / s.n150, 1) END,
               CASE WHEN s.n20 > 0 OR s.n50 > 0 OR s.n150 > 0 THEN
                    round(100.0 * (0.50 * CASE WHEN s.n20  > 0 THEN s.a20  / s.n20::numeric  ELSE 0 END
                                 + 0.30 * CASE WHEN s.n50  > 0 THEN s.a50  / s.n50::numeric  ELSE 0 END
                                 + 0.20 * CASE WHEN s.n150 > 0 THEN s.a150 / s.n150::numeric ELSE 0 END), 1)
               END,
               s.stock_count,
               CASE WHEN s.universe > 0 THEN s.universe END,
               CASE WHEN s.universe > 0 THEN s.au20  END,
               CASE WHEN s.universe > 0 THEN s.au50  END,
               CASE WHEN s.universe > 0 THEN s.au150 END,
               CASE WHEN s.universe > 0 THEN s.up5 END,
               CASE WHEN s.universe > 0 THEN s.dn5 END,
               CASE WHEN s.any5d > 0 THEN s.up20 END,
               CASE WHEN s.any5d > 0 THEN s.dn20 END,
               round(s.roc_13::numeric, 4), round(s.roc_55::numeric, 4), round(s.sma_breadth::numeric, 4),
               now()
        FROM sma s
        WHERE s.trade_date BETWEEN p_from_date AND v_to
        ON CONFLICT (index_id, trade_date) DO UPDATE SET
            pct_above_20 = EXCLUDED.pct_above_20, pct_above_50 = EXCLUDED.pct_above_50,
            pct_above_150 = EXCLUDED.pct_above_150, breadth_score = EXCLUDED.breadth_score,
            stock_count = EXCLUDED.stock_count, universe_count = EXCLUDED.universe_count,
            above_20 = EXCLUDED.above_20, above_50 = EXCLUDED.above_50, above_150 = EXCLUDED.above_150,
            up_5pct = EXCLUDED.up_5pct, down_5pct = EXCLUDED.down_5pct,
            up_20pct_5d = EXCLUDED.up_20pct_5d, down_20pct_5d = EXCLUDED.down_20pct_5d,
            roc_13 = EXCLUDED.roc_13, roc_55 = EXCLUDED.roc_55, sma_breadth = EXCLUDED.sma_breadth,
            computed_at = EXCLUDED.computed_at
        RETURNING 1
    )
    SELECT count(*) INTO v_rows FROM up;
    RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION compute_index_breadth(DATE, DATE, INTEGER) IS
    'Upsert km_index_breadth for [p_from_date, p_to_date] (default: one day), all indices with constituents or one p_index_id. Nightly: pipeline2 dimension index_breadth. Backfill: scripts/backfill_index_breadth.py.';

-- ---------------------------------------------------------------------------
-- Grants. `authenticated` is the role every logged-in browser reads as
-- (migrations 142/144); kd_app writes from the pipeline and the API.
-- ---------------------------------------------------------------------------
GRANT SELECT ON km_index_breadth TO authenticated, anon, kd_app, admin, "user", kd_readonly;
GRANT INSERT, UPDATE, DELETE ON km_index_breadth TO kd_app;
GRANT EXECUTE ON FUNCTION compute_index_breadth(DATE, DATE, INTEGER) TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Backfill (run AFTER commit). The nightly step only computes its own
-- trade_date; history must be filled once so the 252-session percentile mode
-- ('percentile' zones) is available from day one:
--
--   cd App/backend && python scripts/backfill_index_breadth.py            # 2 years, all indices
--   python scripts/backfill_index_breadth.py --from 2025-09-01 --index 1  # a range / one index
--
-- or directly, in monthly chunks (one call = one statement; ~131 indices ×
-- ~22 sessions per chunk):
--   SELECT compute_index_breadth('2026-08-01', '2026-08-31');
--
-- Verify against the client formula on one index and date — run the
-- constituent count and the pct_above_150 by hand and compare:
--   SELECT * FROM km_index_breadth WHERE index_id = 1 ORDER BY trade_date DESC LIMIT 5;
-- ============================================================================
