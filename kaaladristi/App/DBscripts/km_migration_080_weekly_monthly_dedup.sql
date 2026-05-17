-- ============================================================
-- Migration 080 · Weekly/monthly aggregate deduplication
--
-- Problem: aggregate_equity_weekly / _monthly queried km_equity_eod
-- directly, producing ~6,713 equity_id rows (NSE + BSE duplicates)
-- instead of the expected ~1,380 deduplicated stocks.
--
-- Fix: replicate the v_equity_eod_deduped dedup logic inline —
-- DISTINCT ON (COALESCE(isin, symbol||'_'||exchange)) with
-- NSE preferred — so each company contributes exactly one row.
--
-- Cleanup: DELETE existing BSE-duplicate rows from both tables.
-- Run --backfill-weekly --from 2020-01-01 after applying this
-- migration to re-aggregate clean data.
-- ============================================================

BEGIN;

-- ── 1. Delete BSE-duplicate rows from km_equity_weekly ────────
-- A row is a BSE duplicate when its equity_id belongs to a BSE
-- listing AND an NSE listing of the same ISIN exists in the table.

DELETE FROM km_equity_weekly w
WHERE EXISTS (
  SELECT 1
  FROM km_equity_symbols bse
  JOIN km_equity_symbols nse
    ON nse.isin = bse.isin AND nse.exchange = 'NSE' AND nse.is_active = true
  WHERE bse.id = w.equity_id
    AND bse.exchange = 'BSE'
    AND bse.isin IS NOT NULL
);

-- ── 2. Delete BSE-duplicate rows from km_equity_monthly ───────

DELETE FROM km_equity_monthly m
WHERE EXISTS (
  SELECT 1
  FROM km_equity_symbols bse
  JOIN km_equity_symbols nse
    ON nse.isin = bse.isin AND nse.exchange = 'NSE' AND nse.is_active = true
  WHERE bse.id = m.equity_id
    AND bse.exchange = 'BSE'
    AND bse.isin IS NOT NULL
);

-- ── 3. Replace aggregate_equity_weekly with dedup logic ───────

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
  -- NSE-preferred dedup: for each ISIN pick the NSE equity_id when
  -- both NSE and BSE rows exist in this week's date range.
  WITH preferred AS (
    SELECT DISTINCT ON (COALESCE(s.isin, s.symbol || '_' || s.exchange))
      e.equity_id
    FROM km_equity_eod e
    JOIN km_equity_symbols s ON s.id = e.equity_id
    WHERE s.is_active = true
      AND e.trade_date >= v_week_start
      AND e.trade_date <  v_week_start + INTERVAL '7 days'
      AND e.close IS NOT NULL
    ORDER BY COALESCE(s.isin, s.symbol || '_' || s.exchange),
             CASE s.exchange WHEN 'NSE' THEN 1 WHEN 'BSE' THEN 2 ELSE 3 END
  )
  SELECT
    e.equity_id,
    v_week_start                                          AS week_start,
    MAX(e.trade_date)                                     AS week_end,
    MAX(e.trade_date)                                     AS trade_date,
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]         AS open,
    MAX(e.high)                                           AS high,
    MIN(e.low)                                            AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]    AS close,
    SUM(e.volume)::BIGINT                                 AS volume,
    SUM(e.value_cr)                                       AS total_value,
    COUNT(*)::INT                                         AS bar_count,
    SUM(e.delivery_qty)::BIGINT                           AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0)            AS deliv_value_cr,
    AVG(e.delivery_pct)                                   AS avg_deliv_pct,
    MAX(e.w52_high)                                       AS w52_high,
    MIN(e.w52_low)                                        AS w52_low
  FROM km_equity_eod e
  WHERE e.equity_id IN (SELECT equity_id FROM preferred)
    AND e.trade_date >= v_week_start
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


-- ── 4. Replace aggregate_equity_monthly with dedup logic ──────

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
  WITH preferred AS (
    SELECT DISTINCT ON (COALESCE(s.isin, s.symbol || '_' || s.exchange))
      e.equity_id
    FROM km_equity_eod e
    JOIN km_equity_symbols s ON s.id = e.equity_id
    WHERE s.is_active = true
      AND e.trade_date >= v_month_start
      AND e.trade_date <= v_month_end
      AND e.close IS NOT NULL
    ORDER BY COALESCE(s.isin, s.symbol || '_' || s.exchange),
             CASE s.exchange WHEN 'NSE' THEN 1 WHEN 'BSE' THEN 2 ELSE 3 END
  )
  SELECT
    e.equity_id,
    v_month_start                                         AS month_start,
    MAX(e.trade_date)                                     AS month_end,
    MAX(e.trade_date)                                     AS trade_date,
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]         AS open,
    MAX(e.high)                                           AS high,
    MIN(e.low)                                            AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1]    AS close,
    SUM(e.volume)::BIGINT                                 AS volume,
    SUM(e.value_cr)                                       AS total_value,
    COUNT(*)::INT                                         AS bar_count,
    SUM(e.delivery_qty)::BIGINT                           AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0)            AS deliv_value_cr,
    AVG(e.delivery_pct)                                   AS avg_deliv_pct,
    MAX(e.w52_high)                                       AS w52_high,
    MIN(e.w52_low)                                       AS w52_low
  FROM km_equity_eod e
  WHERE e.equity_id IN (SELECT equity_id FROM preferred)
    AND e.trade_date >= v_month_start
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
