-- ============================================================
-- Migration 075 · km_equity_weekly Table + Aggregate RPC
--
-- Weekly OHLCV + indicator aggregate for equities.
-- week_start = ISO Monday (DATE_TRUNC('week', trade_date)).
--
-- Column set mirrors km_equity_eod so that the existing
-- compute_all_pending_indicators, compute_all_magic_rs, and
-- compute_all_flow_intelligence RPCs can be called against
-- this table unchanged (all three are table-parameterised).
--
-- Pipeline call order after EOD completes on Friday:
--   1. aggregate_equity_weekly(trade_date)
--   2. compute_all_pending_indicators('km_equity_weekly', 'equity_id')
--   3. compute_all_magic_rs('km_equity_weekly', 'equity_id')
--   4. compute_all_flow_intelligence('km_equity_weekly', 'equity_id')
-- ============================================================

BEGIN;

-- ── Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS km_equity_weekly (
  id           BIGSERIAL PRIMARY KEY,
  equity_id    INT         NOT NULL REFERENCES km_equity_symbols(id),
  week_start   DATE        NOT NULL,   -- ISO Monday
  week_end     DATE        NOT NULL,   -- Last trading day of that week (Friday or earlier)
  trade_date   DATE,                   -- = week_end; satisfies table-parameterised RPCs

  -- OHLCV aggregated from daily rows
  open         NUMERIC,
  high         NUMERIC,
  low          NUMERIC,
  close        NUMERIC,                -- close of week_end day
  volume       BIGINT,
  total_value  NUMERIC,               -- sum of traded value across the week
  bar_count    INT,                   -- number of trading days in this bar

  -- Delivery (sum of weekly delivery)
  deliv_qty         BIGINT,
  deliv_value_cr    NUMERIC,
  avg_deliv_pct     NUMERIC,          -- average delivery % across days

  -- Return columns (weekly close vs prior closes)
  ret_5d       NUMERIC,               -- 5-week return (5 × weekly bars back)
  ret_22d      NUMERIC,               -- 22-week return (~5 months)
  ret_66d      NUMERIC,               -- 66-week return (~15 months)

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
      'Strong Bull', 'Mild Bull', 'Neutral Bull',
      'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
    )),

  -- Flow intelligence columns (written by compute_flow_intelligence)
  flow_type    TEXT,
  vacuum_flag  BOOLEAN,
  accum_distrib TEXT,

  -- 52-week high/low (rolling from daily data)
  w52_high     NUMERIC,
  w52_low      NUMERIC,

  UNIQUE (equity_id, week_start)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_equity_weekly_equity_week
  ON km_equity_weekly(equity_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_equity_weekly_week_start
  ON km_equity_weekly(week_start DESC);

CREATE INDEX IF NOT EXISTS idx_equity_weekly_pending_indicators
  ON km_equity_weekly(equity_id)
  WHERE indicators_computed_at IS NULL;

-- ── RPC: aggregate one week ───────────────────────────────────
-- Upserts one row per equity from km_equity_eod for the ISO week
-- containing p_trade_date. Safe to call on any day of the week
-- (will aggregate whatever days are present).

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
    v_week_start                           AS week_start,
    MAX(e.trade_date)                      AS week_end,
    MAX(e.trade_date)                      AS trade_date,
    -- OHLCV
    (ARRAY_AGG(e.open  ORDER BY e.trade_date))[1]    AS open,
    MAX(e.high)                            AS high,
    MIN(e.low)                             AS low,
    (ARRAY_AGG(e.close ORDER BY e.trade_date DESC))[1] AS close,
    SUM(e.volume)::BIGINT                  AS volume,
    SUM(e.value_cr)                        AS total_value,
    COUNT(*)::INT                          AS bar_count,
    -- Delivery (deliv_value_cr is not stored; computed as delivery_qty*close/1e7)
    SUM(e.delivery_qty)::BIGINT            AS deliv_qty,
    SUM(e.delivery_qty * e.close / 10000000.0) AS deliv_value_cr,
    AVG(e.delivery_pct)                    AS avg_deliv_pct,
    -- 52-week high/low (rolling year from daily data)
    MAX(e.w52_high)                        AS w52_high,
    MIN(e.w52_low)                         AS w52_low
  FROM km_equity_eod e
  WHERE e.trade_date >= v_week_start
    AND e.trade_date <  v_week_start + INTERVAL '7 days'
    AND e.close IS NOT NULL
  GROUP BY e.equity_id
  ON CONFLICT (equity_id, week_start) DO UPDATE SET
    week_end              = EXCLUDED.week_end,
    trade_date            = EXCLUDED.trade_date,
    open            = EXCLUDED.open,
    high            = EXCLUDED.high,
    low             = EXCLUDED.low,
    close           = EXCLUDED.close,
    volume          = EXCLUDED.volume,
    total_value     = EXCLUDED.total_value,
    bar_count       = EXCLUDED.bar_count,
    deliv_qty         = EXCLUDED.deliv_qty,
    deliv_value_cr    = EXCLUDED.deliv_value_cr,
    avg_deliv_pct     = EXCLUDED.avg_deliv_pct,
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

GRANT SELECT, INSERT, UPDATE ON km_equity_weekly TO authenticated, kd_app, anon;
GRANT USAGE ON SEQUENCE km_equity_weekly_id_seq TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION aggregate_equity_weekly(DATE) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
