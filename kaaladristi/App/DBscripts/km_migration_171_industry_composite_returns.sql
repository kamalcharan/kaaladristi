-- ============================================================================
-- km_migration_171_industry_composite_returns.sql
-- ----------------------------------------------------------------------------
-- Industry Rotation — Phase 1: add per-industry average returns to the
-- composite so the UI can show the 5D/22D/66D momentum clock alongside the
-- Magic-RS structural clock.
--
-- Context: industryrotation.md (2026-07-14 spec, Phase 1). The current
-- `industry_rank` is ranked purely by `avg_magic_rs`, which behaves like a
-- ~22-day structural view and diverges from 5D returns by 80-150 rank
-- positions on live data. This migration is PURELY ADDITIVE — no ranking
-- change, no threshold change, no UI ranking change. It only makes the
-- return clock visible next to the RS clock so the Phase 2 ranking-basis
-- decision can be made from live evidence.
--
-- Changes:
--
--   1. `v_equity_eod_deduped` — append `ret_5d`, `ret_22d`, `ret_66d`
--      to the SELECT list. The columns already live on `km_equity_eod`
--      (migration 111). Appended at the END per the CREATE OR REPLACE VIEW
--      ordinal rule (CLAUDE.md D42 lesson) — inserting mid-list would
--      shift column names and fail.
--
--   2. `km_industry_eod` — add `avg_ret_5d`, `avg_ret_22d`, `avg_ret_66d`
--      NUMERIC columns, nullable. Existing rows get NULL for these until
--      the backfill (step 4) rewrites them.
--
--   3. `compute_all_industry_composites(p_trade_date)` — rewrite to also
--      compute AVG(ret_5d), AVG(ret_22d), AVG(ret_66d) in the
--      `industry_agg` CTE and INSERT them. The 5-stock-minimum filter and
--      Magic-RS-based `industry_rank` are unchanged.
--
--   4. Backfill: loop over the last 60 distinct trading dates and re-run
--      the RPC so IndustryTransitionView's 6-day rolling window has the
--      new return columns populated on day one — matches the pattern
--      migration 034 used when this table was first hardened.
--
-- Target DB: kaala_dristi_db.
-- ============================================================================

BEGIN;

-- ── 1. Update the deduped view (append return columns at the end) ───────────
CREATE OR REPLACE VIEW v_equity_eod_deduped AS
SELECT DISTINCT ON (COALESCE(s.isin, s.symbol || '_' || s.exchange), e.trade_date)
  COALESCE(s.isin, s.symbol || '_' || s.exchange) AS dedup_key,
  s.isin,
  e.equity_id,
  s.symbol,
  s.exchange,
  s.industry,
  s.company_name,
  s.is_fno,
  e.trade_date,
  e.open, e.high, e.low, e.close, e.prev_close, e.pct_chng, e.volume,
  e.rvol, e.tvol,
  e.rsi_14, e.mfi_14,
  e.rss_value, e.rss_spread,
  e.sma_150,
  e.sniper_inst, e.sniper_hot,
  e.flow_type, e.vacuum_flag, e.volume_divergence_flag,
  e.accum_distrib,
  e.magic_rs, e.magic_ma, e.magic_rs_zone,
  e.ema_20, e.sma_50,
  e.ret_5d, e.ret_22d, e.ret_66d          -- migration 171: expose returns
FROM km_equity_eod e
JOIN km_equity_symbols s ON s.id = e.equity_id
WHERE s.is_active = true
  AND s.industry IS NOT NULL
  AND s.industry != 'Shell Companies'
ORDER BY COALESCE(s.isin, s.symbol || '_' || s.exchange), e.trade_date,
         CASE s.exchange WHEN 'NSE' THEN 1 WHEN 'BSE' THEN 2 ELSE 3 END;

COMMENT ON VIEW v_equity_eod_deduped IS
  'One row per company (ISIN) per trade_date. NSE-preferred deduplication for dual-listed stocks. Includes ema_20/sma_50 (mig 117) + ret_5d/22d/66d (mig 171).';

GRANT SELECT ON v_equity_eod_deduped TO authenticated, anon, kd_app;

-- ── 2. Add return-average columns to the industry composite ─────────────────
ALTER TABLE km_industry_eod
  ADD COLUMN IF NOT EXISTS avg_ret_5d  NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS avg_ret_22d NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS avg_ret_66d NUMERIC(10, 4);

COMMENT ON COLUMN km_industry_eod.avg_ret_5d  IS 'AVG(km_equity_eod.ret_5d) across the industry constituents (mig 171 — Industry Rotation Phase 1).';
COMMENT ON COLUMN km_industry_eod.avg_ret_22d IS 'AVG(km_equity_eod.ret_22d) across the industry constituents (mig 171).';
COMMENT ON COLUMN km_industry_eod.avg_ret_66d IS 'AVG(km_equity_eod.ret_66d) across the industry constituents (mig 171).';

-- ── 3. Rewrite compute_all_industry_composites ──────────────────────────────
-- Structure unchanged vs migration 034: same CTEs (recent_dates, equity_window,
-- dot_signals, equity_dot_5d, current_day, flow_weighted, dominant_flow,
-- exchange_stats, industry_agg, ranked). Diffs vs migration 034:
--   - `equity_window` now pulls ret_5d/22d/66d from the view (mig 171 exposed them).
--   - `industry_agg` now also computes avg_ret_5d/22d/66d.
--   - INSERT list adds those three columns.
--   - `industry_rank` is still `RANK() OVER (ORDER BY avg_magic_rs DESC NULLS LAST)`
--     — Phase 1 is deliberately additive; the ranking-basis decision is Phase 2.
CREATE OR REPLACE FUNCTION compute_all_industry_composites(p_trade_date DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_inserted INT;
BEGIN
  DELETE FROM km_industry_eod WHERE trade_date = p_trade_date;

  WITH
  recent_dates AS (
    SELECT DISTINCT trade_date
    FROM v_equity_eod_deduped
    WHERE trade_date <= p_trade_date
    ORDER BY trade_date DESC
    LIMIT 6
  ),

  equity_window AS (
    SELECT
      d.equity_id,
      d.trade_date,
      d.exchange,
      d.open, d.high, d.low, d.close, d.volume,
      d.rvol,
      d.magic_rs, d.magic_rs_zone,
      d.flow_type, d.accum_distrib,
      d.sniper_inst,
      d.volume_divergence_flag,
      d.ret_5d, d.ret_22d, d.ret_66d,          -- migration 171
      LAG(d.close) OVER (PARTITION BY d.isin ORDER BY d.trade_date) AS prev_close,
      d.industry
    FROM v_equity_eod_deduped d
    WHERE d.trade_date IN (SELECT trade_date FROM recent_dates)
  ),

  -- ┌─────────────────────────────────────────────────────────────┐
  -- │  CANONICAL DOT SIGNAL DEFINITIONS (SQL copy)               │
  -- │  Source of truth: visualPulseEngine.ts  computeDots()       │
  -- │  Also in: scanEngine.ts  hasDotInHistory()                  │
  -- │  If you change a threshold here, change it there too.       │
  -- │                                                             │
  -- │  SVD: rvol>10, close>mid, close>prev*1.02, body≥50%, bull  │
  -- │  SBD: rvol 3-10, bull, upper third, body≥45%               │
  -- │  SYD: close<prev, rvol≥2, lower third                      │
  -- └─────────────────────────────────────────────────────────────┘
  dot_signals AS (
    SELECT
      equity_id, trade_date,
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

  equity_dot_5d AS (
    SELECT
      equity_id,
      BOOL_OR(is_svd) AS has_recent_svd,
      BOOL_OR(is_sbd) AS has_recent_sbd,
      BOOL_OR(is_syd) AS has_recent_syd
    FROM dot_signals
    GROUP BY equity_id
  ),

  current_day AS (
    SELECT * FROM equity_window WHERE trade_date = p_trade_date
  ),

  flow_weighted AS (
    SELECT industry, flow_type,
           SUM(COALESCE(rvol, 1)) AS total_weight
    FROM current_day
    WHERE flow_type IS NOT NULL
    GROUP BY industry, flow_type
  ),
  dominant_flow AS (
    SELECT DISTINCT ON (industry) industry, flow_type AS dominant_flow_type
    FROM flow_weighted
    ORDER BY industry, total_weight DESC
  ),

  exchange_stats AS (
    SELECT
      cd.industry,
      MAX(cd.trade_date) FILTER (WHERE cd.exchange = 'NSE') AS nse_as_of_date,
      MAX(cd.trade_date) FILTER (WHERE cd.exchange = 'BSE') AS bse_as_of_date,
      COUNT(*) FILTER (WHERE cd.exchange = 'NSE') AS nse_stock_count,
      COUNT(*) FILTER (WHERE cd.exchange = 'BSE') AS bse_stock_count
    FROM current_day cd
    GROUP BY cd.industry
  ),

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
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_volume_div_down,
      -- migration 171: return averages. NUMERIC(10,4) matches the ALTER;
      -- ROUND to 4dp keeps trailing 0s aligned when serialized.
      ROUND(AVG(cd.ret_5d)::NUMERIC,  4) AS avg_ret_5d,
      ROUND(AVG(cd.ret_22d)::NUMERIC, 4) AS avg_ret_22d,
      ROUND(AVG(cd.ret_66d)::NUMERIC, 4) AS avg_ret_66d
    FROM current_day cd
    LEFT JOIN equity_dot_5d d5 ON d5.equity_id = cd.equity_id
    GROUP BY cd.industry
    HAVING COUNT(*) >= 5
  ),

  ranked AS (
    SELECT ia.*,
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
    industry_rank,
    nse_as_of_date, bse_as_of_date, nse_stock_count, bse_stock_count,
    avg_ret_5d, avg_ret_22d, avg_ret_66d           -- migration 171
  )
  SELECT
    p_trade_date,
    r.industry, r.stock_count,
    r.avg_magic_rs, r.pct_strong_bull, r.pct_strong_bear,
    r.pct_accumulation, r.pct_distribution,
    df.dominant_flow_type, r.avg_sniper_inst,
    r.pct_with_recent_svd, r.pct_with_recent_sbd, r.pct_with_recent_syd,
    r.pct_volume_div_up, r.pct_volume_div_down,
    r.industry_rank,
    es.nse_as_of_date, es.bse_as_of_date, es.nse_stock_count, es.bse_stock_count,
    r.avg_ret_5d, r.avg_ret_22d, r.avg_ret_66d
  FROM ranked r
  LEFT JOIN dominant_flow df ON df.industry = r.industry
  LEFT JOIN exchange_stats es ON es.industry = r.industry;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_all_industry_composites(DATE) TO authenticated, kd_app, anon;

-- ── 4. Backfill the last 60 trading dates so the 6-day rolling window
--       consumed by IndustryTransitionView reads populated return columns
--       from day one. Mirrors migration 034's backfill.
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

COMMIT;
