-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 216 — one drift row per RESULT, not per announcement
-- Target DB: kaala_dristi_db
-- Plan: docs/claude/filing-intelligence-poa.md  (Sprint 2)
--
-- Measured on the first live board-meeting backfill (2026-06-01..09-16), which
-- judged 2,829 'Outcome of Board Meeting' announcements:
--
--     2,733 result events  ->  2,306 distinct meetings  =  1.19 per meeting
--
--     announcements per meeting:  1 -> 1,953   2 -> 298   3 -> 41
--                                 4 ->     9   5 ->   5
--
-- One board meeting approves the results AND declares a dividend AND appoints
-- an auditor, and the company files each outcome separately. All of them match
-- that one results meeting, so migration 215 returned a drift row for each:
-- **427 of 2,733 rows were a second Day 0 for a result already counted**, and
-- a cross-sectional PEAD study would over-weight those 353 companies by 15.6%.
--
-- ⚠ THE FLAG IS NOT WRONG AND IS NOT CHANGED. Each of those announcements DID
-- come out of a results meeting, so km_corporate_events.is_result_announcement
-- stays TRUE on all of them — demoting the extras to FALSE would assert
-- something untrue about the announcement in order to fix a counting problem
-- somewhere else. The double-counting harm is specific to the drift
-- population, so the de-duplication lives here, where the harm is.
--
-- WHICH ONE SURVIVES: the EARLIEST dissemination. It can never be later than
-- the moment the market could first act on the meeting's outcome, which is the
-- only thing Day 0 is allowed to mean. (Measured: 98.7% of outcomes are filed
-- on the meeting date itself, so siblings almost always share a Day 0 and this
-- is a row-count fix rather than a change of base — but "almost always" is not
-- a rule, and the earliest is the safe side of the one that matters.)
--
-- AND IT IS COUNTED, NOT SILENTLY DROPPED. `sibling_announcements` reports how
-- many outcome filings that meeting produced. A 15.6% phenomenon that vanishes
-- without a number is one nobody can audit; with the number, a researcher can
-- see which results were filed piecemeal and ask why.
--
-- Two different quarters close together stay TWO rows: they are two board
-- meetings, so they carry two board_meeting_ids and never merge.
--
-- Owner runs in pgAdmin. Holds no data — DROP/CREATE of a view and a function
-- is instant and loses nothing.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- The return type gains a column, so CREATE OR REPLACE cannot do it. The view
-- depends on the function and must go first. Neither stores anything.
DROP VIEW IF EXISTS public.v_result_drift;
DROP FUNCTION IF EXISTS public.kd_result_returns(DATE, DATE, INTEGER);

CREATE FUNCTION public.kd_result_returns(
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
        suspect_corporate_action BOOLEAN,
        board_meeting_id         BIGINT,
        sibling_announcements    INTEGER)
LANGUAGE sql STABLE AS $$
WITH ev_all AS (
    SELECT e.id                              AS event_id,
           e.isin,
           COALESCE(e.equity_id, s.id)       AS equity_id,
           s.symbol,
           e.company_name,
           e.day_0_trade_date,
           e.board_meeting_id,
           e.disseminated_at
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
), ev AS (
    -- COALESCE(board_meeting_id, -event_id): a NULL meeting id cannot occur
    -- here (the linker writes the flag and the id together) but DISTINCT ON
    -- treats all NULLs as one group, so a future path that ever produced one
    -- would collapse every such event into a single row. A negative key can
    -- never collide with a real meeting id.
    SELECT DISTINCT ON (COALESCE(board_meeting_id, -event_id))
           event_id, isin, equity_id, symbol, company_name, day_0_trade_date,
           board_meeting_id,
           -- Window functions run BEFORE DISTINCT ON, so this counts all the
           -- siblings and not the one that survives.
           (count(*) OVER (PARTITION BY
                COALESCE(board_meeting_id, -event_id)))::INTEGER AS siblings
      FROM ev_all
     -- Earliest dissemination wins; event_id only breaks an exact tie, so the
     -- choice is deterministic across runs.
     ORDER BY COALESCE(board_meeting_id, -event_id), disseminated_at, event_id
)
SELECT ev.event_id, ev.isin, ev.equity_id, ev.symbol, ev.company_name,
       ev.day_0_trade_date,
       base.trade_date, base.close,
       fwd.d0_close, fwd.end_date, fwd.end_close, fwd.sessions_elapsed,
       CASE WHEN base.close > 0 AND fwd.d0_close IS NOT NULL
            THEN round((fwd.d0_close / base.close - 1) * 100, 2) END,
       CASE WHEN fwd.d0_close > 0 AND fwd.end_close IS NOT NULL
            THEN round((fwd.end_close / fwd.d0_close - 1) * 100, 2) END,
       COALESCE(fwd.suspect, FALSE),
       ev.board_meeting_id, ev.siblings
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
  'Post-result reaction and drift, ONE ROW PER RESULTS MEETING (the earliest '
  'of its outcome announcements; sibling_announcements counts the rest). '
  'reaction_pct is the Day -1 -> Day 0 repricing; drift_pct is Day 0 -> the '
  'end bar. They are never summed. Closes are UNADJUSTED (km_corporate_actions '
  'is empty), so suspect_corporate_action must be filtered on in any study.';

-- ── The live read ──────────────────────────────────────────────────────────
-- Capped to recent events for one reason: a read path must not be able to
-- trigger heavy work (CLAUDE.md). Unbounded, this would walk every bar since
-- each event for every result ever recorded, on a page load. 120 calendar days
-- is ~82 sessions — past any PEAD window — and history stays fully reachable
-- through the function, which is a research call, not a render.
CREATE VIEW public.v_result_drift AS
SELECT * FROM public.kd_result_returns(
        (SELECT max(trade_date) - 120 FROM public.km_equity_eod),
        NULL, NULL);

COMMENT ON VIEW public.v_result_drift IS
  'kd_result_returns over the last ~120 calendar days of result events, '
  'measured to each stock''s latest bar. Deliberately capped: the full history '
  'is a function call, not a page load.';

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
-- The de-duplication, as a number. Expect drift_rows < result_events by the
-- 427 measured above, and drift_rows = distinct meetings:
--   SELECT (SELECT count(*) FROM km_corporate_events
--            WHERE is_result_announcement)              AS result_events,
--          (SELECT count(DISTINCT board_meeting_id) FROM km_corporate_events
--            WHERE is_result_announcement)              AS distinct_meetings,
--          (SELECT count(*) FROM kd_result_returns())   AS drift_rows;
--
-- Which results were filed piecemeal — now visible rather than merged away:
--   SELECT sibling_announcements, count(*) FROM kd_result_returns()
--    GROUP BY 1 ORDER BY 1;
