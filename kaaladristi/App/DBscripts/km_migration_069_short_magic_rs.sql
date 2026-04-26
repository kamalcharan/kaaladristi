-- Migration 069 · Short MagicRS + Zone Classification Fix
-- =========================================================
--
-- Two changes bundled:
--
-- 1. Zone vocabulary extended:
--    Old: Strong Bull / Mild Bull / Neutral / Mild Bear / Strong Bear
--    New: Strong Bull / Mild Bull / Neutral Bull / Neutral Bear / Mild Bear / Strong Bear
--    'Neutral' is split by direction — RS above MA → 'Neutral Bull', below → 'Neutral Bear'.
--    Thresholds remain 6.0 (Mild) and 9.0 (Strong).
--    Backfill UPDATE reclassifies all existing rows in km_equity_eod.
--
-- 2. Short MagicRS (21-day baseline) added alongside existing Long (144-day):
--    Same formula: rs = stock/CNX500, magic_rs = ((rs / sma(rs,period)) - 1) * 100
--    magic_ma = sma(magic_rs, period).  Long: period=144, Short: period=21.
--    compute_magic_rs_batch extended to compute both in one DB pass.
--    compute_all_magic_rs_short: new wrapper for backfill / catch-up.
--
-- Run order:
--   1. This file (DDL + function replacements + zone backfill)
--   2. Short RS backfill — run SEPARATELY (slow, ~30-60 min for 1,380 equities):
--        SELECT * FROM compute_all_magic_rs_short('km_equity_eod','equity_id',NULL,'2000-01-01');

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 1. Add short RS columns to km_equity_eod                   ║
-- ╚════════════════════════════════════════════════════════════╝

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS magic_rs_short      NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_short_ma   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_short_zone VARCHAR(20);

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 2. Replace compute_magic_rs_batch                          ║
-- ║    Computes Long (144-day) AND Short (21-day) in one pass. ║
-- ║    Minimum bars: 22 (short only) or 145 (both).            ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_magic_rs_batch(
  p_table        TEXT,
  p_id_col       TEXT,
  p_symbol_id    INT,
  p_benchmark_id INT,
  p_from_date    DATE DEFAULT NULL,
  p_bench_table  TEXT DEFAULT NULL,
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

  a_rs_ratio          FLOAT8[];

  -- Long MagicRS (144-day)
  a_rs_sma144         FLOAT8[];
  a_magic_rs          FLOAT8[];
  a_magic_ma          FLOAT8[];
  a_zone              TEXT[];

  -- Short MagicRS (21-day)
  a_rs_sma21          FLOAT8[];
  a_magic_rs_short    FLOAT8[];
  a_magic_rs_short_ma FLOAT8[];
  a_short_zone        TEXT[];

  v_sum       FLOAT8;
  v_cnt       INT;
  v_diff      FLOAT8;
  v_bench_idx INT;
  v_load_from DATE;
  start_idx   INT := 1;
  j           INT;
BEGIN
  IF p_from_date IS NOT NULL THEN
    v_load_from := p_from_date - INTERVAL '350 days';
  END IF;

  -- Load symbol closes
  IF v_load_from IS NOT NULL THEN
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND trade_date >= $2 AND close IS NOT NULL',
      p_table, p_id_col
    ) INTO a_date, a_close USING p_symbol_id, v_load_from;
  ELSE
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND close IS NOT NULL',
      p_table, p_id_col
    ) INTO a_date, a_close USING p_symbol_id;
  END IF;

  n := COALESCE(array_length(a_date, 1), 0);
  IF n < 22 THEN RETURN 0; END IF;

  -- Load benchmark closes
  IF v_load_from IS NOT NULL THEN
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND trade_date >= $2 AND close IS NOT NULL',
      v_bench_table, v_bench_id_col
    ) INTO b_date, b_close USING p_benchmark_id, v_load_from;
  ELSE
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(close ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND close IS NOT NULL',
      v_bench_table, v_bench_id_col
    ) INTO b_date, b_close USING p_benchmark_id;
  END IF;

  IF b_date IS NULL OR array_length(b_date, 1) < 10 THEN RETURN 0; END IF;

  -- RS ratio = symbol_close / benchmark_close (date-matched)
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

  -- ── Short MagicRS (21-day) ──────────────────────────────────────────────────

  -- SMA(21) of RS ratio
  a_rs_sma21 := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 21..n LOOP
    v_sum := 0; v_cnt := 0;
    FOR j IN (i-20)..i LOOP
      IF a_rs_ratio[j] IS NOT NULL THEN
        v_sum := v_sum + a_rs_ratio[j]; v_cnt := v_cnt + 1;
      END IF;
    END LOOP;
    IF v_cnt >= 18 THEN
      a_rs_sma21[i] := v_sum / v_cnt;
    END IF;
  END LOOP;

  -- Short MagicRS = ((RS / SMA21) - 1) * 100
  a_magic_rs_short := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_rs_ratio[i] IS NOT NULL AND a_rs_sma21[i] IS NOT NULL AND a_rs_sma21[i] > 0 THEN
      a_magic_rs_short[i] := ROUND((((a_rs_ratio[i] / a_rs_sma21[i]) - 1) * 100)::NUMERIC, 4);
    END IF;
  END LOOP;

  -- Short MagicMA = SMA(21) of Short MagicRS
  a_magic_rs_short_ma := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 41..n LOOP
    v_sum := 0; v_cnt := 0;
    FOR j IN (i-20)..i LOOP
      IF a_magic_rs_short[j] IS NOT NULL THEN
        v_sum := v_sum + a_magic_rs_short[j]; v_cnt := v_cnt + 1;
      END IF;
    END LOOP;
    IF v_cnt >= 15 THEN
      a_magic_rs_short_ma[i] := ROUND((v_sum / v_cnt)::NUMERIC, 4);
    END IF;
  END LOOP;

  -- Short zone (6.0 = Mild, 9.0 = Strong)
  a_short_zone := array_fill(NULL::TEXT, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_magic_rs_short[i] IS NOT NULL AND a_magic_rs_short_ma[i] IS NOT NULL THEN
      v_diff := a_magic_rs_short[i] - a_magic_rs_short_ma[i];
      IF    v_diff >  9.0 THEN a_short_zone[i] := 'Strong Bull';
      ELSIF v_diff >  6.0 THEN a_short_zone[i] := 'Mild Bull';
      ELSIF v_diff >  0   THEN a_short_zone[i] := 'Neutral Bull';
      ELSIF v_diff < -9.0 THEN a_short_zone[i] := 'Strong Bear';
      ELSIF v_diff < -6.0 THEN a_short_zone[i] := 'Mild Bear';
      ELSE                      a_short_zone[i] := 'Neutral Bear';
      END IF;
    END IF;
  END LOOP;

  -- ── Long MagicRS (144-day) — only when enough bars ─────────────────────────

  IF n >= 145 THEN
    -- SMA(144) of RS ratio
    a_rs_sma144 := array_fill(NULL::FLOAT8, ARRAY[n]);
    FOR i IN 144..n LOOP
      v_sum := 0; v_cnt := 0;
      FOR j IN (i-143)..i LOOP
        IF a_rs_ratio[j] IS NOT NULL THEN
          v_sum := v_sum + a_rs_ratio[j]; v_cnt := v_cnt + 1;
        END IF;
      END LOOP;
      IF v_cnt >= 100 THEN
        a_rs_sma144[i] := v_sum / v_cnt;
      END IF;
    END LOOP;

    -- Long MagicRS = ((RS / SMA144) - 1) * 100
    a_magic_rs := array_fill(NULL::FLOAT8, ARRAY[n]);
    FOR i IN 1..n LOOP
      IF a_rs_ratio[i] IS NOT NULL AND a_rs_sma144[i] IS NOT NULL AND a_rs_sma144[i] > 0 THEN
        a_magic_rs[i] := ROUND((((a_rs_ratio[i] / a_rs_sma144[i]) - 1) * 100)::NUMERIC, 4);
      END IF;
    END LOOP;

    -- Long MagicMA = SMA(60) of Long MagicRS
    a_magic_ma := array_fill(NULL::FLOAT8, ARRAY[n]);
    FOR i IN 60..n LOOP
      v_sum := 0; v_cnt := 0;
      FOR j IN (i-59)..i LOOP
        IF a_magic_rs[j] IS NOT NULL THEN
          v_sum := v_sum + a_magic_rs[j]; v_cnt := v_cnt + 1;
        END IF;
      END LOOP;
      IF v_cnt >= 40 THEN
        a_magic_ma[i] := ROUND((v_sum / v_cnt)::NUMERIC, 4);
      END IF;
    END LOOP;

    -- Long zone (6.0 = Mild, 9.0 = Strong)
    a_zone := array_fill(NULL::TEXT, ARRAY[n]);
    FOR i IN 1..n LOOP
      IF a_magic_rs[i] IS NOT NULL AND a_magic_ma[i] IS NOT NULL THEN
        v_diff := a_magic_rs[i] - a_magic_ma[i];
        IF    v_diff >  9.0 THEN a_zone[i] := 'Strong Bull';
        ELSIF v_diff >  6.0 THEN a_zone[i] := 'Mild Bull';
        ELSIF v_diff >  0   THEN a_zone[i] := 'Neutral Bull';
        ELSIF v_diff < -9.0 THEN a_zone[i] := 'Strong Bear';
        ELSIF v_diff < -6.0 THEN a_zone[i] := 'Mild Bear';
        ELSE                      a_zone[i] := 'Neutral Bear';
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Determine start index for update window
  IF p_from_date IS NOT NULL THEN
    FOR i IN 1..n LOOP
      IF a_date[i] >= p_from_date THEN start_idx := i; EXIT; END IF;
    END LOOP;
  END IF;

  -- Write rows: short RS always; long RS only when array is initialised (n >= 145)
  FOR i IN start_idx..n LOOP
    IF a_magic_rs_short[i] IS NOT NULL THEN
      IF a_magic_rs IS NOT NULL AND a_magic_rs[i] IS NOT NULL THEN
        EXECUTE format(
          'UPDATE %I SET
             magic_rs = $1, magic_rs_sma144 = $2, magic_ma = $3, magic_rs_zone = $4,
             magic_rs_short = $5, magic_rs_short_ma = $6, magic_rs_short_zone = $7
           WHERE %I = $8 AND trade_date = $9',
          p_table, p_id_col
        ) USING a_magic_rs[i], a_rs_sma144[i], a_magic_ma[i], a_zone[i],
                a_magic_rs_short[i], a_magic_rs_short_ma[i], a_short_zone[i],
                p_symbol_id, a_date[i];
      ELSE
        EXECUTE format(
          'UPDATE %I SET
             magic_rs_short = $1, magic_rs_short_ma = $2, magic_rs_short_zone = $3
           WHERE %I = $4 AND trade_date = $5',
          p_table, p_id_col
        ) USING a_magic_rs_short[i], a_magic_rs_short_ma[i], a_short_zone[i],
                p_symbol_id, a_date[i];
      END IF;
      updated := updated + 1;
    END IF;
  END LOOP;

  RETURN updated;
END;
$$;

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 3. compute_all_magic_rs_short — wrapper for short backfill ║
-- ║    Processes symbols where magic_rs_short_zone IS NULL.    ║
-- ║    Run with p_from_date = '2000-01-01' for full backfill.  ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_all_magic_rs_short(
  p_table         TEXT,
  p_id_col        TEXT,
  p_benchmark_id  INT  DEFAULT NULL,
  p_from_date     DATE DEFAULT NULL
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r              RECORD;
  v_benchmark    INT  := p_benchmark_id;
  v_from_date    DATE := p_from_date;
  v_bench_table  TEXT;
  v_bench_id_col TEXT;
BEGIN
  IF v_from_date IS NULL THEN
    RAISE EXCEPTION 'compute_all_magic_rs_short: p_from_date is required';
  END IF;

  IF v_benchmark IS NULL THEN
    SELECT id INTO v_benchmark FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1;
  END IF;
  IF v_benchmark IS NULL THEN
    RAISE NOTICE 'compute_all_magic_rs_short: NIFTY 500 not found in km_index_symbols';
    RETURN;
  END IF;

  IF p_table = 'km_index_eod' THEN
    v_bench_table  := NULL;
    v_bench_id_col := NULL;
  ELSE
    v_bench_table  := 'km_index_eod';
    v_bench_id_col := 'index_id';
  END IF;

  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I '
    'WHERE magic_rs_short_zone IS NULL AND trade_date >= $1 AND %I != $2',
    p_id_col, p_table, p_id_col
  ) USING v_from_date, v_benchmark LOOP
    symbol_id    := r.sid;
    rows_updated := compute_magic_rs_batch(
      p_table, p_id_col, r.sid, v_benchmark, v_from_date,
      v_bench_table, v_bench_id_col
    );
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 4. Zone reclassification backfill (fast bulk UPDATE)       ║
-- ║    Converts old 'Neutral' → 'Neutral Bull' / 'Neutral Bear'║
-- ║    Also normalises any rows where thresholds differ.        ║
-- ╚════════════════════════════════════════════════════════════╝

UPDATE km_equity_eod SET magic_rs_zone = (
  CASE
    WHEN magic_rs > magic_ma AND (magic_rs - magic_ma) > 9.0 THEN 'Strong Bull'
    WHEN magic_rs > magic_ma AND (magic_rs - magic_ma) > 6.0 THEN 'Mild Bull'
    WHEN magic_rs > magic_ma                                  THEN 'Neutral Bull'
    WHEN magic_rs < magic_ma AND (magic_ma - magic_rs) > 9.0 THEN 'Strong Bear'
    WHEN magic_rs < magic_ma AND (magic_ma - magic_rs) > 6.0 THEN 'Mild Bear'
    WHEN magic_rs IS NOT NULL AND magic_ma IS NOT NULL        THEN 'Neutral Bear'
    ELSE magic_rs_zone
  END
)
WHERE magic_rs IS NOT NULL AND magic_ma IS NOT NULL;

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 5. Permissions                                             ║
-- ╚════════════════════════════════════════════════════════════╝

GRANT EXECUTE ON FUNCTION compute_magic_rs_batch(TEXT, TEXT, INT, INT, DATE, TEXT, TEXT)
  TO authenticated, kd_app, anon;

GRANT EXECUTE ON FUNCTION compute_all_magic_rs_short(TEXT, TEXT, INT, DATE)
  TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

-- ╔════════════════════════════════════════════════════════════╗
-- ║ Short RS backfill — run SEPARATELY after this migration    ║
-- ║ (estimated 30-60 min for full equity universe)             ║
-- ╚════════════════════════════════════════════════════════════╝
-- SELECT symbol_id, rows_updated
-- FROM compute_all_magic_rs_short('km_equity_eod', 'equity_id', NULL, '2000-01-01');
