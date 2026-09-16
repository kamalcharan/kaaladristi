-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 215 — returns_since_result, DERIVED
-- Target DB: kaala_dristi_db
-- Plan: docs/claude/filing-intelligence-poa.md  (Sprint 2, "derived, not stored")
--
-- The PEAD primitive: how far has a stock moved since it announced results.
-- Migration 214 identified WHICH announcements are results; this measures from
-- them. No table, no nightly job, no column on km_equity_eod — the inputs
-- (result events, daily closes) are already stored and a third copy of a
-- derivable number is how two readings of one rule start to disagree.
--
-- ⚠ CORRECTION TO THE POA. It lists returns_since_result as a
-- DIMENSION_DEPENDENTS entry in the daily run one paragraph before saying
-- "derived, not stored". Those cannot both hold: a dependent exists to be
-- RECOMPUTED, which presupposes storage. Derived wins, and there is therefore
-- deliberately NO dimension and no cascade edge for it. If a measured read cost
-- later forces materialisation, that is a new decision with a number behind it.
--
-- ── REACTION AND DRIFT ARE DIFFERENT NUMBERS AND ARE NEVER MERGED ──────────
--   reaction_pct  Day -1 close -> Day 0 close.  How the market REPRICED on the
--                 news. The jump.
--   drift_pct     Day 0 close  -> the end bar.  What happened AFTER it. The
--                 drift, which is the entire phenomenon PEAD is about.
-- Measuring drift from Day -1 folds the announcement jump into it and is the
-- classic way a PEAD study reports an effect it never measured. Both are
-- returned; neither is summed into the other.
--
-- ── DAY 0 IS NEVER RE-DERIVED HERE ─────────────────────────────────────────
-- day_0_trade_date is taken from km_corporate_events, where migration 212's
-- kd_day_zero_trade_date put it from the exchange DISSEMINATION timestamp. One
-- implementation of the after-the-close rule; a second one in this file would
-- be the lookahead bias arriving by a different door.
--
-- ── ⚠ CLOSES ARE UNADJUSTED, AND THAT IS A REAL DEFECT THIS EXPOSES ────────
-- km_corporate_actions has ZERO rows (CLAUDE.md, D44), so a split or bonus
-- between Day 0 and the end bar shows up as a genuine-looking -50% drift. On a
-- metric whose whole job is to measure post-event moves, that is not a rounding
-- error — it is a fabricated signal, and results season is exactly when boards
-- declare bonuses.
--
-- So every row carries `suspect_corporate_action`: TRUE when any single session
-- inside the measured span moved <0.55x or >1.80x, which is impossible as a
-- genuine move under NSE's +/-20% price bands. Same test and the same constants
-- as adjust_close_cliffs() in lib/breadth_common.py, where it was calibrated.
--
-- It FLAGS rather than adjusts, on purpose. Back-adjusting here would put a
-- third implementation of corporate-action handling in the codebase and would
-- silently change numbers a researcher is reading. The structural fix is still
-- populating km_corporate_actions. Until then: FILTER ON THIS COLUMN in any
-- study, and never report a drift figure without it.
--
-- Owner runs in pgAdmin. Creates nothing that holds data — no REFRESH, no
-- backfill, instant on any size of table.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ONE implementation, two shapes of caller ───────────────────────────────
-- The live view below is this function with its arguments filled in. A second
-- query "just for the page" is how a scanner ends up disagreeing with the
-- research it is supposed to surface.
--
--   p_from / p_to          bound day_0_trade_date. NULL = unbounded.
--   p_horizon_sessions     NULL  -> measure to the stock's latest bar
--                          N     -> measure to the close N sessions after Day 0,
--                                   the fixed-horizon shape cross-sectional
--                                   PEAD work needs. A stock without N sessions
--                                   yet returns NULL ends rather than a shorter
--                                   window silently labelled N.
CREATE OR REPLACE FUNCTION public.kd_result_returns(
        p_from              DATE DEFAULT NULL,
        p_to                DATE DEFAULT NULL,
        p_horizon_sessions  INTEGER DEFAULT NULL)
RETURNS TABLE (
        event_id                 BIGINT,
        isin                     TEXT,
        equity_id                INTEGER,
        symbol                   TEXT,
        company_name             TEXT,
        day_0_trade_date         DATE,
        base_trade_date          DATE,
        base_close               NUMERIC,
        day_0_close              NUMERIC,
        end_trade_date           DATE,
        end_close                NUMERIC,
        sessions_elapsed         INTEGER,
        reaction_pct             NUMERIC,
        drift_pct                NUMERIC,
        suspect_corporate_action BOOLEAN)
LANGUAGE sql STABLE AS $$
WITH ev AS (
    SELECT e.id                              AS event_id,
           e.isin,
           COALESCE(e.equity_id, s.id)       AS equity_id,
           s.symbol,
           e.company_name,
           e.day_0_trade_date
      FROM public.km_corporate_events e
      LEFT JOIN LATERAL (
            SELECT k.id, k.symbol
              FROM public.km_equity_symbols k
             WHERE k.isin = e.isin AND k.exchange = 'NSE' AND k.is_active
             ORDER BY k.id LIMIT 1
      ) s ON TRUE
     -- NULL is excluded by this test, and correctly: an event the board-meeting
     -- join has not judged yet is not a non-result, it is unknown.
     WHERE e.is_result_announcement
       AND (p_from IS NULL OR e.day_0_trade_date >= p_from)
       AND (p_to   IS NULL OR e.day_0_trade_date <= p_to)
)
SELECT ev.event_id, ev.isin, ev.equity_id, ev.symbol, ev.company_name,
       ev.day_0_trade_date,
       base.trade_date, base.close,
       fwd.d0_close, fwd.end_date, fwd.end_close, fwd.sessions_elapsed,
       CASE WHEN base.close > 0 AND fwd.d0_close IS NOT NULL
            THEN round((fwd.d0_close / base.close - 1) * 100, 2) END,
       CASE WHEN fwd.d0_close > 0 AND fwd.end_close IS NOT NULL
            THEN round((fwd.end_close / fwd.d0_close - 1) * 100, 2) END,
       COALESCE(fwd.suspect, FALSE)
  FROM ev
  -- Day -1: the last session the stock traded BEFORE Day 0. Taken from the
  -- stock's own bars, not the market calendar — a stock suspended into its
  -- result must compare against the last price that actually existed.
  LEFT JOIN LATERAL (
        SELECT b.trade_date, b.close
          FROM public.km_equity_eod b
         WHERE b.equity_id = ev.equity_id
           AND b.trade_date < ev.day_0_trade_date
           AND b.close IS NOT NULL
         ORDER BY b.trade_date DESC
         LIMIT 1
  ) base ON TRUE
  LEFT JOIN LATERAL (
        WITH w AS (
            SELECT b.trade_date, b.close,
                   row_number() OVER (ORDER BY b.trade_date) - 1 AS n,
                   -- lag(close) over the stock's OWN bars, never prev_close:
                   -- the bhavcopy's prev_close is not reliably the unadjusted
                   -- previous trade, and the cliff test depends on it being
                   -- exactly that.
                   b.close / NULLIF(lag(b.close)
                        OVER (ORDER BY b.trade_date), 0) AS ratio
              FROM public.km_equity_eod b
             WHERE b.equity_id = ev.equity_id
               AND b.trade_date >= ev.day_0_trade_date
               AND b.close IS NOT NULL
               -- Bounds the scan when a horizon is asked for. Generous on
               -- purpose: sessions -> calendar days must never come up SHORT,
               -- or the horizon bar falls outside the window and the row
               -- reports no end at all.
               AND (p_horizon_sessions IS NULL
                    OR b.trade_date <= ev.day_0_trade_date
                       + (((p_horizon_sessions + 1) * 7) / 5 + 21))
        ), t AS (
            SELECT COALESCE(p_horizon_sessions, (SELECT max(n) FROM w)) AS tgt
        )
        SELECT max(w.close)      FILTER (WHERE w.n = 0)     AS d0_close,
               min(w.trade_date) FILTER (WHERE w.n = t.tgt) AS end_date,
               max(w.close)      FILTER (WHERE w.n = t.tgt) AS end_close,
               -- NULL when the stock has not lived N sessions yet, so a short
               -- window is never mislabelled as a full one.
               (CASE WHEN bool_or(w.n = t.tgt) THEN t.tgt END)::INTEGER
                                                            AS sessions_elapsed,
               bool_or(w.n > 0 AND w.n <= t.tgt
                       AND (w.ratio < 0.55 OR w.ratio > 1.80)) AS suspect
          FROM w CROSS JOIN t
         GROUP BY t.tgt
  ) fwd ON TRUE
$$;

COMMENT ON FUNCTION public.kd_result_returns IS
  'Post-result reaction and drift, derived from km_corporate_events + '
  'km_equity_eod. reaction_pct is the Day -1 -> Day 0 repricing; drift_pct is '
  'Day 0 -> the end bar. They are never summed. Closes are UNADJUSTED '
  '(km_corporate_actions is empty), so suspect_corporate_action must be '
  'filtered on in any study.';

-- ── The live read ──────────────────────────────────────────────────────────
-- Capped to recent events for one reason: a read path must not be able to
-- trigger heavy work (CLAUDE.md). Unbounded, this would walk every bar since
-- each event for every result ever recorded, on a page load. 120 calendar days
-- is ~82 sessions — past any PEAD window — and history stays fully reachable
-- through the function, which is a research call, not a render.
CREATE OR REPLACE VIEW public.v_result_drift AS
SELECT * FROM public.kd_result_returns(
        (SELECT max(trade_date) - 120 FROM public.km_equity_eod),
        NULL, NULL);

COMMENT ON VIEW public.v_result_drift IS
  'kd_result_returns over the last ~120 calendar days of result events, '
  'measured to each stock''s latest bar. Deliberately capped: the full history '
  'is a function call, not a page load.';

-- Every new PostgREST-read object grants to `authenticated` — the live
-- kd_auth_login issues that role for everyone (CLAUDE.md), and the one table
-- that missed this grant took four diagnostic rounds to find (migration 142).
GRANT SELECT ON public.v_result_drift
   TO authenticated, anon, kd_app, kd_readonly;
GRANT EXECUTE ON FUNCTION public.kd_result_returns(DATE, DATE, INTEGER)
   TO authenticated, anon, kd_app, kd_readonly;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
--   SELECT relname, relacl FROM pg_class WHERE relname = 'v_result_drift';
--   -- expect authenticated=r  (information_schema is BLIND here — CLAUDE.md)
--
-- Nothing to see until migration 214's ingest has run and marked some events:
--   SELECT count(*) FROM km_corporate_events WHERE is_result_announcement;
--
-- How much of the drift population is unusable until km_corporate_actions is
-- populated — the number that decides whether that backfill is urgent:
--   SELECT suspect_corporate_action, count(*) FROM v_result_drift GROUP BY 1;
--
-- The fixed-horizon shape a PEAD study actually consumes:
--   SELECT symbol, day_0_trade_date, reaction_pct, drift_pct
--     FROM kd_result_returns('2026-07-01', '2026-08-31', 22)
--    WHERE NOT suspect_corporate_action AND drift_pct IS NOT NULL
--    ORDER BY drift_pct DESC LIMIT 20;
