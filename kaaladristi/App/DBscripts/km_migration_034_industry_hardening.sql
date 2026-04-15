-- ============================================================
-- Migration 034 · Industry Rotation Hardening
--
-- 1. Patch compute_magic_rs_batch — accept benchmark table params
--    so equity MagicRS can use km_index_eod (NIFTY 500) as benchmark
-- 2. Patch compute_all_magic_rs — remove IF p_table guard
-- 3. Create v_equity_eod_deduped — one row per ISIN per date
-- 4. Add per-exchange as-of columns to km_industry_eod
-- 5. Rewrite compute_all_industry_composites to use deduped view
-- 6. 60-day backfill
-- ============================================================


-- ╔════════════════════════════════════════════════════════════╗
-- ║  1. Patch compute_magic_rs_batch                          ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_magic_rs_batch(
  p_table TEXT,
  p_id_col TEXT,
  p_symbol_id INT,
  p_benchmark_id INT,
  p_from_date DATE DEFAULT NULL,
  p_bench_table TEXT DEFAULT NULL,
  p_bench_id_col TEXT DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  n INT;
  i INT;
  updated INT := 0;

  v_bench_table  TEXT := COALESCE(p_bench_table, p_table);
  v_bench_id_col TEXT := COALESCE(p_bench_id_col, p_id_col);

  a_date   DATE[];
  a_close  FLOAT8[];
  b_date   DATE[];
  b_close  FLOAT8[];

  a_rs_ratio  FLOAT8[];
  a_rs_sma144 FLOAT8[];
  a_magic_rs  FLOAT8[];
  a_magic_ma  FLOAT8[];
  a_zone      TEXT[];

  v_sum       FLOAT8;
  v_cnt       INT;
  v_diff      FLOAT8;
  v_threshold FLOAT8 := 6.0;
  v_bench_idx INT;
  v_load_from DATE;
  start_idx   INT := 1;
  j           INT;

BEGIN
  IF p_from_date IS NOT NULL THEN
    v_load_from := p_from_date - INTERVAL '350 days';
  END IF;

  -- Load symbol close prices
  IF v_load_from IS NOT NULL THEN
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND trade_date >= $2 AND close IS NOT NULL',
      p_table, p_id_col
    ) INTO a_date, a_close
    USING p_symbol_id, v_load_from;
  ELSE
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND close IS NOT NULL',
      p_table, p_id_col
    ) INTO a_date, a_close
    USING p_symbol_id;
  END IF;

  n := COALESCE(array_length(a_date, 1), 0);
  IF n < 145 THEN RETURN 0; END IF;

  -- Load benchmark close prices (may come from a different table)
  IF v_load_from IS NOT NULL THEN
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND trade_date >= $2 AND close IS NOT NULL',
      v_bench_table, v_bench_id_col
    ) INTO b_date, b_close
    USING p_benchmark_id, v_load_from;
  ELSE
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND close IS NOT NULL',
      v_bench_table, v_bench_id_col
    ) INTO b_date, b_close
    USING p_benchmark_id;
  END IF;

  IF b_date IS NULL OR array_length(b_date, 1) < 10 THEN
    RETURN 0;
  END IF;

  -- Build RS ratio (symbol_close / benchmark_close, matched by date)
  a_rs_ratio := array_fill(NULL::FLOAT8, ARRAY[n]);
  v_bench_idx := 1;

  FOR i IN 1..n LOOP
    WHILE v_bench_idx <= array_length(b_date, 1) AND b_date[v_bench_idx] < a_date[i] LOOP
      v_bench_idx := v_bench_idx + 1;
    END LOOP;
    IF v_bench_idx <= array_length(b_date, 1)
       AND b_date[v_bench_idx] = a_date[i]
       AND b_close[v_bench_idx] > 0 THEN
      a_rs_ratio[i] := a_close[i] / b_close[v_bench_idx];
    END IF;
  END LOOP;

  -- SMA(144) of RS ratio
  a_rs_sma144 := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 144..n LOOP
    v_sum := 0; v_cnt := 0;
    FOR j IN (i-143)..i LOOP
      IF a_rs_ratio[j] IS NOT NULL THEN
        v_sum := v_sum + a_rs_ratio[j];
        v_cnt := v_cnt + 1;
      END IF;
    END LOOP;
    IF v_cnt >= 100 THEN
      a_rs_sma144[i] := v_sum / v_cnt;
    END IF;
  END LOOP;

  -- MagicRS = ((RS / SMA144) - 1) * 100
  a_magic_rs := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_rs_ratio[i] IS NOT NULL AND a_rs_sma144[i] IS NOT NULL AND a_rs_sma144[i] > 0 THEN
      a_magic_rs[i] := ROUND((((a_rs_ratio[i] / a_rs_sma144[i]) - 1) * 100)::NUMERIC, 4);
    END IF;
  END LOOP;

  -- MagicMA = SMA(60) of MagicRS
  a_magic_ma := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 60..n LOOP
    v_sum := 0; v_cnt := 0;
    FOR j IN (i-59)..i LOOP
      IF a_magic_rs[j] IS NOT NULL THEN
        v_sum := v_sum + a_magic_rs[j];
        v_cnt := v_cnt + 1;
      END IF;
    END LOOP;
    IF v_cnt >= 40 THEN
      a_magic_ma[i] := ROUND((v_sum / v_cnt)::NUMERIC, 4);
    END IF;
  END LOOP;

  -- Zone classification
  a_zone := array_fill(NULL::TEXT, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_magic_rs[i] IS NOT NULL AND a_magic_ma[i] IS NOT NULL THEN
      v_diff := ABS(a_magic_rs[i] - a_magic_ma[i]);
      IF a_magic_rs[i] > a_magic_ma[i] THEN
        IF v_diff > v_threshold * 1.5 THEN a_zone[i] := 'Strong Bull';
        ELSIF v_diff > v_threshold THEN a_zone[i] := 'Mild Bull';
        ELSE a_zone[i] := 'Neutral';
        END IF;
      ELSE
        IF v_diff > v_threshold * 1.5 THEN a_zone[i] := 'Strong Bear';
        ELSIF v_diff > v_threshold THEN a_zone[i] := 'Mild Bear';
        ELSE a_zone[i] := 'Neutral';
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- UPDATE only rows that need it
  IF p_from_date IS NOT NULL THEN
    FOR i IN 1..n LOOP
      IF a_date[i] >= p_from_date THEN start_idx := i; EXIT; END IF;
    END LOOP;
  END IF;

  FOR i IN start_idx..n LOOP
    IF a_magic_rs[i] IS NOT NULL THEN
      EXECUTE format(
        'UPDATE %I SET magic_rs = $1, magic_rs_sma144 = $2, magic_ma = $3, magic_rs_zone = $4
         WHERE %I = $5 AND trade_date = $6',
        p_table, p_id_col
      ) USING a_magic_rs[i], a_rs_sma144[i], a_magic_ma[i], a_zone[i],
              p_symbol_id, a_date[i];
      updated := updated + 1;
    END IF;
  END LOOP;

  RETURN updated;
END;
$$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  2. Patch compute_all_magic_rs — remove table guard       ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_all_magic_rs(
  p_table TEXT DEFAULT 'km_index_eod',
  p_id_col TEXT DEFAULT 'index_id',
  p_benchmark_id INT DEFAULT NULL
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  v_benchmark INT := p_benchmark_id;
  v_from_date DATE := CURRENT_DATE - INTERVAL '90 days';
  v_bench_table TEXT;
  v_bench_id_col TEXT;
BEGIN
  -- Auto-detect benchmark: always find NIFTY 500 from km_index_symbols
  IF v_benchmark IS NULL THEN
    SELECT id INTO v_benchmark FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1;
  END IF;

  IF v_benchmark IS NULL THEN
    RAISE NOTICE 'No benchmark found (NIFTY 500 not in km_index_symbols)';
    RETURN;
  END IF;

  -- Benchmark always comes from km_index_eod, regardless of p_table
  IF p_table = 'km_index_eod' THEN
    v_bench_table := NULL;   -- same table, defaults handled by batch fn
    v_bench_id_col := NULL;
  ELSE
    v_bench_table := 'km_index_eod';
    v_bench_id_col := 'index_id';
  END IF;

  -- Process symbols with missing magic_rs in recent dates
  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I WHERE magic_rs_zone IS NULL AND trade_date >= $1 AND %I != $2',
    p_id_col, p_table, p_id_col
  ) USING v_from_date, v_benchmark LOOP
    symbol_id := r.sid;
    rows_updated := compute_magic_rs_batch(
      p_table, p_id_col, r.sid, v_benchmark, v_from_date,
      v_bench_table, v_bench_id_col
    );
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  3. Deduped equity view                                   ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW v_equity_eod_deduped AS
SELECT DISTINCT ON (s.isin, e.trade_date)
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
  AND s.isin IS NOT NULL
  AND s.industry IS NOT NULL
  AND s.industry != 'Shell Companies'
ORDER BY s.isin, e.trade_date,
         CASE s.exchange WHEN 'NSE' THEN 1 WHEN 'BSE' THEN 2 ELSE 3 END;

COMMENT ON VIEW v_equity_eod_deduped IS
  'One row per company (ISIN) per trade_date. NSE-preferred deduplication for dual-listed stocks.';

GRANT SELECT ON v_equity_eod_deduped TO authenticated, anon, kd_app;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  4. Add per-exchange as-of columns                        ║
-- ╚════════════════════════════════════════════════════════════╝

ALTER TABLE km_industry_eod
  ADD COLUMN IF NOT EXISTS nse_as_of_date   DATE,
  ADD COLUMN IF NOT EXISTS bse_as_of_date   DATE,
  ADD COLUMN IF NOT EXISTS nse_stock_count  INT,
  ADD COLUMN IF NOT EXISTS bse_stock_count  INT;

COMMENT ON COLUMN km_industry_eod.nse_as_of_date IS 'MAX trade_date of NSE stocks used in this row';
COMMENT ON COLUMN km_industry_eod.bse_as_of_date IS 'MAX trade_date of BSE stocks used in this row';


-- ╔════════════════════════════════════════════════════════════╗
-- ║  5. Rewrite compute_all_industry_composites               ║
-- ║     Uses v_equity_eod_deduped for stable stock universe   ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_all_industry_composites(p_trade_date DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_inserted INT;
BEGIN
  DELETE FROM km_industry_eod WHERE trade_date = p_trade_date;

  WITH
  -- Last 6 distinct trading dates (5 lookback + current)
  recent_dates AS (
    SELECT DISTINCT trade_date
    FROM v_equity_eod_deduped
    WHERE trade_date <= p_trade_date
    ORDER BY trade_date DESC
    LIMIT 6
  ),

  -- Deduped equity data with prev_close via LAG
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

  -- Dominant flow type per industry (RVOL-weighted mode)
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

  -- Per-exchange as-of tracking
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


-- ── Permissions ────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION compute_magic_rs_batch(TEXT, TEXT, INT, INT, DATE, TEXT, TEXT) TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_magic_rs(TEXT, TEXT, INT) TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_industry_composites(DATE) TO authenticated, kd_app, anon;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  6. Re-backfill km_industry_eod with deduped data         ║
-- ╚════════════════════════════════════════════════════════════╝

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
