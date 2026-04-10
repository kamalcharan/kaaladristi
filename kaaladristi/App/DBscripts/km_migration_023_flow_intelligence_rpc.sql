-- ============================================================
-- Migration 023 · Flow Intelligence RPC
-- Derives flow_type, vacuum_flag, accum_distrib from existing
-- indicator columns. Runs AFTER compute_indicators_batch.
--
-- Flow classification (LuckyPop Order Flow):
--   Uses MagicRS zone + price direction + RVOL as OI proxy.
--   FRESH_LONGS:       price up   + MagicRS bullish zone + RVOL >= 1.1
--   SHORT_COVERING:    price up   + MagicRS bearish zone + RVOL >= 1.1
--   FRESH_SHORTS:      price down + MagicRS bearish zone + RVOL >= 1.1
--   LONG_LIQUIDATION:  price down + MagicRS bullish zone + RVOL >= 1.1
--   MIXED:             volume present but no clear alignment
--   LOW_VOLUME:        RVOL < 1.1
--
-- Vacuum detection:
--   Price moved > 1% over 5 days but avg RVOL over that window < 0.5
--   VACUUM_UP / VACUUM_DOWN / NULL
--
-- Accumulation / Distribution:
--   ACCUMULATION:  below Golden Line (SMA 150) + RVOL >= 3.0 +
--                  (momentum bullish OR MagicRS bullish)
--   DISTRIBUTION:  above Golden Line + RVOL >= 3.0 +
--                  (momentum bearish OR MagicRS bearish)
-- ============================================================

CREATE OR REPLACE FUNCTION compute_flow_intelligence(
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

  -- Arrays loaded from existing columns
  a_date        DATE[];
  a_close       FLOAT8[];
  a_rvol        FLOAT8[];
  a_rsi_14      FLOAT8[];
  a_mfi_14      FLOAT8[];
  a_sma_150     FLOAT8[];
  a_magic_rs    FLOAT8[];
  a_magic_ma    FLOAT8[];
  a_mrs_zone    TEXT[];

  -- Output arrays
  a_flow_type     TEXT[];
  a_vacuum_flag   TEXT[];
  a_accum_distrib TEXT[];

  -- Working vars
  v_price_up     BOOLEAN;
  v_price_down   BOOLEAN;
  v_rs_bullish   BOOLEAN;
  v_rs_bearish   BOOLEAN;
  v_high_vol     BOOLEAN;
  v_pct_change_5 FLOAT8;
  v_avg_rvol_5   FLOAT8;
  v_cnt          INT;
  v_sum          FLOAT8;
  v_mom_bullish  BOOLEAN;
  v_mom_bearish  BOOLEAN;
  v_above_gl     BOOLEAN;
  v_below_gl     BOOLEAN;
  j              INT;
  start_idx      INT := 1;

BEGIN
  -- ── Load required columns ──
  EXECUTE format(
    'SELECT array_agg(trade_date ORDER BY trade_date),
            array_agg(close ORDER BY trade_date),
            array_agg(rvol ORDER BY trade_date),
            array_agg(rsi_14 ORDER BY trade_date),
            array_agg(mfi_14 ORDER BY trade_date),
            array_agg(sma_150 ORDER BY trade_date),
            array_agg(magic_rs ORDER BY trade_date),
            array_agg(magic_ma ORDER BY trade_date),
            array_agg(magic_rs_zone ORDER BY trade_date)
     FROM %I WHERE %I = $1',
    p_table, p_id_col
  ) INTO a_date, a_close, a_rvol, a_rsi_14, a_mfi_14,
         a_sma_150, a_magic_rs, a_magic_ma, a_mrs_zone
  USING p_symbol_id;

  n := COALESCE(array_length(a_date, 1), 0);
  IF n < 2 THEN RETURN 0; END IF;

  -- ── Init output arrays ──
  a_flow_type     := array_fill(NULL::TEXT, ARRAY[n]);
  a_vacuum_flag   := array_fill(NULL::TEXT, ARRAY[n]);
  a_accum_distrib := array_fill(NULL::TEXT, ARRAY[n]);

  -- ── Determine start index ──
  IF p_from_date IS NOT NULL THEN
    FOR i IN 1..n LOOP
      IF a_date[i] >= p_from_date THEN start_idx := i; EXIT; END IF;
    END LOOP;
  END IF;
  -- Need at least index 6 for 5-day lookback
  IF start_idx < 6 THEN start_idx := 6; END IF;

  -- ── Compute for each row ──
  FOR i IN start_idx..n LOOP

    -- Skip if prerequisite indicators are missing
    IF a_close[i] IS NULL OR a_close[i-1] IS NULL THEN
      CONTINUE;
    END IF;

    -- ── 1. FLOW CLASSIFICATION ──
    v_price_up   := a_close[i] > a_close[i-1];
    v_price_down := a_close[i] < a_close[i-1];
    v_high_vol   := COALESCE(a_rvol[i], 0) >= 1.1;

    -- Determine MagicRS direction
    v_rs_bullish := FALSE;
    v_rs_bearish := FALSE;
    IF a_mrs_zone[i] IS NOT NULL THEN
      v_rs_bullish := a_mrs_zone[i] IN ('Strong Bull', 'Mild Bull');
      v_rs_bearish := a_mrs_zone[i] IN ('Strong Bear', 'Mild Bear');
    ELSIF a_magic_rs[i] IS NOT NULL AND a_magic_ma[i] IS NOT NULL THEN
      v_rs_bullish := a_magic_rs[i] > a_magic_ma[i];
      v_rs_bearish := a_magic_rs[i] < a_magic_ma[i];
    END IF;

    IF NOT v_high_vol THEN
      a_flow_type[i] := 'LOW_VOLUME';
    ELSIF v_price_up AND v_rs_bullish THEN
      a_flow_type[i] := 'FRESH_LONGS';
    ELSIF v_price_up AND v_rs_bearish THEN
      a_flow_type[i] := 'SHORT_COVERING';
    ELSIF v_price_down AND v_rs_bearish THEN
      a_flow_type[i] := 'FRESH_SHORTS';
    ELSIF v_price_down AND v_rs_bullish THEN
      a_flow_type[i] := 'LONG_LIQUIDATION';
    ELSE
      a_flow_type[i] := 'MIXED';
    END IF;

    -- ── 2. VACUUM DETECTION ──
    -- Price change over 5 days
    IF a_close[i-5] IS NOT NULL AND a_close[i-5] > 0 THEN
      v_pct_change_5 := ((a_close[i] - a_close[i-5]) / a_close[i-5]) * 100;

      -- Average RVOL over last 5 days
      v_sum := 0; v_cnt := 0;
      FOR j IN (i-4)..i LOOP
        IF a_rvol[j] IS NOT NULL THEN
          v_sum := v_sum + a_rvol[j];
          v_cnt := v_cnt + 1;
        END IF;
      END LOOP;
      v_avg_rvol_5 := CASE WHEN v_cnt > 0 THEN v_sum / v_cnt ELSE NULL END;

      IF v_avg_rvol_5 IS NOT NULL AND v_avg_rvol_5 < 0.5 THEN
        IF v_pct_change_5 > 1.0 THEN
          a_vacuum_flag[i] := 'VACUUM_UP';
        ELSIF v_pct_change_5 < -1.0 THEN
          a_vacuum_flag[i] := 'VACUUM_DOWN';
        END IF;
      END IF;
    END IF;

    -- ── 3. ACCUMULATION / DISTRIBUTION ──
    v_above_gl := a_sma_150[i] IS NOT NULL AND a_close[i] > a_sma_150[i];
    v_below_gl := a_sma_150[i] IS NOT NULL AND a_close[i] < a_sma_150[i];
    v_mom_bullish := COALESCE(a_rsi_14[i], 0) > 50 AND COALESCE(a_mfi_14[i], 0) > 50;
    v_mom_bearish := COALESCE(a_rsi_14[i], 100) < 50 AND COALESCE(a_mfi_14[i], 100) < 50;

    IF v_below_gl AND COALESCE(a_rvol[i], 0) >= 3.0
       AND (v_mom_bullish OR v_rs_bullish) THEN
      a_accum_distrib[i] := 'ACCUMULATION';
    ELSIF v_above_gl AND COALESCE(a_rvol[i], 0) >= 3.0
       AND (v_mom_bearish OR v_rs_bearish) THEN
      a_accum_distrib[i] := 'DISTRIBUTION';
    END IF;

  END LOOP;

  -- ── Batch UPDATE ──
  FOR i IN start_idx..n LOOP
    EXECUTE format(
      'UPDATE %I SET flow_type=$1, vacuum_flag=$2, accum_distrib=$3
       WHERE %I=$4 AND trade_date=$5',
      p_table, p_id_col
    ) USING a_flow_type[i], a_vacuum_flag[i], a_accum_distrib[i],
            p_symbol_id, a_date[i];
    updated := updated + 1;
  END LOOP;

  RETURN updated;
END;
$$;


-- ── Convenience: compute flow intelligence for all symbols ──
CREATE OR REPLACE FUNCTION compute_all_flow_intelligence(
  p_table TEXT DEFAULT 'km_index_eod',
  p_id_col TEXT DEFAULT 'index_id'
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I',
    p_id_col, p_table
  ) LOOP
    symbol_id := r.sid;
    rows_updated := compute_flow_intelligence(p_table, p_id_col, r.sid);
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ── Permissions ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION compute_flow_intelligence(TEXT, TEXT, INT, DATE) TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_flow_intelligence(TEXT, TEXT) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
