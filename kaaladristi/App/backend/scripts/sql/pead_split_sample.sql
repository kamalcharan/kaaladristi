-- ============================================================================
-- PEAD +5% gate — SPLIT-SAMPLE CHECK                          READ ONLY
-- ============================================================================
-- Run in pgAdmin / psql against kaala_dristi_db. Writes nothing.
--
-- WHY: the shipped Post-Result Drift gate (PEAD_MIN_REACTION_PCT = +5) was
-- calibrated on ONE sample covering ONE results season. `signal-research` says a
-- gate does not move, and should not be trusted, until the result holds in both
-- halves of its own sample. This is that check, and nothing else.
--
-- REFERENCE to beat (migration 221 header, whole sample):
--     >+5%      +0.95%  (+1.54 pts excess, n=278)
--     +2..+5%   +0.16%
--     -2..+2%   -1.61%
--     -5..-2%   -1.87%
--     <-5%      -1.52%          universe median -0.59%
-- The BOTH rows below should land near those. What actually decides anything is
-- whether H1 and H2 AGREE: two halves at +1.4 and +1.6 is a real gate; +3.0 and
-- -0.2 is one season with a good first half, and the gate is then unproven.
--
-- Properties, each one a trap already paid for elsewhere in this repo:
--   * ONE ROW PER RESULTS MEETING — via kd_result_returns (migration 216).
--     Counting announcements double-weights 353 companies by 15.6%.
--   * reaction (D-1 -> D0) and drift (D0 -> D+20) are NEVER merged.
--   * MEDIAN, not mean. Both are printed: a wide gap is itself the finding
--     (unfiled >=+15% reads mean +3.29 against median -0.69).
--   * EXCESS vs the SAME-DATE universe median, so market direction cancels.
--   * suspect_corporate_action dropped on the event side AND the 0.55x/1.80x
--     cliff window dropped on the universe side — km_corporate_actions is EMPTY
--     (D44), so a split inside the span reads as a real -50% drift.
--   * sessions_elapsed = 20 only. A partial horizon is not a 20-session drift.
--   * ETFs (isin LIKE 'INF%') and inactive symbols out of the baseline.
--
-- Validated on a throwaway PostgreSQL 16 cluster against a fixture with a known
-- answer: recovered the engineered H1 4.00 / H2 1.00 / BOTH 2.50, dropped all
-- three poison rows (short horizon, flagged split, NULL drift), kept the ETF and
-- the inactive symbol out of a baseline that stayed exactly 0.00, and proved the
-- cliff filter excludes the window CONTAINING a split without excluding the
-- stock afterwards.
-- ============================================================================

-- ── Query 1 · sanity header. Read this BEFORE trusting query 2. ─────────────
-- If `events` is far off ~278 in the >=+5% band, or `universe_per_date` is not
-- a few thousand, the population is wrong and query 2's medians are noise.
WITH ev AS (
    SELECT day_0_trade_date AS d0, reaction_pct, drift_pct
      FROM public.kd_result_returns('2026-01-01'::date, CURRENT_DATE, 20)
     WHERE drift_pct IS NOT NULL
       AND reaction_pct IS NOT NULL
       AND sessions_elapsed = 20
       AND NOT suspect_corporate_action
)
SELECT count(*)                                        AS events,
       count(DISTINCT d0)                              AS day_0_dates,
       min(d0)                                         AS first_day_0,
       max(d0)                                         AS last_day_0,
       (SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY d0) FROM ev) AS split_at,
       count(*) FILTER (WHERE reaction_pct >= 5)       AS band_ge_5pct
  FROM ev;

-- ── Query 2 · the split-sample table ───────────────────────────────────────
WITH ev AS (
    SELECT day_0_trade_date AS d0, reaction_pct, drift_pct
      FROM public.kd_result_returns('2026-01-01'::date, CURRENT_DATE, 20)
     WHERE drift_pct   IS NOT NULL
       AND reaction_pct IS NOT NULL
       AND sessions_elapsed = 20            -- a partial horizon is not a drift
       AND NOT suspect_corporate_action      -- km_corporate_actions is EMPTY
), dates AS (
    SELECT DISTINCT d0 AS d FROM ev
), span AS (
    SELECT min(d) AS lo, max(d) AS hi FROM dates
), univ_raw AS (
    -- The whole eligible universe over the window, with each stock's own
    -- 20-SESSION-forward close and its bar-to-bar ratio. lead/lag over the
    -- stock's OWN bars, matching kd_result_returns: a stock that did not trade
    -- must not silently borrow another stock's session.
    SELECT b.equity_id, b.trade_date, b.close,
           b.close / NULLIF(lag(b.close) OVER w, 0) AS ratio,
           lead(b.close, 20) OVER w                 AS close_fwd
      FROM public.km_equity_eod b
      JOIN public.km_equity_symbols s ON s.id = b.equity_id
     WHERE s.exchange = 'NSE'
       AND s.is_active
       AND s.isin NOT LIKE 'INF%'            -- mutual-fund units are not stocks
       AND b.close IS NOT NULL
       -- +90 days is deliberately generous: 20 sessions is ~28 calendar days,
       -- and a window that comes up SHORT silently drops the newest sample
       -- dates instead of erroring.
       AND b.trade_date BETWEEN (SELECT lo FROM span) - 30
                            AND (SELECT hi FROM span) + 90
    WINDOW w AS (PARTITION BY b.equity_id ORDER BY b.trade_date)
), univ AS (
    SELECT u.trade_date,
           (u.close_fwd / NULLIF(u.close, 0) - 1) * 100 AS fwd_pct,
           -- FORWARD-only frame. A split before this bar is already in the
           -- price and is not this window's problem; one inside the next 20
           -- sessions fabricates the whole return.
           max(CASE WHEN u.ratio < 0.55 OR u.ratio > 1.80 THEN 1 ELSE 0 END)
               OVER (PARTITION BY u.equity_id ORDER BY u.trade_date
                     ROWS BETWEEN 1 FOLLOWING AND 20 FOLLOWING) AS cliff
      FROM univ_raw u
), baseline AS (
    SELECT d.d,
           (percentile_cont(0.5) WITHIN GROUP (ORDER BY u.fwd_pct))::numeric AS univ_med,
           count(*) AS univ_n
      FROM dates d
      JOIN univ u ON u.trade_date = d.d
     WHERE u.fwd_pct IS NOT NULL
       AND u.cliff = 0
     GROUP BY d.d
), scored AS (
    SELECT e.d0, e.reaction_pct, e.drift_pct - b.univ_med AS excess, b.univ_n
      FROM ev e
      JOIN baseline b ON b.d = e.d0
), cut AS (
    -- percentile_disc, not a midpoint date: splits by EVENT COUNT so both
    -- halves carry comparable n, and keeps every event of one date together.
    SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY d0) AS mid FROM scored
), tagged AS (
    SELECT CASE WHEN reaction_pct >=  5 THEN '5  >= +5%'
                WHEN reaction_pct >=  2 THEN '4  +2..+5%'
                WHEN reaction_pct >= -2 THEN '3  -2..+2%'
                WHEN reaction_pct >= -5 THEN '2  -5..-2%'
                ELSE                         '1  < -5%'  END AS band,
           CASE WHEN d0 <= (SELECT mid FROM cut) THEN 'H1' ELSE 'H2' END AS half,
           excess, univ_n
      FROM scored
)
SELECT band,
       COALESCE(half, 'BOTH') AS half,
       count(*) AS n,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY excess))::numeric, 2)
                                                            AS median_excess,
       round(avg(excess), 2)                                AS mean_excess,
       round(100.0 * count(*) FILTER (WHERE excess > 0) / count(*), 1)
                                                            AS pct_positive,
       round(avg(univ_n))                                   AS universe_per_date
  FROM tagged
 GROUP BY GROUPING SETS ((band, half), (band))
 ORDER BY band, half NULLS LAST;
