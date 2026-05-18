-- ============================================================
-- Migration 079 · Add trade_date to km_equity_weekly/monthly
--
-- compute_all_pending_indicators (and other RPCs) hardcode
-- "trade_date" as the date column name. km_equity_weekly and
-- km_equity_monthly were created without it.
--
-- Fix: add trade_date = week_end (resp. month_end) so all
-- existing table-parameterised RPCs work without modification.
-- Also update the aggregate RPCs to populate trade_date.
-- ============================================================

BEGIN;

-- ── 1. Add trade_date columns ─────────────────────────────────

ALTER TABLE km_equity_weekly
  ADD COLUMN IF NOT EXISTS trade_date DATE;

ALTER TABLE km_equity_monthly
  ADD COLUMN IF NOT EXISTS trade_date DATE;

-- ── 2. Backfill from existing rows ───────────────────────────

UPDATE km_equity_weekly  SET trade_date = week_end  WHERE trade_date IS NULL;
UPDATE km_equity_monthly SET trade_date = month_end WHERE trade_date IS NULL;

-- ── 3. Add indexes on trade_date ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_equity_weekly_trade_date
  ON km_equity_weekly(trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_equity_monthly_trade_date
  ON km_equity_monthly(trade_date DESC);

-- ── 4. Replace aggregate RPCs to populate trade_date ─────────

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
    equity_id, week_start, week_end, trade_date,
    open, high, low, close, volume, total_value, bar_count,
    deliv_qty, deliv_value_cr, avg_deliv_pct,
    w52_high, w52_low
  )
  SELECT
    e.equity_id,
    v_week_start                                         AS week_start,
    MAX(e.trade_date)                                    AS week_end,
    MAX(e.trade_date)                                    AS trade_date,
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]        AS open,
    MAX(e.high)                                          AS high,
    MIN(e.low)                                           AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]   AS close,
    SUM(e.volume)::BIGINT                                AS volume,
    SUM(e.value_cr)                                      AS total_value,
    COUNT(*)::INT                                        AS bar_count,
    SUM(e.delivery_qty)::BIGINT                          AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0)           AS deliv_value_cr,
    AVG(e.delivery_pct)                                  AS avg_deliv_pct,
    MAX(e.w52_high)                                      AS w52_high,
    MIN(e.w52_low)                                       AS w52_low
  FROM km_equity_eod e
  WHERE e.trade_date >= v_week_start
    AND e.trade_date <  v_week_start + INTERVAL '7 days'
    AND e.close IS NOT NULL
  GROUP BY e.equity_id
  ON CONFLICT (equity_id, week_start) DO UPDATE SET
    week_end               = EXCLUDED.week_end,
    trade_date             = EXCLUDED.trade_date,
    open                   = EXCLUDED.open,
    high                   = EXCLUDED.high,
    low                    = EXCLUDED.low,
    close                  = EXCLUDED.close,
    volume                 = EXCLUDED.volume,
    total_value            = EXCLUDED.total_value,
    bar_count              = EXCLUDED.bar_count,
    deliv_qty              = EXCLUDED.deliv_qty,
    deliv_value_cr         = EXCLUDED.deliv_value_cr,
    avg_deliv_pct          = EXCLUDED.avg_deliv_pct,
    w52_high               = EXCLUDED.w52_high,
    w52_low                = EXCLUDED.w52_low,
    indicators_computed_at = NULL,
    magic_rs               = NULL,
    magic_rs_zone          = NULL,
    flow_type              = NULL;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;


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
    equity_id, month_start, month_end, trade_date,
    open, high, low, close, volume, total_value, bar_count,
    deliv_qty, deliv_value_cr, avg_deliv_pct,
    w52_high, w52_low
  )
  SELECT
    e.equity_id,
    v_month_start                                        AS month_start,
    MAX(e.trade_date)                                    AS month_end,
    MAX(e.trade_date)                                    AS trade_date,
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]        AS open,
    MAX(e.high)                                          AS high,
    MIN(e.low)                                           AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]   AS close,
    SUM(e.volume)::BIGINT                                AS volume,
    SUM(e.value_cr)                                      AS total_value,
    COUNT(*)::INT                                        AS bar_count,
    SUM(e.delivery_qty)::BIGINT                          AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0)           AS deliv_value_cr,
    AVG(e.delivery_pct)                                  AS avg_deliv_pct,
    MAX(e.w52_high)                                      AS w52_high,
    MIN(e.w52_low)                                       AS w52_low
  FROM km_equity_eod e
  WHERE e.trade_date >= v_month_start
    AND e.trade_date <= v_month_end
    AND e.close IS NOT NULL
  GROUP BY e.equity_id
  ON CONFLICT (equity_id, month_start) DO UPDATE SET
    month_end              = EXCLUDED.month_end,
    trade_date             = EXCLUDED.trade_date,
    open                   = EXCLUDED.open,
    high                   = EXCLUDED.high,
    low                    = EXCLUDED.low,
    close                  = EXCLUDED.close,
    volume                 = EXCLUDED.volume,
    total_value            = EXCLUDED.total_value,
    bar_count              = EXCLUDED.bar_count,
    deliv_qty              = EXCLUDED.deliv_qty,
    deliv_value_cr         = EXCLUDED.deliv_value_cr,
    avg_deliv_pct          = EXCLUDED.avg_deliv_pct,
    w52_high               = EXCLUDED.w52_high,
    w52_low                = EXCLUDED.w52_low,
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
