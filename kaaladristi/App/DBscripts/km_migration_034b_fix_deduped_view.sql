-- ============================================================
-- Migration 034b · Fix v_equity_eod_deduped for NULL isin
--
-- Bug: migration 034 created the view with WHERE s.isin IS NOT NULL.
-- If isin is not populated (column added in 024 but never seeded),
-- the view returns 0 rows → industry composites empty → 52 gaps.
--
-- Fix: Use COALESCE(isin, symbol||'_'||exchange) as dedup key.
-- Stocks with ISIN get NSE-preferred dedup across exchanges.
-- Stocks without ISIN keep their own row (no dedup needed since
-- they're unique per symbol+exchange).
-- ============================================================

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
  e.magic_rs, e.magic_ma, e.magic_rs_zone
FROM km_equity_eod e
JOIN km_equity_symbols s ON s.id = e.equity_id
WHERE s.is_active = true
  AND s.industry IS NOT NULL
  AND s.industry != 'Shell Companies'
ORDER BY COALESCE(s.isin, s.symbol || '_' || s.exchange), e.trade_date,
         CASE s.exchange WHEN 'NSE' THEN 1 WHEN 'BSE' THEN 2 ELSE 3 END;

-- Also fix the compute function to use dedup_key instead of isin for LAG
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
      d.dedup_key,
      d.trade_date,
      d.exchange,
      d.open, d.high, d.low, d.close, d.volume,
      d.rvol,
      d.magic_rs, d.magic_rs_zone,
      d.flow_type, d.accum_distrib,
      d.sniper_inst,
      d.volume_divergence_flag,
      LAG(d.close) OVER (PARTITION BY d.dedup_key ORDER BY d.trade_date) AS prev_close,
      d.industry
    FROM v_equity_eod_deduped d
    WHERE d.trade_date IN (SELECT trade_date FROM recent_dates)
  ),

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
    SELECT equity_id,
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
                  / NULLIF(COUNT(*), 0), 2)::FLOAT8 AS pct_volume_div_down
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
    nse_as_of_date, bse_as_of_date, nse_stock_count, bse_stock_count
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
    es.nse_as_of_date, es.bse_as_of_date, es.nse_stock_count, es.bse_stock_count
  FROM ranked r
  LEFT JOIN dominant_flow df ON df.industry = r.industry
  LEFT JOIN exchange_stats es ON es.industry = r.industry;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_all_industry_composites(DATE) TO authenticated, kd_app, anon;

-- Re-backfill last 60 days with the fixed view
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
