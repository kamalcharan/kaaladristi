-- ============================================================
-- Migration 078 · Fix aggregate_equity_weekly / _monthly RPCs
--
-- Migration 075-076 referenced three columns that do not exist
-- in km_equity_eod:
--   WRONG                    CORRECT
--   e.traded_value        →  e.value_cr
--   e.deliv_qty           →  e.delivery_qty
--   e.deliv_value_cr      →  computed: delivery_qty * close / 10,000,000
--   e.deliv_pct           →  e.delivery_pct
--
-- This migration replaces both RPCs with the corrected versions.
-- The km_equity_weekly and km_equity_monthly tables are untouched.
-- ============================================================

BEGIN;

-- ── aggregate_equity_weekly (corrected) ──────────────────────

CREATE OR REPLACE FUNCTION aggregate_equity_weekly(
  p_trade_date DATE
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_week_start DATE;
  inserted     INT;
BEGIN
  v_week_start := DATE_TRUNC('week', p_trade_date)::DATE;

  INSERT INTO km_equity_weekly (
    equity_id, week_start, week_end,
    open, high, low, close, volume, total_value, bar_count,
    deliv_qty, deliv_value_cr, avg_deliv_pct,
    w52_high, w52_low
  )
  SELECT
    e.equity_id,
    v_week_start                                         AS week_start,
    MAX(e.trade_date)                                    AS week_end,
    -- OHLCV
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]        AS open,
    MAX(e.high)                                          AS high,
    MIN(e.low)                                           AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]   AS close,
    SUM(e.volume)::BIGINT                                AS volume,
    SUM(e.value_cr)                                      AS total_value,
    COUNT(*)::INT                                        AS bar_count,
    -- Delivery
    SUM(e.delivery_qty)::BIGINT                          AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0)           AS deliv_value_cr,
    AVG(e.delivery_pct)                                  AS avg_deliv_pct,
    -- 52-week high/low
    MAX(e.w52_high)                                      AS w52_high,
    MIN(e.w52_low)                                       AS w52_low
  FROM km_equity_eod e
  WHERE e.trade_date >= v_week_start
    AND e.trade_date <  v_week_start + INTERVAL '7 days'
    AND e.close IS NOT NULL
  GROUP BY e.equity_id
  ON CONFLICT (equity_id, week_start) DO UPDATE SET
    week_end              = EXCLUDED.week_end,
    open                  = EXCLUDED.open,
    high                  = EXCLUDED.high,
    low                   = EXCLUDED.low,
    close                 = EXCLUDED.close,
    volume                = EXCLUDED.volume,
    total_value           = EXCLUDED.total_value,
    bar_count             = EXCLUDED.bar_count,
    deliv_qty             = EXCLUDED.deliv_qty,
    deliv_value_cr        = EXCLUDED.deliv_value_cr,
    avg_deliv_pct         = EXCLUDED.avg_deliv_pct,
    w52_high              = EXCLUDED.w52_high,
    w52_low               = EXCLUDED.w52_low,
    indicators_computed_at = NULL,
    magic_rs               = NULL,
    magic_rs_zone          = NULL,
    flow_type              = NULL;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;


-- ── aggregate_equity_monthly (corrected) ─────────────────────

CREATE OR REPLACE FUNCTION aggregate_equity_monthly(
  p_trade_date DATE
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_month_start DATE;
  v_month_end   DATE;
  inserted      INT;
BEGIN
  v_month_start := DATE_TRUNC('month', p_trade_date)::DATE;
  v_month_end   := (v_month_start + INTERVAL '1 month - 1 day')::DATE;

  INSERT INTO km_equity_monthly (
    equity_id, month_start, month_end,
    open, high, low, close, volume, total_value, bar_count,
    deliv_qty, deliv_value_cr, avg_deliv_pct,
    w52_high, w52_low
  )
  SELECT
    e.equity_id,
    v_month_start                                        AS month_start,
    MAX(e.trade_date)                                    AS month_end,
    -- OHLCV
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]        AS open,
    MAX(e.high)                                          AS high,
    MIN(e.low)                                           AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]   AS close,
    SUM(e.volume)::BIGINT                                AS volume,
    SUM(e.value_cr)                                      AS total_value,
    COUNT(*)::INT                                        AS bar_count,
    -- Delivery
    SUM(e.delivery_qty)::BIGINT                          AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0)           AS deliv_value_cr,
    AVG(e.delivery_pct)                                  AS avg_deliv_pct,
    -- 52-week high/low
    MAX(e.w52_high)                                      AS w52_high,
    MIN(e.w52_low)                                       AS w52_low
  FROM km_equity_eod e
  WHERE e.trade_date >= v_month_start
    AND e.trade_date <= v_month_end
    AND e.close IS NOT NULL
  GROUP BY e.equity_id
  ON CONFLICT (equity_id, month_start) DO UPDATE SET
    month_end             = EXCLUDED.month_end,
    open                  = EXCLUDED.open,
    high                  = EXCLUDED.high,
    low                   = EXCLUDED.low,
    close                 = EXCLUDED.close,
    volume                = EXCLUDED.volume,
    total_value           = EXCLUDED.total_value,
    bar_count             = EXCLUDED.bar_count,
    deliv_qty             = EXCLUDED.deliv_qty,
    deliv_value_cr        = EXCLUDED.deliv_value_cr,
    avg_deliv_pct         = EXCLUDED.avg_deliv_pct,
    w52_high              = EXCLUDED.w52_high,
    w52_low               = EXCLUDED.w52_low,
    indicators_computed_at = NULL,
    magic_rs               = NULL,
    magic_rs_zone          = NULL,
    flow_type              = NULL;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;


-- ── Permissions ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION aggregate_equity_weekly(DATE)  TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION aggregate_equity_monthly(DATE) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
