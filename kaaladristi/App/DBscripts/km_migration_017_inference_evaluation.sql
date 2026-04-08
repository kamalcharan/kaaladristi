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
--   Each dc_inference row has a market_impact or NULL (turning-date).
--
--   eval_status:
--     pending    — start_date is in the future
--     running    — event is currently active (today is within the window)
--     completed  — event window has fully passed
--
--   outcome (for completed events):
--     worked       — price closed in predicted direction beyond threshold
--     partial      — price touched the threshold intra-period but closed back
--     failed       — price closed in the opposite direction
--     inconclusive — ambiguous or non-directional prediction
--     turned       — turning-date event; turn_direction describes what happened
--
--   Thresholds:
--     p_minor_threshold (default 0.5 %) — minor_positive / minor_negative
--     p_major_threshold (default 1.0 %) — major_positive / bullish / bearish
--
--   Turning-date analysis (market_impact IS NULL):
--     pre_trend  — % change over the p_lookback_days before start_date
--     post_trend — % change over the p_lookback_days after effective_end
--     turn_direction — turned_positive / turned_negative / more_positive /
--                      more_negative / no_clear_turn
-- ============================================================

-- Drop any previous version (allows changing return type)
DROP FUNCTION IF EXISTS evaluate_dc_inferences(TEXT, NUMERIC, NUMERIC, INTEGER);

CREATE FUNCTION evaluate_dc_inferences(
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
    v_today    DATE := CURRENT_DATE;
BEGIN
    SELECT id INTO v_index_id
    FROM   km_index_symbols
    WHERE  name = p_index_name
    LIMIT  1;

    IF v_index_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH

    -- ── 1. All inferences with effective_end ──────────────────
    inf AS (
        SELECT
            i.id::BIGINT                                          AS id,
            i.astro_event::TEXT                                   AS astro_event,
            i.start_date::DATE                                    AS start_date,
            i.end_date::DATE                                      AS end_date,
            i.market_impact::TEXT                                 AS market_impact,
            COALESCE(i.end_date, i.start_date)::DATE              AS effective_end,
            CASE
                WHEN i.start_date > v_today                                    THEN 'pending'
                WHEN i.start_date <= v_today
                 AND v_today <= COALESCE(i.end_date, i.start_date)             THEN 'running'
                ELSE                                                               'completed'
            END::TEXT                                             AS eval_status
        FROM dc_inference i
    ),

    -- ── 2. Previous close: last EOD close before start_date ───
    prev_close_cte AS (
        SELECT DISTINCT ON (i.id)
            i.id,
            e.close::NUMERIC AS prev_close
        FROM   inf i
        JOIN   km_index_eod e
               ON  e.index_id  = v_index_id
               AND e.trade_date < i.start_date
        WHERE  i.eval_status IN ('running', 'completed')
        ORDER  BY i.id, e.trade_date DESC
    ),

    -- ── 3. Event window: peak / trough / final close ──────────
    event_cte AS (
        SELECT
            i.id,
            MAX(e.high)::NUMERIC                                   AS peak_high,
            MIN(e.low)::NUMERIC                                    AS trough_low,
            (ARRAY_AGG(e.close::NUMERIC ORDER BY e.trade_date DESC))[1] AS final_close
        FROM   inf i
        JOIN   km_index_eod e
               ON  e.index_id  = v_index_id
               AND e.trade_date >= i.start_date
               AND e.trade_date <= LEAST(i.effective_end, v_today)
        WHERE  i.eval_status IN ('running', 'completed')
        GROUP  BY i.id
    ),

    -- ── 4. Pre-window for turning dates ───────────────────────
    pre_cte AS (
        SELECT
            i.id,
            (ARRAY_AGG(e.close::NUMERIC ORDER BY e.trade_date ASC ))[1]  AS first_close,
            (ARRAY_AGG(e.close::NUMERIC ORDER BY e.trade_date DESC))[1]  AS last_close
        FROM   inf i
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

    -- ── 5. Post-window for turning dates ──────────────────────
    post_cte AS (
        SELECT
            i.id,
            (ARRAY_AGG(e.close::NUMERIC ORDER BY e.trade_date ASC ))[1]  AS first_close,
            (ARRAY_AGG(e.close::NUMERIC ORDER BY e.trade_date DESC))[1]  AS last_close
        FROM   inf i
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

    -- ── 6. Compute percentage returns ─────────────────────────
    returns_cte AS (
        SELECT
            i.id,
            i.astro_event,
            i.start_date,
            i.end_date,
            i.market_impact,
            i.effective_end,
            i.eval_status,
            p.prev_close,
            CASE WHEN p.prev_close > 0
                 THEN ROUND(((ev.peak_high   - p.prev_close) / p.prev_close) * 100::NUMERIC, 2)
            END AS peak_ret,
            CASE WHEN p.prev_close > 0
                 THEN ROUND(((ev.trough_low  - p.prev_close) / p.prev_close) * 100::NUMERIC, 2)
            END AS trough_ret,
            CASE WHEN p.prev_close > 0
                 THEN ROUND(((ev.final_close - p.prev_close) / p.prev_close) * 100::NUMERIC, 2)
            END AS final_ret,
            CASE WHEN pr.first_close > 0
                 THEN ROUND(((pr.last_close  - pr.first_close) / pr.first_close) * 100::NUMERIC, 2)
            END AS pre_trend,
            CASE WHEN po.first_close > 0
                 THEN ROUND(((po.last_close  - po.first_close) / po.first_close) * 100::NUMERIC, 2)
            END AS post_trend
        FROM       inf          i
        LEFT JOIN  prev_close_cte p  ON p.id = i.id
        LEFT JOIN  event_cte     ev ON ev.id = i.id
        LEFT JOIN  pre_cte       pr ON pr.id = i.id
        LEFT JOIN  post_cte      po ON po.id = i.id
    ),

    -- ── 7. Directional flags ───────────────────────────────────
    flags_cte AS (
        SELECT
            r.id,
            r.astro_event,
            r.start_date,
            r.end_date,
            r.market_impact,
            r.eval_status,
            r.prev_close,
            r.peak_ret,
            r.trough_ret,
            r.final_ret,
            r.pre_trend,
            r.post_trend,
            -- swing_attained
            CASE
                WHEN r.eval_status = 'pending'  THEN NULL::BOOLEAN
                WHEN r.prev_close  IS NULL       THEN NULL::BOOLEAN
                WHEN r.market_impact IN ('major_positive', 'bullish')
                     THEN COALESCE(r.peak_ret   >= p_major_threshold, FALSE)
                WHEN r.market_impact = 'minor_positive'
                     THEN COALESCE(r.peak_ret   >= p_minor_threshold, FALSE)
                WHEN r.market_impact IN ('major_negative', 'bearish')
                     THEN COALESCE(r.trough_ret <= -p_major_threshold, FALSE)
                WHEN r.market_impact = 'minor_negative'
                     THEN COALESCE(r.trough_ret <= -p_minor_threshold, FALSE)
                ELSE FALSE
            END AS swing_attained,
            -- closed_dir
            CASE
                WHEN r.final_ret IS NULL                THEN NULL::TEXT
                WHEN r.final_ret >=  p_minor_threshold  THEN 'positive'
                WHEN r.final_ret <= -p_minor_threshold  THEN 'negative'
                ELSE                                         'neutral'
            END::TEXT AS closed_dir
        FROM returns_cte r
    )

    -- ── Final projection ───────────────────────────────────────
    SELECT
        f.id::BIGINT                                AS inference_id,
        f.astro_event::TEXT                         AS astro_event,
        f.start_date::DATE                          AS start_date,
        f.end_date::DATE                            AS end_date,
        f.market_impact::TEXT                       AS market_impact,
        f.eval_status::TEXT                         AS eval_status,
        f.prev_close::NUMERIC                       AS prev_close,
        f.peak_ret::NUMERIC                         AS peak_return_pct,
        f.trough_ret::NUMERIC                       AS trough_return_pct,
        f.final_ret::NUMERIC                        AS final_return_pct,
        f.swing_attained::BOOLEAN                   AS swing_attained,
        f.closed_dir::TEXT                          AS closed_direction,

        -- outcome
        CASE
            WHEN f.eval_status = 'pending'   THEN 'pending'
            WHEN f.eval_status = 'running'   THEN 'running'
            WHEN f.prev_close  IS NULL       THEN 'inconclusive'
            WHEN f.market_impact IS NULL     THEN 'turned'
            WHEN f.market_impact IN ('major_positive', 'bullish') THEN
                CASE
                    WHEN f.final_ret >= p_major_threshold                      THEN 'worked'
                    WHEN f.swing_attained AND f.closed_dir <> 'positive'        THEN 'partial'
                    WHEN f.closed_dir = 'negative'                             THEN 'failed'
                    ELSE                                                             'inconclusive'
                END
            WHEN f.market_impact = 'minor_positive' THEN
                CASE
                    WHEN f.final_ret >= p_minor_threshold                      THEN 'worked'
                    WHEN f.swing_attained AND f.closed_dir <> 'positive'        THEN 'partial'
                    WHEN f.closed_dir = 'negative'                             THEN 'failed'
                    ELSE                                                             'inconclusive'
                END
            WHEN f.market_impact IN ('major_negative', 'bearish') THEN
                CASE
                    WHEN f.final_ret <= -p_major_threshold                     THEN 'worked'
                    WHEN f.swing_attained AND f.closed_dir <> 'negative'        THEN 'partial'
                    WHEN f.closed_dir = 'positive'                             THEN 'failed'
                    ELSE                                                             'inconclusive'
                END
            WHEN f.market_impact = 'minor_negative' THEN
                CASE
                    WHEN f.final_ret <= -p_minor_threshold                     THEN 'worked'
                    WHEN f.swing_attained AND f.closed_dir <> 'negative'        THEN 'partial'
                    WHEN f.closed_dir = 'positive'                             THEN 'failed'
                    ELSE                                                             'inconclusive'
                END
            ELSE 'inconclusive'
        END::TEXT                                   AS outcome,

        -- outcome_detail
        CASE
            WHEN f.eval_status = 'pending' THEN
                'Starts ' || TO_CHAR(f.start_date, 'DD Mon YYYY')
            WHEN f.eval_status = 'running' THEN
                'Live: ' || COALESCE(f.final_ret::TEXT, 'n/a') || '% close; swing '
                || COALESCE(f.peak_ret::TEXT, 'n/a') || '% / '
                || COALESCE(f.trough_ret::TEXT, 'n/a') || '%'
            WHEN f.prev_close IS NULL THEN
                'No index price data'
            WHEN f.market_impact IS NULL THEN
                'Pre ' || COALESCE(f.pre_trend::TEXT, 'n/a')
                || '% → Post ' || COALESCE(f.post_trend::TEXT, 'n/a') || '%'
            ELSE
                'Close ' || COALESCE(f.final_ret::TEXT, 'n/a')
                || '% · Swing ↑' || COALESCE(f.peak_ret::TEXT, 'n/a')
                || '% ↓' || COALESCE(f.trough_ret::TEXT, 'n/a') || '%'
        END::TEXT                                   AS outcome_detail,

        f.pre_trend::NUMERIC                        AS pre_trend_pct,
        f.post_trend::NUMERIC                       AS post_trend_pct,

        -- turn_direction
        CASE
            WHEN f.market_impact IS NULL AND f.eval_status = 'completed' THEN
                CASE
                    WHEN f.pre_trend <  0 AND f.post_trend >  0             THEN 'turned_positive'
                    WHEN f.pre_trend >  0 AND f.post_trend <  0             THEN 'turned_negative'
                    WHEN f.pre_trend <= 0 AND f.post_trend <  f.pre_trend   THEN 'more_negative'
                    WHEN f.pre_trend >= 0 AND f.post_trend >  f.pre_trend   THEN 'more_positive'
                    ELSE                                                          'no_clear_turn'
                END
            ELSE NULL
        END::TEXT                                   AS turn_direction

    FROM   flags_cte f
    ORDER  BY f.start_date DESC;

END;
$func$;

-- ── Grants ─────────────────────────────────────────────────────

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
