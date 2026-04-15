-- ============================================================
-- Migration 037 · Fix OBV BIGINT overflow in indicator RPC
--
-- Root cause: obv column is BIGINT on km_equity_eod (millions
-- of rows, too large to ALTER TYPE). The RPC computes OBV as
-- FLOAT8, then ROUND(::NUMERIC, 2) produces a decimal like
-- 60000000000.00 which BIGINT rejects.
--
-- Fix: cast obv to BIGINT in the UPDATE statement inside
-- compute_indicators_batch. OBV is a cumulative integer by
-- definition (sum of volumes) — no precision loss.
--
-- Also fix km_index_eod.obv (small table, ALTER is instant).
-- ============================================================

-- ── Fix km_index_eod.obv directly (small table) ──────────────
ALTER TABLE km_index_eod ALTER COLUMN obv TYPE FLOAT8;


-- ── Patch compute_indicators_batch: cast obv to BIGINT ────────
-- We replace the entire function to change obv=$14 → obv=$14::BIGINT
-- Everything else is identical to migration 032.

CREATE OR REPLACE FUNCTION compute_indicators_batch(
  p_table TEXT,
  p_id_col TEXT,
  p_symbol_id INT,
  p_from_date DATE DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  n INT;
  i INT;
  updated INT := 0;

  -- Arrays for OHLCV
  a_date DATE[];
  a_open FLOAT8[];
  a_high FLOAT8[];
  a_low FLOAT8[];
  a_close FLOAT8[];
  a_volume FLOAT8[];
  a_prev_close FLOAT8[];

  -- Indicator arrays
  a_sma_8 FLOAT8[];    a_sma_21 FLOAT8[];   a_sma_50 FLOAT8[];
  a_sma_55 FLOAT8[];   a_sma_89 FLOAT8[];   a_sma_150 FLOAT8[];
  a_sma_200 FLOAT8[];  a_sma_233 FLOAT8[];
  a_sma_10 FLOAT8[];   a_sma_40 FLOAT8[];

  a_rsi_14 FLOAT8[];   a_rsi_9 FLOAT8[];
  a_mfi_14 FLOAT8[];
  a_atr_10 FLOAT8[];   a_atr_14 FLOAT8[];
  a_st FLOAT8[];       a_st_dir FLOAT8[];
  a_obv FLOAT8[];      a_obv_sma FLOAT8[];
  a_rvol FLOAT8[];     a_tvol FLOAT8[];

  a_pp FLOAT8[];  a_r1 FLOAT8[];  a_r2 FLOAT8[];  a_r3 FLOAT8[];
  a_s1 FLOAT8[];  a_s2 FLOAT8[];  a_s3 FLOAT8[];

  -- Sniper Dragon
  a_sniper_inst FLOAT8[];  a_sniper_hot FLOAT8[];  a_sniper_rsi FLOAT8[];
  -- RSS
  a_rss_spread FLOAT8[];  a_rss_value FLOAT8[];

  -- Temp vars
  v_gain FLOAT8[];  v_loss FLOAT8[];
  v_tp FLOAT8[];    v_mf FLOAT8[];
  v_tr FLOAT8[];
  v_sum FLOAT8;     v_cnt INT;
  v_delta FLOAT8;
  v_upper FLOAT8;   v_lower FLOAT8;  v_hl2 FLOAT8;
  v_obv_val FLOAT8;

  -- MFI temp vars
  j INT;
  v_pos_mf FLOAT8;
  v_neg_mf FLOAT8;

  -- Data load window
  v_load_from DATE;

BEGIN
  -- ── Determine load window ──
  IF p_from_date IS NOT NULL THEN
    v_load_from := p_from_date - INTERVAL '300 days';
  END IF;

  -- ── Load OHLCV data into arrays ──
  IF v_load_from IS NOT NULL THEN
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(open ORDER BY trade_date),
              array_agg(high ORDER BY trade_date),
              array_agg(low ORDER BY trade_date),
              array_agg(close ORDER BY trade_date),
              array_agg(COALESCE(volume,0) ORDER BY trade_date)
       FROM %I WHERE %I = $1 AND trade_date >= $2',
      p_table, p_id_col
    ) INTO a_date, a_open, a_high, a_low, a_close, a_volume
    USING p_symbol_id, v_load_from;
  ELSE
    EXECUTE format(
      'SELECT array_agg(trade_date ORDER BY trade_date),
              array_agg(open ORDER BY trade_date),
              array_agg(high ORDER BY trade_date),
              array_agg(low ORDER BY trade_date),
              array_agg(close ORDER BY trade_date),
              array_agg(COALESCE(volume,0) ORDER BY trade_date)
       FROM %I WHERE %I = $1',
      p_table, p_id_col
    ) INTO a_date, a_open, a_high, a_low, a_close, a_volume
    USING p_symbol_id;
  END IF;

  n := COALESCE(array_length(a_date, 1), 0);
  IF n < 2 THEN RETURN 0; END IF;

  -- ── SMAs ──
  a_sma_8   := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_10  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_21  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_40  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_50  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_55  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_89  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_150 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_200 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sma_233 := array_fill(NULL::FLOAT8, ARRAY[n]);

  FOR i IN 1..n LOOP
    IF i >= 8 THEN
      v_sum := 0; FOR v_cnt IN (i-7)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_8[i] := ROUND((v_sum / 8)::NUMERIC, 2);
    END IF;
    IF i >= 10 THEN
      v_sum := 0; FOR v_cnt IN (i-9)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_10[i] := ROUND((v_sum / 10)::NUMERIC, 2);
    END IF;
    IF i >= 21 THEN
      v_sum := 0; FOR v_cnt IN (i-20)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_21[i] := ROUND((v_sum / 21)::NUMERIC, 2);
    END IF;
    IF i >= 40 THEN
      v_sum := 0; FOR v_cnt IN (i-39)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_40[i] := ROUND((v_sum / 40)::NUMERIC, 2);
    END IF;
    IF i >= 50 THEN
      v_sum := 0; FOR v_cnt IN (i-49)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_50[i] := ROUND((v_sum / 50)::NUMERIC, 2);
    END IF;
    IF i >= 55 THEN
      v_sum := 0; FOR v_cnt IN (i-54)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_55[i] := ROUND((v_sum / 55)::NUMERIC, 2);
    END IF;
    IF i >= 89 THEN
      v_sum := 0; FOR v_cnt IN (i-88)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_89[i] := ROUND((v_sum / 89)::NUMERIC, 2);
    END IF;
    IF i >= 150 THEN
      v_sum := 0; FOR v_cnt IN (i-149)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_150[i] := ROUND((v_sum / 150)::NUMERIC, 2);
    END IF;
    IF i >= 200 THEN
      v_sum := 0; FOR v_cnt IN (i-199)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_200[i] := ROUND((v_sum / 200)::NUMERIC, 2);
    END IF;
    IF i >= 233 THEN
      v_sum := 0; FOR v_cnt IN (i-232)..i LOOP v_sum := v_sum + a_close[v_cnt]; END LOOP;
      a_sma_233[i] := ROUND((v_sum / 233)::NUMERIC, 2);
    END IF;
  END LOOP;

  -- ── RSI (Wilder's smoothing) ──
  v_gain := array_fill(0::FLOAT8, ARRAY[n]);
  v_loss := array_fill(0::FLOAT8, ARRAY[n]);
  FOR i IN 2..n LOOP
    v_delta := a_close[i] - a_close[i-1];
    IF v_delta > 0 THEN v_gain[i] := v_delta; ELSE v_loss[i] := -v_delta; END IF;
  END LOOP;

  DECLARE
    ag14 FLOAT8[] := _wilder_ema(v_gain, 14);
    al14 FLOAT8[] := _wilder_ema(v_loss, 14);
    ag9  FLOAT8[] := _wilder_ema(v_gain, 9);
    al9  FLOAT8[] := _wilder_ema(v_loss, 9);
  BEGIN
    a_rsi_14 := array_fill(NULL::FLOAT8, ARRAY[n]);
    a_rsi_9  := array_fill(NULL::FLOAT8, ARRAY[n]);
    FOR i IN 1..n LOOP
      IF ag14[i] IS NOT NULL AND al14[i] IS NOT NULL AND al14[i] > 0 THEN
        a_rsi_14[i] := ROUND((100 - 100 / (1 + ag14[i] / al14[i]))::NUMERIC, 2);
      END IF;
      IF ag9[i] IS NOT NULL AND al9[i] IS NOT NULL AND al9[i] > 0 THEN
        a_rsi_9[i] := ROUND((100 - 100 / (1 + ag9[i] / al9[i]))::NUMERIC, 2);
      END IF;
    END LOOP;
  END;

  -- ── MFI-14 (Money Flow Index) ──
  v_tp := array_fill(NULL::FLOAT8, ARRAY[n]);
  v_mf := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_mfi_14 := array_fill(NULL::FLOAT8, ARRAY[n]);

  FOR i IN 1..n LOOP
    v_tp[i] := (a_high[i] + a_low[i] + a_close[i]) / 3.0;
    v_mf[i] := v_tp[i] * a_volume[i];
  END LOOP;

  FOR i IN 15..n LOOP
    v_pos_mf := 0;
    v_neg_mf := 0;
    FOR j IN (i-13)..i LOOP
      IF v_tp[j] IS NOT NULL AND v_tp[j-1] IS NOT NULL THEN
        IF v_tp[j] > v_tp[j-1] THEN
          v_pos_mf := v_pos_mf + v_mf[j];
        ELSIF v_tp[j] < v_tp[j-1] THEN
          v_neg_mf := v_neg_mf + v_mf[j];
        END IF;
      END IF;
    END LOOP;

    IF v_neg_mf > 0 THEN
      a_mfi_14[i] := ROUND((100.0 - 100.0 / (1.0 + v_pos_mf / v_neg_mf))::NUMERIC, 2);
    ELSIF v_pos_mf > 0 THEN
      a_mfi_14[i] := 100.0;
    END IF;
  END LOOP;

  -- ── ATR (Wilder's smoothing) ──
  v_tr := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 2..n LOOP
    v_tr[i] := GREATEST(
      a_high[i] - a_low[i],
      ABS(a_high[i] - a_close[i-1]),
      ABS(a_low[i] - a_close[i-1])
    );
  END LOOP;
  a_atr_10 := _wilder_ema(v_tr, 10);
  a_atr_14 := _wilder_ema(v_tr, 14);

  -- ── Pivots (previous day OHLC) ──
  a_pp := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_r1 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_r2 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_r3 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_s1 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_s2 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_s3 := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 2..n LOOP
    a_pp[i] := ROUND(((a_high[i-1] + a_low[i-1] + a_close[i-1]) / 3)::NUMERIC, 2);
    a_r1[i] := ROUND((2 * a_pp[i] - a_low[i-1])::NUMERIC, 2);
    a_s1[i] := ROUND((2 * a_pp[i] - a_high[i-1])::NUMERIC, 2);
    a_r2[i] := ROUND((a_pp[i] + (a_high[i-1] - a_low[i-1]))::NUMERIC, 2);
    a_s2[i] := ROUND((a_pp[i] - (a_high[i-1] - a_low[i-1]))::NUMERIC, 2);
    a_r3[i] := ROUND((a_high[i-1] + 2 * (a_pp[i] - a_low[i-1]))::NUMERIC, 2);
    a_s3[i] := ROUND((a_low[i-1] - 2 * (a_high[i-1] - a_pp[i]))::NUMERIC, 2);
  END LOOP;

  -- ── OBV + OBV SMA(20) ──
  a_obv := array_fill(0::FLOAT8, ARRAY[n]);
  v_obv_val := 0;
  FOR i IN 2..n LOOP
    IF a_close[i] > a_close[i-1] THEN v_obv_val := v_obv_val + a_volume[i];
    ELSIF a_close[i] < a_close[i-1] THEN v_obv_val := v_obv_val - a_volume[i];
    END IF;
    a_obv[i] := v_obv_val;
  END LOOP;
  a_obv_sma := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 20..n LOOP
    v_sum := 0; FOR v_cnt IN (i-19)..i LOOP v_sum := v_sum + a_obv[v_cnt]; END LOOP;
    a_obv_sma[i] := ROUND((v_sum / 20)::NUMERIC, 2);
  END LOOP;

  -- ── RVol + TVol ──
  a_rvol := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_tvol := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 50..n LOOP
    v_sum := 0; FOR v_cnt IN (i-49)..i LOOP v_sum := v_sum + a_volume[v_cnt]; END LOOP;
    IF v_sum > 0 THEN a_rvol[i] := ROUND((a_volume[i] / (v_sum / 50))::NUMERIC, 4); END IF;
  END LOOP;
  FOR i IN 20..n LOOP
    v_sum := 0; FOR v_cnt IN (i-19)..i LOOP v_sum := v_sum + a_volume[v_cnt]; END LOOP;
    IF v_sum > 0 THEN a_tvol[i] := ROUND((a_volume[i] / (v_sum / 20))::NUMERIC, 4); END IF;
  END LOOP;

  -- ── Sniper Dragon (uses RSI arrays already computed) ──
  a_sniper_inst := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sniper_hot  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sniper_rsi  := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_rsi_9[i] IS NOT NULL THEN
      a_sniper_inst[i] := ROUND(LEAST(50, GREATEST(0, 1.5 * (a_rsi_9[i] - 61)))::NUMERIC, 4);
      a_sniper_rsi[i] := ROUND((a_rsi_9[i] / 2)::NUMERIC, 4);
    END IF;
  END LOOP;
  FOR i IN 1..n LOOP
    IF a_rsi_9[i] IS NOT NULL THEN
      a_sniper_hot[i] := ROUND(LEAST(50, GREATEST(0, 1.0 * (a_rsi_9[i] - 15)))::NUMERIC, 4);
    END IF;
  END LOOP;

  -- ── RSS (Relative Strength Spread) ──
  a_rss_spread := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_rss_value  := array_fill(NULL::FLOAT8, ARRAY[n]);

  FOR i IN 40..n LOOP
    IF a_sma_10[i] IS NOT NULL AND a_sma_40[i] IS NOT NULL THEN
      a_rss_spread[i] := ROUND((a_sma_10[i] - a_sma_40[i])::NUMERIC, 4);
    END IF;
  END LOOP;

  DECLARE
    v_sp_gain FLOAT8[] := array_fill(NULL::FLOAT8, ARRAY[n]);
    v_sp_loss FLOAT8[] := array_fill(NULL::FLOAT8, ARRAY[n]);
    v_sg5 FLOAT8[];
    v_sl5 FLOAT8[];
    a_rss_raw FLOAT8[] := array_fill(NULL::FLOAT8, ARRAY[n]);
  BEGIN
    FOR i IN 41..n LOOP
      IF a_rss_spread[i] IS NOT NULL AND a_rss_spread[i-1] IS NOT NULL THEN
        v_delta := a_rss_spread[i] - a_rss_spread[i-1];
        IF v_delta > 0 THEN
          v_sp_gain[i] := v_delta;
          v_sp_loss[i] := 0;
        ELSE
          v_sp_gain[i] := 0;
          IF v_delta < 0 THEN v_sp_loss[i] := -v_delta; ELSE v_sp_loss[i] := 0; END IF;
        END IF;
      END IF;
    END LOOP;

    v_sg5 := _wilder_ema(v_sp_gain, 5);
    v_sl5 := _wilder_ema(v_sp_loss, 5);

    FOR i IN 1..n LOOP
      IF v_sg5[i] IS NOT NULL AND v_sl5[i] IS NOT NULL AND v_sl5[i] > 0 THEN
        a_rss_raw[i] := 100 - 100 / (1 + v_sg5[i] / v_sl5[i]);
      ELSIF v_sg5[i] IS NOT NULL AND v_sl5[i] IS NOT NULL AND v_sg5[i] > 0 THEN
        a_rss_raw[i] := 100;
      END IF;
    END LOOP;

    FOR i IN 3..n LOOP
      IF a_rss_raw[i] IS NOT NULL AND a_rss_raw[i-1] IS NOT NULL AND a_rss_raw[i-2] IS NOT NULL THEN
        a_rss_value[i] := ROUND(((a_rss_raw[i] + a_rss_raw[i-1] + a_rss_raw[i-2]) / 3)::NUMERIC, 2);
      END IF;
    END LOOP;
  END;

  -- ── Batch UPDATE ──
  -- NOTE: obv is cast to BIGINT because km_equity_eod.obv is BIGINT
  -- and the table is too large to ALTER TYPE. km_index_eod.obv was
  -- already altered to FLOAT8 in this migration.
  DECLARE
    start_idx INT := 1;
    v_obv_safe BIGINT;
  BEGIN
    IF p_from_date IS NOT NULL THEN
      FOR i IN 1..n LOOP
        IF a_date[i] >= p_from_date THEN start_idx := i; EXIT; END IF;
      END LOOP;
    END IF;

    FOR i IN start_idx..n LOOP
      -- Safely cast OBV to BIGINT (truncate decimals from FLOAT8)
      IF a_obv[i] IS NOT NULL THEN
        v_obv_safe := TRUNC(a_obv[i])::BIGINT;
      ELSE
        v_obv_safe := NULL;
      END IF;

      EXECUTE format(
        'UPDATE %I SET
          sma_8=$1, sma_21=$2, sma_50=$3, sma_55=$4, sma_89=$5, sma_150=$6, sma_200=$7, sma_233=$8,
          rsi_14=$9, rsi_9=$10,
          mfi_14=$11,
          atr_10=$12, atr_14=$13,
          obv=$14, obv_sma_20=$15,
          rvol=$16, tvol=$17,
          pivot_pp=$18, pivot_r1=$19, pivot_r2=$20, pivot_r3=$21,
          pivot_s1=$22, pivot_s2=$23, pivot_s3=$24,
          sniper_inst=$25, sniper_hot=$26, sniper_rsi=$27,
          sma_10=$28, sma_40=$29, rss_spread=$30, rss_value=$31,
          indicators_computed_at=NOW()
        WHERE %I=$32 AND trade_date=$33 AND indicators_computed_at IS NULL',
        p_table, p_id_col
      ) USING
        a_sma_8[i], a_sma_21[i], a_sma_50[i], a_sma_55[i], a_sma_89[i], a_sma_150[i], a_sma_200[i], a_sma_233[i],
        a_rsi_14[i], a_rsi_9[i],
        a_mfi_14[i],
        a_atr_10[i], a_atr_14[i],
        v_obv_safe, a_obv_sma[i],
        a_rvol[i], a_tvol[i],
        a_pp[i], a_r1[i], a_r2[i], a_r3[i],
        a_s1[i], a_s2[i], a_s3[i],
        a_sniper_inst[i], a_sniper_hot[i], a_sniper_rsi[i],
        a_sma_10[i], a_sma_40[i], a_rss_spread[i], a_rss_value[i],
        p_symbol_id, a_date[i];

      updated := updated + 1;
    END LOOP;
  END;

  RETURN updated;
END;
$$;


-- ── Unchanged: compute_all_pending_indicators wrapper ─────────
CREATE OR REPLACE FUNCTION compute_all_pending_indicators(
  p_table TEXT DEFAULT 'km_index_eod',
  p_id_col TEXT DEFAULT 'index_id'
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  v_from_date DATE := CURRENT_DATE - INTERVAL '90 days';
BEGIN
  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I WHERE indicators_computed_at IS NULL AND trade_date >= $1',
    p_id_col, p_table
  ) USING v_from_date LOOP
    symbol_id := r.sid;
    rows_updated := compute_indicators_batch(p_table, p_id_col, r.sid, v_from_date);
    RETURN NEXT;
  END LOOP;
END;
$$;
