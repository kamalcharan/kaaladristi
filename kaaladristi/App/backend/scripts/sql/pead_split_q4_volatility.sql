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
)

-- ── Query 4 · is it drift, or just volatile names? ────────────────────────
-- Buckets by the SIZE of the reaction ignoring its sign, then by sign within
-- the big bucket. If |reaction| >= 5 is positive-excess on BOTH sides in H2,
-- that half rewarded volatility rather than direction, and the top band
-- inherits it.
SELECT CASE WHEN abs(reaction_pct) >= 5 THEN 'big  |r|>=5' ELSE 'small |r|<5' END AS size,
       CASE WHEN reaction_pct >= 0 THEN 'up' ELSE 'down' END AS direction,
       CASE WHEN d0 <= '2026-08-10' THEN 'H1' ELSE 'H2' END AS half,
       count(*) AS n,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY excess))::numeric, 2) AS median_excess
  FROM scored
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;
