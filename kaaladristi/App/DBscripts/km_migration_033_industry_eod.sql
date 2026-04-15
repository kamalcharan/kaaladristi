-- ============================================================
-- Migration 033 · Industry EOD Aggregation
--
-- New table: km_industry_eod
-- Aggregates per-industry daily composites from km_equity_eod
-- joined with km_equity_symbols on equity_id → industry.
--
-- Columns:
--   stock_count, avg_magic_rs, pct_strong_bull, pct_strong_bear,
--   pct_accumulation, pct_distribution, dominant_flow_type,
--   avg_sniper_inst, pct_with_recent_svd, pct_with_recent_sbd,
--   pct_with_recent_syd, pct_volume_div_up, pct_volume_div_down,
--   industry_rank
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  CANONICAL DOT SIGNAL DEFINITIONS (SQL copy)               │
-- │  Source of truth: visualPulseEngine.ts  computeDots()       │
-- │  This SQL is a deliberate performance copy — NOT a fork.    │
-- │  If you change a threshold here, change it there too.       │
-- │                                                             │
-- │  SVD  (Strong Volume Drive)                                 │
-- │    rvol > 10                                                │
-- │    AND close > (high + low) / 2            — above midpoint │
-- │    AND close > prev_close * 1.02           — 2 % gap-up     │
-- │    AND abs(close − open) / (high − low) ≥ 0.5  — body ≥ 50%│
-- │    AND close > open                        — bullish candle  │
-- │                                                             │
-- │  SBD  (Smart Buy Day / Accumulation Signature)              │
-- │    rvol ≥ 3  AND  rvol < 10                                 │
-- │    AND close > open                        — bullish         │
-- │    AND close > high − (high − low) / 3     — upper third    │
-- │    AND abs(close − open) / (high − low) ≥ 0.45             │
-- │                                                             │
-- │  SYD  (Sell Yellow Day / Distribution Signal)               │
-- │    close < prev_close                      — down day        │
-- │    AND rvol ≥ 2                                              │
-- │    AND close < low + (high − low) / 3      — lower third    │
-- └─────────────────────────────────────────────────────────────┘
--
-- Filter: stock_count >= 5, exclude 'Shell Companies'
-- Called after compute_all_flow_intelligence() in daily pipeline.
-- ============================================================

-- ── Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS km_industry_eod (
    trade_date            DATE NOT NULL,
    industry              TEXT NOT NULL,
    stock_count           INT NOT NULL,
    avg_magic_rs          FLOAT8,
    pct_strong_bull       FLOAT8,
    pct_strong_bear       FLOAT8,
    pct_accumulation      FLOAT8,
    pct_distribution      FLOAT8,
    dominant_flow_type    TEXT,
    avg_sniper_inst       FLOAT8,
    pct_with_recent_svd   FLOAT8,
    pct_with_recent_sbd   FLOAT8,
    pct_with_recent_syd   FLOAT8,
    pct_volume_div_up     FLOAT8,
    pct_volume_div_down   FLOAT8,
    industry_rank         INT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (trade_date, industry)
);

CREATE INDEX IF NOT EXISTS idx_industry_eod_date
  ON km_industry_eod(trade_date);
CREATE INDEX IF NOT EXISTS idx_industry_eod_rank
  ON km_industry_eod(trade_date, industry_rank);

COMMENT ON TABLE km_industry_eod IS
  'Daily industry-level aggregation from km_equity_eod × km_equity_symbols. One row per industry per trading day.';
COMMENT ON COLUMN km_industry_eod.industry_rank IS
  'Rank by avg_magic_rs DESC within the same trade_date. 1 = strongest industry.';
COMMENT ON COLUMN km_industry_eod.dominant_flow_type IS
  'Mode of flow_type across industry stocks, weighted by RVOL.';
COMMENT ON COLUMN km_industry_eod.pct_with_recent_svd IS
  '% of stocks with SVD (Strong Volume Drive) in last 5 trading bars.';
COMMENT ON COLUMN km_industry_eod.pct_with_recent_sbd IS
  '% of stocks with SBD (Smart Buy Day / Accumulation Signature) in last 5 trading bars.';
COMMENT ON COLUMN km_industry_eod.pct_with_recent_syd IS
  '% of stocks with SYD (Sell Yellow Day / Distribution Signal) in last 5 trading bars.';


-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE km_industry_eod ENABLE ROW LEVEL SECURITY;

CREATE POLICY "industry_eod_read" ON km_industry_eod
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "industry_eod_admin_write" ON km_industry_eod
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── Compute Function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_all_industry_composites(p_trade_date DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_inserted INT;
BEGIN
  -- Delete existing data for this date (idempotent re-run)
  DELETE FROM km_industry_eod WHERE trade_date = p_trade_date;

  -- ── Main insert via CTEs ──
  WITH
  -- Get last 6 distinct trading dates up to p_trade_date (5 lookback + current)
  recent_dates AS (
    SELECT DISTINCT trade_date
    FROM km_equity_eod
    WHERE trade_date <= p_trade_date
    ORDER BY trade_date DESC
    LIMIT 6
  ),

  -- Equity EOD data for recent dates, with prev_close via LAG
  equity_window AS (
    SELECT
      e.equity_id,
      e.trade_date,
      e.open, e.high, e.low, e.close, e.volume,
      e.rvol,
      e.magic_rs, e.magic_rs_zone,
      e.flow_type, e.accum_distrib,
      e.sniper_inst,
      e.volume_divergence_flag,
      LAG(e.close) OVER (PARTITION BY e.equity_id ORDER BY e.trade_date) AS prev_close,
      s.industry
    FROM km_equity_eod e
    JOIN km_equity_symbols s ON s.id = e.equity_id
    WHERE e.trade_date IN (SELECT trade_date FROM recent_dates)
      AND s.industry IS NOT NULL
      AND s.industry != 'Shell Companies'
      AND COALESCE(s.is_active, true) = true
  ),

  -- Compute DOT signals per equity-date row
  -- SVD: rvol>10, close>mid, close>prevClose*1.02, bodyRatio>=0.5, bullish
  -- SBD: rvol 3-10, bullish, close in upper third, bodyRatio>=0.45
  -- SYD: close<prevClose, rvol>=2, close in lower third
  dot_signals AS (
    SELECT
      equity_id,
      trade_date,
      CASE WHEN
        COALESCE(rvol, 0) > 10
        AND (high + low) > 0 AND close > (high + low) / 2.0
        AND prev_close IS NOT NULL AND prev_close > 0 AND close > prev_close * 1.02
        AND (high - low) > 0 AND ABS(close - open) / (high - low) >= 0.5
        AND close > open
      THEN TRUE ELSE FALSE END AS is_svd,

      CASE WHEN
        COALESCE(rvol, 0) >= 3 AND COALESCE(rvol, 0) < 10
        AND close > open
        AND (high - low) > 0
        AND close > high - (high - low) / 3.0
        AND ABS(close - open) / (high - low) >= 0.45
      THEN TRUE ELSE FALSE END AS is_sbd,

      CASE WHEN
        prev_close IS NOT NULL AND close < prev_close
        AND COALESCE(rvol, 0) >= 2
        AND (high - low) > 0
        AND close < low + (high - low) / 3.0
      THEN TRUE ELSE FALSE END AS is_syd
    FROM equity_window
  ),

  -- Per equity: did SVD, SBD, or SYD fire in any of the last 5 bars?
  equity_dot_5d AS (
    SELECT
      equity_id,
      BOOL_OR(is_svd) AS has_recent_svd,
      BOOL_OR(is_sbd) AS has_recent_sbd,
      BOOL_OR(is_syd) AS has_recent_syd
    FROM dot_signals
    GROUP BY equity_id
  ),

  -- Current-day data only (for main aggregation)
  current_day AS (
    SELECT * FROM equity_window WHERE trade_date = p_trade_date
  ),

  -- Dominant flow type per industry: mode of flow_type weighted by RVOL
  flow_weighted AS (
    SELECT
      industry,
      flow_type,
      SUM(COALESCE(rvol, 1)) AS total_weight
    FROM current_day
    WHERE flow_type IS NOT NULL
    GROUP BY industry, flow_type
  ),
  dominant_flow AS (
    SELECT DISTINCT ON (industry)
      industry,
      flow_type AS dominant_flow_type
    FROM flow_weighted
    ORDER BY industry, total_weight DESC
  ),

  -- Main industry aggregation
  industry_agg AS (
    SELECT
      cd.industry,
      COUNT(*)::INT AS stock_count,
      ROUND(AVG(cd.magic_rs)::NUMERIC, 2)::FLOAT8 AS avg_magic_rs,
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.magic_rs_zone = 'Strong Bull')
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_strong_bull,
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.magic_rs_zone = 'Strong Bear')
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_strong_bear,
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.accum_distrib = 'ACCUMULATION')
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_accumulation,
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.accum_distrib = 'DISTRIBUTION')
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_distribution,
      ROUND(AVG(cd.sniper_inst)::NUMERIC, 2)::FLOAT8 AS avg_sniper_inst,
      ROUND(100.0 * COUNT(*) FILTER (WHERE d5.has_recent_svd)
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_with_recent_svd,
      ROUND(100.0 * COUNT(*) FILTER (WHERE d5.has_recent_sbd)
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_with_recent_sbd,
      ROUND(100.0 * COUNT(*) FILTER (WHERE d5.has_recent_syd)
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_with_recent_syd,
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.volume_divergence_flag = 'VOLUME_DIV_UP')
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_volume_div_up,
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.volume_divergence_flag = 'VOLUME_DIV_DOWN')
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_volume_div_down
    FROM current_day cd
    LEFT JOIN equity_dot_5d d5 ON d5.equity_id = cd.equity_id
    GROUP BY cd.industry
    HAVING COUNT(*) >= 5
  ),

  -- Rank industries by avg_magic_rs descending
  ranked AS (
    SELECT
      ia.*,
      RANK() OVER (ORDER BY ia.avg_magic_rs DESC NULLS LAST)::INT AS industry_rank
    FROM industry_agg ia
  )

  INSERT INTO km_industry_eod (
    trade_date, industry, stock_count,
    avg_magic_rs, pct_strong_bull, pct_strong_bear,
    pct_accumulation, pct_distribution,
    dominant_flow_type, avg_sniper_inst,
    pct_with_recent_svd, pct_with_recent_sbd, pct_with_recent_syd,
    pct_volume_div_up, pct_volume_div_down,
    industry_rank
  )
  SELECT
    p_trade_date,
    r.industry, r.stock_count,
    r.avg_magic_rs, r.pct_strong_bull, r.pct_strong_bear,
    r.pct_accumulation, r.pct_distribution,
    df.dominant_flow_type, r.avg_sniper_inst,
    r.pct_with_recent_svd, r.pct_with_recent_sbd, r.pct_with_recent_syd,
    r.pct_volume_div_up, r.pct_volume_div_down,
    r.industry_rank
  FROM ranked r
  LEFT JOIN dominant_flow df ON df.industry = r.industry;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;


-- ── Permissions ────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION compute_all_industry_composites(DATE) TO authenticated, kd_app, anon;
GRANT SELECT ON km_industry_eod TO authenticated, anon;
GRANT ALL ON km_industry_eod TO kd_app;


-- ── Backfill: last 60 trading days ────────────────────────────
DO $$
DECLARE
  d DATE;
  n INT;
BEGIN
  FOR d IN
    SELECT DISTINCT trade_date
    FROM km_equity_eod
    ORDER BY trade_date DESC
    LIMIT 60
  LOOP
    n := compute_all_industry_composites(d);
    RAISE NOTICE 'Industry composites for %: % industries', d, n;
  END LOOP;
END;
$$;


NOTIFY pgrst, 'reload schema';
