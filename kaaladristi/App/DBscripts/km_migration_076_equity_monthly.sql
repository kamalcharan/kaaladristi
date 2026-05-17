-- ============================================================
-- Migration 076 · km_equity_monthly Table + Aggregate RPC
--
-- Monthly OHLCV + indicator aggregate for equities.
-- month_start = DATE_TRUNC('month', trade_date).
--
-- Column set mirrors km_equity_weekly / km_equity_eod so that
-- the existing RPCs can be called against this table unchanged.
--
-- Pipeline call order after EOD completes on the last trading
-- day of the month:
--   1. aggregate_equity_monthly(trade_date)
--   2. compute_all_pending_indicators('km_equity_monthly', 'equity_id')
--   3. compute_all_magic_rs('km_equity_monthly', 'equity_id')
--   4. compute_all_flow_intelligence('km_equity_monthly', 'equity_id')
-- ============================================================

BEGIN;

-- ── Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS km_equity_monthly (
  id           BIGSERIAL PRIMARY KEY,
  equity_id    INT         NOT NULL REFERENCES km_equity_symbols(id),
  month_start  DATE        NOT NULL,   -- YYYY-MM-01
  month_end    DATE        NOT NULL,   -- Last trading day of that month

  -- OHLCV aggregated from daily rows
  open         NUMERIC,
  high         NUMERIC,
  low          NUMERIC,
  close        NUMERIC,                -- close of month_end day
  volume       BIGINT,
  total_value  NUMERIC,               -- sum of traded value across the month
  bar_count    INT,                   -- number of trading days in this bar

  -- Delivery (monthly sum)
  deliv_qty         BIGINT,
  deliv_value_cr    NUMERIC,
  avg_deliv_pct     NUMERIC,

  -- Return columns (monthly close vs prior closes)
  ret_5d       NUMERIC,               -- 5-month return
  ret_22d      NUMERIC,               -- 22-month return (~2 years)
  ret_66d      NUMERIC,               -- 66-month return (~5.5 years)

  -- Indicator columns (written by compute_indicators_batch)
  sma_8        NUMERIC,
  sma_10       NUMERIC,
  sma_21       NUMERIC,
  sma_40       NUMERIC,
  sma_50       NUMERIC,
  sma_55       NUMERIC,
  sma_89       NUMERIC,
  sma_150      NUMERIC,
  sma_200      NUMERIC,
  sma_233      NUMERIC,
  ema_20       NUMERIC,
  ema_60       NUMERIC,
  rsi_14       NUMERIC,
  rsi_9        NUMERIC,
  mfi_14       NUMERIC,
  atr_10       NUMERIC,
  atr_14       NUMERIC,
  obv          BIGINT,
  obv_sma_20   NUMERIC,
  rvol         NUMERIC,
  tvol         NUMERIC,
  pivot_pp     NUMERIC,
  pivot_r1     NUMERIC,
  pivot_r2     NUMERIC,
  pivot_r3     NUMERIC,
  pivot_s1     NUMERIC,
  pivot_s2     NUMERIC,
  pivot_s3     NUMERIC,
  sniper_inst  NUMERIC,
  sniper_hot   NUMERIC,
  sniper_rsi   NUMERIC,
  rss_spread   NUMERIC,
  rss_value    NUMERIC,
  indicators_computed_at TIMESTAMPTZ,

  -- MagicRS columns (written by compute_magic_rs_batch)
  magic_rs        NUMERIC,
  magic_rs_sma144 NUMERIC,
  magic_ma        NUMERIC,
  magic_rs_zone   TEXT
    CHECK (magic_rs_zone IS NULL OR magic_rs_zone IN (
      'Strong Bull', 'Mild Bull', 'Neutral', 'Mild Bear', 'Strong Bear'
    )),

  -- Flow intelligence columns (written by compute_flow_intelligence)
  flow_type    TEXT,
  vacuum_flag  BOOLEAN,
  accum_distrib TEXT,

  -- 52-week high/low (rolling from daily data at month end)
  w52_high     NUMERIC,
  w52_low      NUMERIC,

  UNIQUE (equity_id, month_start)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_equity_monthly_equity_month
  ON km_equity_monthly(equity_id, month_start DESC);

CREATE INDEX IF NOT EXISTS idx_equity_monthly_month_start
  ON km_equity_monthly(month_start DESC);

CREATE INDEX IF NOT EXISTS idx_equity_monthly_pending_indicators
  ON km_equity_monthly(equity_id)
  WHERE indicators_computed_at IS NULL;

-- ── RPC: aggregate one month ──────────────────────────────────
-- Upserts one row per equity from km_equity_eod for the calendar
-- month containing p_trade_date. Safe to call on any day of the
-- month (will aggregate whatever days are present).

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
    v_month_start                            AS month_start,
    MAX(e.trade_date)                        AS month_end,
    -- OHLCV
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]     AS open,
    MAX(e.high)                              AS high,
    MIN(e.low)                               AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1] AS close,
    SUM(e.volume)::BIGINT                    AS volume,
    SUM(e.traded_value)                      AS total_value,
    COUNT(*)::INT                            AS bar_count,
    -- Delivery
    SUM(e.deliv_qty)::BIGINT                 AS deliv_qty,
    SUM(e.deliv_value_cr)                    AS deliv_value_cr,
    AVG(e.deliv_pct)                         AS avg_deliv_pct,
    -- 52-week levels
    MAX(e.w52_high)                          AS w52_high,
    MIN(e.w52_low)                           AS w52_low
  FROM km_equity_eod e
  WHERE e.trade_date >= v_month_start
    AND e.trade_date <= v_month_end
    AND e.close IS NOT NULL
  GROUP BY e.equity_id
  ON CONFLICT (equity_id, month_start) DO UPDATE SET
    month_end       = EXCLUDED.month_end,
    open            = EXCLUDED.open,
    high            = EXCLUDED.high,
    low             = EXCLUDED.low,
    close           = EXCLUDED.close,
    volume          = EXCLUDED.volume,
    total_value     = EXCLUDED.total_value,
    bar_count       = EXCLUDED.bar_count,
    deliv_qty       = EXCLUDED.deliv_qty,
    deliv_value_cr  = EXCLUDED.deliv_value_cr,
    avg_deliv_pct   = EXCLUDED.avg_deliv_pct,
    w52_high        = EXCLUDED.w52_high,
    w52_low         = EXCLUDED.w52_low,
    -- Reset computed columns so indicators are re-run after aggregation
    indicators_computed_at = NULL,
    magic_rs        = NULL,
    magic_rs_zone   = NULL,
    flow_type       = NULL;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;


-- ── Permissions ───────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON km_equity_monthly TO authenticated, kd_app, anon;
GRANT USAGE ON SEQUENCE km_equity_monthly_id_seq TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION aggregate_equity_monthly(DATE) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
