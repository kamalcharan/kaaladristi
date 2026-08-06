-- ============================================================================
-- Migration 169 — cadence-aware warm-up for the indicator + MagicRS batches
-- Target DB: kaala_dristi_db
-- ============================================================================
--
-- PROBLEM
-- -------
-- compute_indicators_batch and compute_magic_rs_batch both size their warm-up
-- window in CALENDAR DAYS:
--
--     v_load_from := p_from_date - INTERVAL '300 days';   -- indicators
--     v_load_from := p_from_date - INTERVAL '350 days';   -- magic_rs
--
-- That is right for km_equity_eod (300 calendar days ~ 205 trading bars), but
-- both functions are also called on km_equity_weekly and km_equity_monthly by
-- pipeline/compute/_indicator_chain.py. There the same window loads:
--
--     weekly   ~43 bars   (300 days / 7)
--     monthly  ~10 bars   (300 days / 30)
--
-- Every indicator loop is gated on bar count (IF i >= 50, IF i >= 20, Wilder-14
-- needs 15), so they silently write NULL. Worse, compute_indicators_batch still
-- stamps indicators_computed_at = NOW() on those rows, so the row looks done.
--
-- Observed after the 2026-08-06 weekly/monthly backfill (--from 2026-05-01):
--
--     km_equity_monthly 2026-05..07 : rsi_14 0/3257, ema_20 0/3257, sma_50 0/3257
--     km_equity_weekly  2026-04-27+ : ema_20 ~1150/3264 (old symbols only)
--
-- RELIANCE and TCS both hold all 80 monthly bars and have correct indicators
-- through 2026-04, then NULL for 05/06/07 — so this is not a young-listing
-- warm-up effect, it is the loader window.
--
-- compute_magic_rs_batch fails harder because of its bar-count gates:
--   - long MagicRS is inside IF n >= 145  -> weekly (n~50) never computes it,
--     which is why km_equity_weekly.magic_rs is 0 across the backfilled range
--   - IF n < 22 THEN RETURN 0            -> monthly (n~11) returns before
--     writing anything at all, which is why km_equity_monthly.magic_rs has
--     ALWAYS been NULL, including months long predating this backfill
--
-- FIX
-- ---
-- Size the warm-up by the table's bar cadence instead of assuming daily.
-- Weekly gets 2100 days (300 weeks) — comfortably past the longest window
-- either function needs (sma_233 = 233 bars; magic_rs = 144 + 60 SMA = 204).
-- Monthly loads full history: at ~80 bars per symbol that is trivial, and any
-- window short of full history starves it.
--
-- KNOWN LIMIT, NOT FIXED HERE
-- ---------------------------
-- Monthly long MagicRS needs 145 monthly bars = ~12 years. The deepest symbol
-- has 80 periods, so km_equity_monthly.magic_rs stays NULL no matter how large
-- the warm-up is. After this migration monthly gets magic_rs_short (21-period,
-- needs n >= 22) and leaves the 144-period column NULL. That is the correct
-- outcome — the alternative is a 144-period average built from 80 points.
--
-- Only the warm-up block changes in each function. Everything else below is a
-- verbatim reproduction of the currently deployed body.
-- ============================================================================

DO $mig169_guard$
BEGIN
  IF current_database() <> 'kaala_dristi_db' THEN
    RAISE EXCEPTION
      'Migration 169 targets kaala_dristi_db, but you are connected to %. Reconnect and re-run.',
      current_database();
  END IF;
END
$mig169_guard$;


-- ============================================================================
-- 1. compute_indicators_batch — cadence-aware warm-up
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_indicators_batch(
  p_table text, p_id_col text, p_symbol_id integer, p_from_date date DEFAULT NULL::date
)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  n INT;
  i INT;
  updated INT := 0;

  a_date  DATE[];
  a_open  FLOAT8[];
  a_high  FLOAT8[];
  a_low   FLOAT8[];
  a_close FLOAT8[];
  a_volume FLOAT8[];

  a_sma_8   FLOAT8[];  a_sma_21  FLOAT8[];  a_sma_50  FLOAT8[];
  a_sma_55  FLOAT8[];  a_sma_89  FLOAT8[];  a_sma_150 FLOAT8[];
  a_sma_200 FLOAT8[];  a_sma_233 FLOAT8[];
  a_sma_10  FLOAT8[];  a_sma_40  FLOAT8[];

  a_rsi_14 FLOAT8[];  a_rsi_9  FLOAT8[];
  a_mfi_14 FLOAT8[];
  a_atr_10 FLOAT8[];  a_atr_14 FLOAT8[];
  a_obv    FLOAT8[];  a_obv_sma FLOAT8[];
  a_rvol   FLOAT8[];  a_tvol   FLOAT8[];
  a_pp FLOAT8[];  a_r1 FLOAT8[];  a_r2 FLOAT8[];  a_r3 FLOAT8[];
  a_s1 FLOAT8[];  a_s2 FLOAT8[];  a_s3 FLOAT8[];
  a_sniper_inst FLOAT8[];  a_sniper_hot FLOAT8[];  a_sniper_rsi FLOAT8[];
  a_rss_spread  FLOAT8[];  a_rss_value  FLOAT8[];

  -- NEW: EMA arrays
  a_ema_20 FLOAT8[];  a_ema_60 FLOAT8[];
  v_ema20  FLOAT8;    v_ema60  FLOAT8;

  v_gain FLOAT8[];  v_loss FLOAT8[];
  v_tp   FLOAT8[];  v_mf   FLOAT8[];
  v_tr   FLOAT8[];
  v_sum  FLOAT8;    v_cnt  INT;
  v_delta FLOAT8;
  v_obv_val FLOAT8;
  j INT;
  v_pos_mf FLOAT8;
  v_neg_mf FLOAT8;
  v_load_from DATE;

BEGIN
  -- ── Warm-up window, sized by the table's bar cadence (migration 169) ──
  -- A fixed calendar window assumes daily bars. On the weekly/monthly tables
  -- that loaded ~43 / ~10 bars, below every indicator's minimum, so the loops
  -- wrote NULL while indicators_computed_at was still stamped.
  IF p_from_date IS NOT NULL THEN
    IF right(p_table, 8) = '_monthly' THEN
      v_load_from := NULL;                                  -- full history (~80 bars)
    ELSIF right(p_table, 7) = '_weekly' THEN
      v_load_from := p_from_date - INTERVAL '2100 days';     -- 300 weeks
    ELSE
      v_load_from := p_from_date - INTERVAL '300 days';      -- daily, unchanged
    END IF;
  END IF;

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

  -- ── EMA(20) and EMA(60) — standard exponential (k = 2/(n+1)) ──
  -- Seed value: SMA of first N bars. Single pass accumulates v_sum
  -- so when i=20 it equals sum(close[1..20]) and when i=60 it equals
  -- sum(close[1..60]) — both correct seeds.
  a_ema_20 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_ema_60 := array_fill(NULL::FLOAT8, ARRAY[n]);
  v_ema20  := NULL;
  v_ema60  := NULL;
  v_sum    := 0;
  FOR i IN 1..n LOOP
    v_sum := v_sum + a_close[i];
    IF i = 20 THEN
      v_ema20      := v_sum / 20.0;
      a_ema_20[i]  := ROUND(v_ema20::NUMERIC, 2);
    ELSIF i > 20 AND v_ema20 IS NOT NULL THEN
      v_ema20      := a_close[i] * (2.0 / 21.0) + v_ema20 * (19.0 / 21.0);
      a_ema_20[i]  := ROUND(v_ema20::NUMERIC, 2);
    END IF;
    IF i = 60 THEN
      v_ema60      := v_sum / 60.0;
      a_ema_60[i]  := ROUND(v_ema60::NUMERIC, 2);
    ELSIF i > 60 AND v_ema60 IS NOT NULL THEN
      v_ema60      := a_close[i] * (2.0 / 61.0) + v_ema60 * (59.0 / 61.0);
      a_ema_60[i]  := ROUND(v_ema60::NUMERIC, 2);
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

  -- ── MFI-14 ──
  v_tp     := array_fill(NULL::FLOAT8, ARRAY[n]);
  v_mf     := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_mfi_14 := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 1..n LOOP
    v_tp[i] := (a_high[i] + a_low[i] + a_close[i]) / 3.0;
    v_mf[i] := v_tp[i] * a_volume[i];
  END LOOP;
  FOR i IN 15..n LOOP
    v_pos_mf := 0; v_neg_mf := 0;
    FOR j IN (i-13)..i LOOP
      IF v_tp[j] IS NOT NULL AND v_tp[j-1] IS NOT NULL THEN
        IF v_tp[j] > v_tp[j-1] THEN v_pos_mf := v_pos_mf + v_mf[j];
        ELSIF v_tp[j] < v_tp[j-1] THEN v_neg_mf := v_neg_mf + v_mf[j]; END IF;
      END IF;
    END LOOP;
    IF v_neg_mf > 0 THEN
      a_mfi_14[i] := ROUND((100.0 - 100.0 / (1.0 + v_pos_mf / v_neg_mf))::NUMERIC, 2);
    ELSIF v_pos_mf > 0 THEN a_mfi_14[i] := 100.0; END IF;
  END LOOP;

  -- ── ATR (Wilder's) ──
  v_tr := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 2..n LOOP
    v_tr[i] := GREATEST(a_high[i] - a_low[i], ABS(a_high[i] - a_close[i-1]), ABS(a_low[i] - a_close[i-1]));
  END LOOP;
  a_atr_10 := _wilder_ema(v_tr, 10);
  a_atr_14 := _wilder_ema(v_tr, 14);

  -- ── Pivots ──
  a_pp := array_fill(NULL::FLOAT8, ARRAY[n]);  a_r1 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_r2 := array_fill(NULL::FLOAT8, ARRAY[n]);  a_r3 := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_s1 := array_fill(NULL::FLOAT8, ARRAY[n]);  a_s2 := array_fill(NULL::FLOAT8, ARRAY[n]);
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
    IF    a_close[i] > a_close[i-1] THEN v_obv_val := v_obv_val + a_volume[i];
    ELSIF a_close[i] < a_close[i-1] THEN v_obv_val := v_obv_val - a_volume[i]; END IF;
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

  -- ── Sniper Dragon ──
  a_sniper_inst := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sniper_hot  := array_fill(NULL::FLOAT8, ARRAY[n]);
  a_sniper_rsi  := array_fill(NULL::FLOAT8, ARRAY[n]);
  FOR i IN 1..n LOOP
    IF a_rsi_9[i] IS NOT NULL THEN
      a_sniper_inst[i] := ROUND(LEAST(50, GREATEST(0, 1.5 * (a_rsi_9[i] - 61)))::NUMERIC, 4);
      a_sniper_rsi[i]  := ROUND((a_rsi_9[i] / 2)::NUMERIC, 4);
      a_sniper_hot[i]  := ROUND(LEAST(50, GREATEST(0, 1.0 * (a_rsi_9[i] - 15)))::NUMERIC, 4);
    END IF;
  END LOOP;

  -- ── RSS ──
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
        IF v_delta > 0 THEN v_sp_gain[i] := v_delta; v_sp_loss[i] := 0;
        ELSE v_sp_gain[i] := 0;
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
      IF a_obv[i] IS NOT NULL THEN v_obv_safe := TRUNC(a_obv[i])::BIGINT;
      ELSE v_obv_safe := NULL; END IF;

      EXECUTE format(
        'UPDATE %I SET
          sma_8=$1, sma_21=$2, sma_50=$3, sma_55=$4, sma_89=$5, sma_150=$6, sma_200=$7, sma_233=$8,
          rsi_14=$9, rsi_9=$10,
          mfi_14=$11,
          atr_10=$12, atr_14=$13,
          obv=$14::BIGINT, obv_sma_20=$15,
          rvol=$16, tvol=$17,
          pivot_pp=$18, pivot_r1=$19, pivot_r2=$20, pivot_r3=$21,
          pivot_s1=$22, pivot_s2=$23, pivot_s3=$24,
          sniper_inst=$25, sniper_hot=$26, sniper_rsi=$27,
          sma_10=$28, sma_40=$29, rss_spread=$30, rss_value=$31,
          ema_20=$32, ema_60=$33,
          indicators_computed_at=NOW()
        WHERE %I=$34 AND trade_date=$35 AND indicators_computed_at IS NULL',
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
        a_ema_20[i], a_ema_60[i],
        p_symbol_id, a_date[i];

      updated := updated + 1;
    END LOOP;
  END;

  RETURN updated;
END;
$function$;


-- ============================================================================
-- 2. compute_magic_rs_batch — cadence-aware warm-up (7-arg overload)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_magic_rs_batch(
  p_table text, p_id_col text, p_symbol_id integer, p_benchmark_id integer,
  p_from_date date DEFAULT NULL::date, p_bench_table text DEFAULT NULL::text,
  p_bench_id_col text DEFAULT NULL::text
)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
  -- ── Warm-up window, sized by the table's bar cadence (migration 169) ──
  -- The old fixed 350-day window gave weekly ~50 bars, below the IF n >= 145
  -- gate, so long MagicRS never computed; monthly got ~11 bars and tripped
  -- IF n < 22 THEN RETURN 0 before writing anything.
  IF p_from_date IS NOT NULL THEN
    IF right(p_table, 8) = '_monthly' THEN
      v_load_from := NULL;                                  -- full history
    ELSIF right(p_table, 7) = '_weekly' THEN
      v_load_from := p_from_date - INTERVAL '2100 days';     -- 300 weeks > 144+60
    ELSE
      v_load_from := p_from_date - INTERVAL '350 days';      -- daily, unchanged
    END IF;
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

  -- Load benchmark closes.
  -- NOTE: the benchmark is always km_index_eod (daily) even when p_table is a
  -- weekly/monthly equity table — the date-match loop below pairs each bar with
  -- the index close on that exact trade_date, so the benchmark must be loaded
  -- over the SAME span as the symbol. With v_load_from NULL that is full
  -- history for both, which is correct.
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
  -- On km_equity_monthly this stays unreachable by design: 145 monthly bars is
  -- ~12 years and the deepest symbol holds ~80. Monthly therefore carries
  -- magic_rs_short only, and magic_rs / magic_ma / magic_rs_zone stay NULL.

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
$function$;


-- ============================================================================
-- 3. Clear the false "computed" stamps so the re-backfill can actually write
-- ============================================================================
--
-- compute_indicators_batch ends its UPDATE with:
--     ... AND indicators_computed_at IS NULL
--
-- The 2026-08-06 backfill stamped every affected row while writing NULL values
-- (3,254 of 3,257 monthly rows for 2026-05). Without clearing the stamp, a
-- re-run skips all of them and changes nothing.
--
-- Scope is the corrupted range only. Weekly rows begin at week_start
-- 2026-04-27 (the ISO Monday of the --from 2026-05-01 backfill); monthly at
-- month_start 2026-05-01. Earlier rows were computed by an older backfill that
-- passed a far-past from_date, which made v_load_from reach full history — they
-- are correct and are left untouched.

UPDATE km_equity_weekly
   SET indicators_computed_at = NULL
 WHERE trade_date >= DATE '2026-04-27';

UPDATE km_equity_monthly
   SET indicators_computed_at = NULL
 WHERE trade_date >= DATE '2026-05-01';


-- ============================================================================
-- 4. Verification — run after the re-backfill, not now
-- ============================================================================
--
--   SELECT month_start, COUNT(*) AS rows,
--          COUNT(rsi_14) AS rsi, COUNT(ema_20) AS ema20,
--          COUNT(sma_50) AS sma50, COUNT(magic_rs_short) AS mrs_short
--     FROM km_equity_monthly
--    WHERE month_start >= '2026-05-01'
--    GROUP BY month_start ORDER BY month_start;
--
--   SELECT week_start, COUNT(*) AS rows,
--          COUNT(rsi_14) AS rsi, COUNT(ema_20) AS ema20,
--          COUNT(sma_50) AS sma50, COUNT(magic_rs) AS mrs
--     FROM km_equity_weekly
--    WHERE week_start >= '2026-04-27'
--    GROUP BY week_start ORDER BY week_start;
--
-- Expect on weekly: rsi/ema20 near the full row count for symbols with enough
-- history, and magic_rs populated again (it was 0 across this whole range).
-- Expect on monthly: rsi_14/ema_20/sma_50 populated for long-history symbols,
-- magic_rs_short populated, and magic_rs still NULL (see the 12-year note).
-- Symbols first registered in 2026-04 legitimately stay NULL on the longer
-- windows until they accumulate the bars.

NOTIFY pgrst, 'reload schema';
