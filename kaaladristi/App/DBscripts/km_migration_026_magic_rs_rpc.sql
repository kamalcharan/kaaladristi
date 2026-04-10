-- ============================================================
-- Migration 026 · MagicRS SQL RPC
-- Computes MagicRS (relative strength vs benchmark) entirely in SQL.
-- Previously required Python — now runs in PostgreSQL directly.
--
-- Formula (from LuckyPop SuperMagic PineScript):
--   RS_ratio = close(symbol) / close(benchmark)
--   MagicRS  = ((RS_ratio / SMA(RS_ratio, 144)) - 1) * 100
--   MagicMA  = SMA(MagicRS, 60)
--   Zone:
--     diff = ABS(MagicRS - MagicMA)
--     threshold = 6.0 (base, adaptive not implemented in SQL)
--     Strong Bull: MagicRS > MagicMA AND diff > threshold * 1.5
--     Mild Bull:   MagicRS > MagicMA AND diff > threshold
--     Strong Bear: MagicRS < MagicMA AND diff > threshold * 1.5
--     Mild Bear:   MagicRS < MagicMA AND diff > threshold
--     Neutral:     otherwise
-- ============================================================

CREATE OR REPLACE FUNCTION compute_magic_rs_batch(
  p_table TEXT,
  p_id_col TEXT,
  p_symbol_id INT,
  p_benchmark_id INT,
  p_from_date DATE DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  n INT;
  i INT;
  updated INT := 0;

  -- Symbol arrays
  a_date   DATE[];
  a_close  FLOAT8[];

  -- Benchmark arrays (indexed by date)
  b_date   DATE[];
  b_close  FLOAT8[];

  -- Computed arrays
  a_rs_ratio  FLOAT8[];
  a_rs_sma144 FLOAT8[];
  a_magic_rs  FLOAT8[];
  a_magic_ma  FLOAT8[];
  a_zone      TEXT[];

  -- Working vars
  v_sum       FLOAT8;
  v_cnt       INT;
  v_diff      FLOAT8;
  v_threshold FLOAT8 := 6.0;
  v_bench_idx INT;
  v_load_from DATE;
  start_idx   INT := 1;

BEGIN
  -- Need 144+60 = 204 periods of lookback for MagicRS + MagicMA
  IF p_from_date IS NOT NULL THEN
    v_load_from := p_from_date - INTERVAL '350 days';
  END IF;

  -- ── Load symbol close prices ──
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
  IF n < 145 THEN RETURN 0; END IF;  -- Need at least 144+1 for SMA

  -- ── Load benchmark close prices ──
  IF v_load_from IS NOT NULL THEN
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND trade_date >= $2 AND close IS NOT NULL',
      p_table, p_id_col
    ) INTO b_date, b_close
    USING p_benchmark_id, v_load_from;
  ELSE
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND close IS NOT NULL',
      p_table, p_id_col
    ) INTO b_date, b_close
    USING p_benchmark_id;
  END IF;

  IF b_date IS NULL OR array_length(b_date, 1) < 10 THEN
    RETURN 0;  -- No benchmark data
  END IF;

  -- ── Build RS ratio (symbol_close / benchmark_close, matched by date) ──
  a_rs_ratio := array_fill(NULL::FLOAT8, ARRAY[n]);
  v_bench_idx := 1;

  FOR i IN 1..n LOOP
    -- Advance benchmark index to match date
    WHILE v_bench_idx <= array_length(b_date, 1) AND b_date[v_bench_idx] < a_date[i] LOOP
      v_bench_idx := v_bench_idx + 1;
    END LOOP;

    IF v_bench_idx <= array_length(b_date, 1)
       AND b_date[v_bench_idx] = a_date[i]
       AND b_close[v_bench_idx] > 0 THEN
      a_rs_ratio[i] := a_close[i] / b_close[v_bench_idx];
    END IF;
  END LOOP;

  -- ── SMA(144) of RS ratio ──
  a_rs_sma144 := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 144..n LOOP
    v_sum := 0; v_cnt := 0;
    FOR j IN (i-143)..i LOOP
      IF a_rs_ratio[j] IS NOT NULL THEN
        v_sum := v_sum + a_rs_ratio[j];
        v_cnt := v_cnt + 1;
      END IF;
    END LOOP;
    IF v_cnt >= 100 THEN  -- Need at least 100 valid values
      a_rs_sma144[i] := v_sum / v_cnt;
    END IF;
  END LOOP;

  -- ── MagicRS = ((RS / SMA144) - 1) * 100 ──
  a_magic_rs := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_rs_ratio[i] IS NOT NULL AND a_rs_sma144[i] IS NOT NULL AND a_rs_sma144[i] > 0 THEN
      a_magic_rs[i] := ROUND((((a_rs_ratio[i] / a_rs_sma144[i]) - 1) * 100)::NUMERIC, 4);
    END IF;
  END LOOP;

  -- ── MagicMA = SMA(60) of MagicRS ──
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

  -- ── Zone classification ──
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

  -- ── UPDATE only rows that need it ──
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


-- ── Convenience: compute MagicRS for all symbols vs a benchmark ──
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
BEGIN
  -- Auto-detect benchmark: find NIFTY 500 ID
  IF v_benchmark IS NULL THEN
    IF p_table = 'km_index_eod' THEN
      SELECT id INTO v_benchmark FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1;
    END IF;
  END IF;

  IF v_benchmark IS NULL THEN
    RAISE NOTICE 'No benchmark found';
    RETURN;
  END IF;

  -- Process symbols with missing magic_rs in recent dates
  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I WHERE magic_rs_zone IS NULL AND trade_date >= $1 AND %I != $2',
    p_id_col, p_table, p_id_col
  ) USING v_from_date, v_benchmark LOOP
    symbol_id := r.sid;
    rows_updated := compute_magic_rs_batch(p_table, p_id_col, r.sid, v_benchmark, v_from_date);
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ── Permissions ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION compute_magic_rs_batch(TEXT, TEXT, INT, INT, DATE) TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_magic_rs(TEXT, TEXT, INT) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
