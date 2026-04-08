-- ============================================================
-- Migration 017 · DC Inference Evaluation Function
-- evaluate_dc_inferences(index, minor_threshold, major_threshold, lookback_days)
-- ============================================================
--
-- Creates:
--   evaluate_dc_inferences() — evaluates each dc_inference rule against
--   real index price data from km_index_eod.
--
-- How outcomes are determined:
--   Each dc_inference row has a market_impact (e.g. 'major_positive',
--   'minor_negative', 'bullish', 'bearish') or NULL (turning-date events).
--
--   eval_status:
--     pending    — start_date is in the future
--     running    — event is currently active (today is within the window)
--     completed  — event window has fully passed
--
--   outcome (for completed events):
--     worked       — price moved in the predicted direction beyond the threshold
--     partial      — price touched the threshold intra-period but did not close there
--     failed       — price closed in the opposite direction
--     inconclusive — insufficient data or ambiguous movement
--     turned       — turning-date event; turn_direction describes what happened
--
--   Thresholds:
--     p_minor_threshold (default 0.5 %) — used for minor_positive / minor_negative
--     p_major_threshold (default 1.0 %) — used for major_positive / bullish / bearish
--
--   Turning-date analysis (market_impact IS NULL):
--     pre_trend  — % change in the p_lookback_days before start_date
--     post_trend — % change in the p_lookback_days after effective_end
--     turn_direction — turned_positive / turned_negative / more_positive /
--                      more_negative / no_clear_turn
-- ============================================================

CREATE OR REPLACE FUNCTION evaluate_dc_inferences(
    p_index_name      TEXT    DEFAULT 'NIFTY 50',
    p_minor_threshold NUMERIC DEFAULT 0.5,
    p_major_threshold NUMERIC DEFAULT 1.0,
    p_lookback_days   INTEGER DEFAULT 5
)
RETURNS TABLE (
    inference_id      BIGINT,
    astro_event       TEXT,
    start_date        DATE,
    end_date          DATE,
    market_impact     TEXT,
    eval_status       TEXT,
    prev_close        NUMERIC,
    peak_return_pct   NUMERIC,
    trough_return_pct NUMERIC,
    final_return_pct  NUMERIC,
    swing_attained    BOOLEAN,
    closed_direction  TEXT,
    outcome           TEXT,
    outcome_detail    TEXT,
    pre_trend_pct     NUMERIC,
    post_trend_pct    NUMERIC,
    turn_direction    TEXT
)
LANGUAGE plpgsql STABLE AS $func$
DECLARE
    v_index_id BIGINT;
BEGIN
    -- Resolve the index id once; return empty set if unknown index
    SELECT id INTO v_index_id
    FROM   km_index_symbols
    WHERE  name = p_index_name
    LIMIT  1;

    IF v_index_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH

    -- ── 1. All inferences with a resolved effective end ────────
    inf AS (
        SELECT
            i.id,
            i.astro_event,
            i.start_date,
            i.end_date,
            i.market_impact,
            COALESCE(i.end_date, i.start_date) AS effective_end
        FROM dc_inference i
    ),

    -- ── 2. Today's date ────────────────────────────────────────
    today_val AS (
        SELECT CURRENT_DATE AS dt
    ),

    -- ── 3. Evaluation status for each inference ────────────────
    inf_status AS (
        SELECT
            i.*,
            t.dt AS today,
            CASE
                WHEN i.start_date > t.dt                                        THEN 'pending'
                WHEN i.start_date <= t.dt AND t.dt <= COALESCE(i.end_date, i.start_date) THEN 'running'
                ELSE                                                                  'completed'
            END AS eval_status
        FROM inf i
        CROSS JOIN today_val t
    ),

    -- ── 4. Previous close: last EOD close before start_date ────
    --    Only fetched for running / completed events
    prev_close_data AS (
        SELECT DISTINCT ON (i.id)
            i.id,
            e.close AS prev_close
        FROM   inf_status i
        JOIN   km_index_eod e
               ON  e.index_id  = v_index_id
               AND e.trade_date < i.start_date
        WHERE  i.eval_status IN ('running', 'completed')
        ORDER  BY i.id, e.trade_date DESC
    ),

    -- ── 5. Peak / trough / final within the event window ───────
    event_window AS (
        SELECT
            i.id,
            MAX(e.high)                                               AS peak_high,
            MIN(e.low)                                                AS trough_low,
            (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]        AS final_close
        FROM   inf_status i
        JOIN   km_index_eod e
               ON  e.index_id  = v_index_id
               AND e.trade_date >= i.start_date
               AND e.trade_date <= LEAST(i.effective_end, i.today)
        WHERE  i.eval_status IN ('running', 'completed')
        GROUP  BY i.id
    ),

    -- ── 6. Pre-window: last p_lookback_days closes before start ─
    --    Only for completed turning-date (market_impact IS NULL) events
    pre_window AS (
        SELECT
            i.id,
            (ARRAY_AGG(e.close ORDER BY e.trade_date ASC ))[1]  AS first_close,
            (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]  AS last_close
        FROM   inf_status i
        CROSS  JOIN LATERAL (
            SELECT e2.close, e2.trade_date
            FROM   km_index_eod e2
            WHERE  e2.index_id  = v_index_id
              AND  e2.trade_date < i.start_date
            ORDER  BY e2.trade_date DESC
            LIMIT  p_lookback_days
        ) e
        WHERE  i.eval_status = 'completed'
          AND  i.market_impact IS NULL
        GROUP  BY i.id
    ),

    -- ── 7. Post-window: first p_lookback_days closes after end ──
    --    Only for completed turning-date (market_impact IS NULL) events
    post_window AS (
        SELECT
            i.id,
            (ARRAY_AGG(e.close ORDER BY e.trade_date ASC ))[1]  AS first_close,
            (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]  AS last_close
        FROM   inf_status i
        CROSS  JOIN LATERAL (
            SELECT e2.close, e2.trade_date
            FROM   km_index_eod e2
            WHERE  e2.index_id  = v_index_id
              AND  e2.trade_date > i.effective_end
            ORDER  BY e2.trade_date ASC
            LIMIT  p_lookback_days
        ) e
        WHERE  i.eval_status = 'completed'
          AND  i.market_impact IS NULL
        GROUP  BY i.id
    ),

    -- ── 8. Computed returns ─────────────────────────────────────
    computed AS (
        SELECT
            s.id,
            s.astro_event,
            s.start_date,
            s.end_date,
            s.market_impact,
            s.effective_end,
            s.eval_status,
            p.prev_close,
            w.peak_high,
            w.trough_low,
            w.final_close,
            -- Percentage returns relative to prev_close
            CASE WHEN p.prev_close > 0
                 THEN ROUND(((w.peak_high   - p.prev_close) / p.prev_close) * 100, 2)
            END AS peak_ret,
            CASE WHEN p.prev_close > 0
                 THEN ROUND(((w.trough_low  - p.prev_close) / p.prev_close) * 100, 2)
            END AS trough_ret,
            CASE WHEN p.prev_close > 0
                 THEN ROUND(((w.final_close - p.prev_close) / p.prev_close) * 100, 2)
            END AS final_ret,
            -- Pre/post trend for turning-date analysis
            CASE WHEN pr.first_close > 0
                 THEN ROUND(((pr.last_close - pr.first_close) / pr.first_close) * 100, 2)
            END AS pre_trend,
            CASE WHEN po.first_close > 0
                 THEN ROUND(((po.last_close - po.first_close) / po.first_close) * 100, 2)
            END AS post_trend
        FROM       inf_status       s
        LEFT JOIN  prev_close_data  p  ON p.id = s.id
        LEFT JOIN  event_window     w  ON w.id = s.id
        LEFT JOIN  pre_window       pr ON pr.id = s.id
        LEFT JOIN  post_window      po ON po.id = s.id
    ),

    -- ── 9. Directional flags ────────────────────────────────────
    directional AS (
        SELECT
            c.*,
            -- swing_attained: did price touch the threshold intra-period?
            CASE
                WHEN c.eval_status = 'pending'      THEN NULL
                WHEN c.prev_close  IS NULL           THEN NULL
                WHEN c.market_impact IN ('major_positive', 'bullish')
                     THEN COALESCE(c.peak_ret   >= p_major_threshold, FALSE)
                WHEN c.market_impact = 'minor_positive'
                     THEN COALESCE(c.peak_ret   >= p_minor_threshold, FALSE)
                WHEN c.market_impact IN ('major_negative', 'bearish')
                     THEN COALESCE(c.trough_ret <= -p_major_threshold, FALSE)
                WHEN c.market_impact = 'minor_negative'
                     THEN COALESCE(c.trough_ret <= -p_minor_threshold, FALSE)
                ELSE FALSE
            END AS swing_attained,
            -- closed_dir: which direction did price ultimately close?
            CASE
                WHEN c.final_ret IS NULL                   THEN NULL
                WHEN c.final_ret >=  p_minor_threshold     THEN 'positive'
                WHEN c.final_ret <= -p_minor_threshold     THEN 'negative'
                ELSE                                            'neutral'
            END AS closed_dir
        FROM computed c
    )

    -- ── Final projection with outcome logic ────────────────────
    SELECT
        d.id                     AS inference_id,
        d.astro_event,
        d.start_date,
        d.end_date,
        d.market_impact,
        d.eval_status,
        d.prev_close,
        d.peak_ret               AS peak_return_pct,
        d.trough_ret             AS trough_return_pct,
        d.final_ret              AS final_return_pct,
        d.swing_attained,
        d.closed_dir             AS closed_direction,

        -- ── outcome ──────────────────────────────────────────
        CASE
            WHEN d.eval_status = 'pending'   THEN 'pending'
            WHEN d.eval_status = 'running'   THEN 'running'
            WHEN d.prev_close  IS NULL       THEN 'inconclusive'
            WHEN d.market_impact IS NULL     THEN 'turned'

            WHEN d.market_impact IN ('major_positive', 'bullish') THEN
                CASE
                    WHEN d.final_ret >= p_major_threshold                                  THEN 'worked'
                    WHEN d.swing_attained AND d.closed_dir <> 'positive'                   THEN 'partial'
                    WHEN d.closed_dir = 'negative'                                         THEN 'failed'
                    ELSE                                                                         'inconclusive'
                END

            WHEN d.market_impact = 'minor_positive' THEN
                CASE
                    WHEN d.final_ret >= p_minor_threshold                                  THEN 'worked'
                    WHEN d.swing_attained AND d.closed_dir <> 'positive'                   THEN 'partial'
                    WHEN d.closed_dir = 'negative'                                         THEN 'failed'
                    ELSE                                                                         'inconclusive'
                END

            WHEN d.market_impact IN ('major_negative', 'bearish') THEN
                CASE
                    WHEN d.final_ret <= -p_major_threshold                                 THEN 'worked'
                    WHEN d.swing_attained AND d.closed_dir <> 'negative'                   THEN 'partial'
                    WHEN d.closed_dir = 'positive'                                         THEN 'failed'
                    ELSE                                                                         'inconclusive'
                END

            WHEN d.market_impact = 'minor_negative' THEN
                CASE
                    WHEN d.final_ret <= -p_minor_threshold                                 THEN 'worked'
                    WHEN d.swing_attained AND d.closed_dir <> 'negative'                   THEN 'partial'
                    WHEN d.closed_dir = 'positive'                                         THEN 'failed'
                    ELSE                                                                         'inconclusive'
                END

            ELSE 'inconclusive'
        END AS outcome,

        -- ── outcome_detail ────────────────────────────────────
        CASE
            WHEN d.eval_status = 'pending' THEN
                'Starts ' || TO_CHAR(d.start_date, 'DD Mon YYYY')

            WHEN d.eval_status = 'running' THEN
                'Current return ' || COALESCE(d.final_ret::TEXT, 'n/a') || '%; '
                || CASE WHEN d.swing_attained IS TRUE THEN 'swing threshold attained'
                        WHEN d.swing_attained IS FALSE THEN 'swing threshold not yet attained'
                        ELSE 'no swing data'
                   END

            WHEN d.prev_close IS NULL THEN
                'No index price data'

            WHEN d.market_impact IS NULL THEN
                'Pre-trend ' || COALESCE(d.pre_trend::TEXT, 'n/a') || '%; '
                || 'post-trend ' || COALESCE(d.post_trend::TEXT, 'n/a') || '%'

            ELSE
                'Closed ' || COALESCE(d.final_ret::TEXT, 'n/a') || '%; '
                || 'swing ' || COALESCE(d.peak_ret::TEXT, 'n/a') || '% / '
                || COALESCE(d.trough_ret::TEXT, 'n/a') || '%'
        END AS outcome_detail,

        -- ── turn_direction (turning-date events only) ─────────
        CASE
            WHEN d.market_impact IS NULL AND d.eval_status = 'completed' THEN
                CASE
                    WHEN d.pre_trend <  0 AND d.post_trend >  0
                         THEN 'turned_positive'
                    WHEN d.pre_trend >  0 AND d.post_trend <  0
                         THEN 'turned_negative'
                    WHEN d.pre_trend <= 0 AND d.post_trend <  d.pre_trend
                         THEN 'more_negative'
                    WHEN d.pre_trend >= 0 AND d.post_trend >  d.pre_trend
                         THEN 'more_positive'
                    ELSE 'no_clear_turn'
                END
        END AS turn_direction

    FROM directional d
    ORDER BY d.start_date DESC;

END;
$func$;

-- ── Grants (wrapped in DO blocks to survive missing roles) ─────

DO $$ BEGIN
    GRANT EXECUTE ON FUNCTION evaluate_dc_inferences(TEXT, NUMERIC, NUMERIC, INTEGER)
        TO authenticated;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
    GRANT EXECUTE ON FUNCTION evaluate_dc_inferences(TEXT, NUMERIC, NUMERIC, INTEGER)
        TO kd_app;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
    GRANT EXECUTE ON FUNCTION evaluate_dc_inferences(TEXT, NUMERIC, NUMERIC, INTEGER)
        TO anon;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
