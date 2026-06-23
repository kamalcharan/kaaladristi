-- ============================================================
-- Migration 108 · BUG-08: Remove RVOL >= 3.0 gate from
--                Accumulation/Distribution classification
--
-- Problem: compute_flow_intelligence() section 3 required
-- COALESCE(a_rvol[i], 0) >= 3.0 for both ACCUMULATION and
-- DISTRIBUTION signals. This is a volume event threshold, not
-- a structural regime threshold.
--
-- RVOL >= 3.0 means volume must be 3x the 50-day average —
-- an extreme spike that affects only ~1% of all equity-days.
-- Accumulation/Distribution is a structural price-vs-GreenLine
-- + momentum regime, not a volume spike event. Blocking it on
-- RVOL starves the feature of data.
--
-- Fix: Remove RVOL >= 3.0 from both conditions.
-- All other logic is unchanged.
--
-- Also updates the stale comment in section 4 (scale mismatch
-- guard) which incorrectly claimed accum_distrib was
-- "self-protecting" via the RVOL gate.
--
-- After applying: run full equity backfill:
--   SELECT COUNT(*) FROM compute_all_flow_intelligence(
--     'km_equity_eod', 'equity_id', NULL, NULL
--   );
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
  a_volume      FLOAT8[];
  a_rvol        FLOAT8[];
  a_tvol        FLOAT8[];
  a_rsi_14      FLOAT8[];
  a_mfi_14      FLOAT8[];
  a_sma_150     FLOAT8[];
  a_magic_rs    FLOAT8[];
  a_magic_ma    FLOAT8[];
  a_mrs_zone    TEXT[];

  -- Output arrays
  a_flow_type     TEXT[];
  a_vacuum_flag   TEXT[];
  a_vol_div       TEXT[];
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
            array_agg(COALESCE(volume,0) ORDER BY trade_date),
            array_agg(rvol ORDER BY trade_date),
            array_agg(tvol ORDER BY trade_date),
            array_agg(rsi_14 ORDER BY trade_date),
            array_agg(mfi_14 ORDER BY trade_date),
            array_agg(sma_150 ORDER BY trade_date),
            array_agg(magic_rs ORDER BY trade_date),
            array_agg(magic_ma ORDER BY trade_date),
            array_agg(magic_rs_zone ORDER BY trade_date)
     FROM %I WHERE %I = $1',
    p_table, p_id_col
  ) INTO a_date, a_close, a_volume, a_rvol, a_tvol, a_rsi_14, a_mfi_14,
         a_sma_150, a_magic_rs, a_magic_ma, a_mrs_zone
  USING p_symbol_id;

  n := COALESCE(array_length(a_date, 1), 0);
  IF n < 2 THEN RETURN 0; END IF;

  -- ── Init output arrays ──
  a_flow_type     := array_fill(NULL::TEXT, ARRAY[n]);
  a_vacuum_flag   := array_fill(NULL::TEXT, ARRAY[n]);
  a_vol_div       := array_fill(NULL::TEXT, ARRAY[n]);
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

    -- ── 0. ZERO-VOLUME GUARD ──
    -- Holiday or missing data — skip entirely, leave all fields NULL
    IF a_volume[i] = 0 THEN
      CONTINUE;
    END IF;

    -- ── 1. FLOW CLASSIFICATION ──
    v_price_up   := a_close[i] > a_close[i-1];
    v_price_down := a_close[i] < a_close[i-1];
    v_high_vol   := COALESCE(a_rvol[i], 0) >= 1.1;

    -- Determine MagicRS direction (3-tier fallback)
    v_rs_bullish := FALSE;
    v_rs_bearish := FALSE;

    -- Tier 1: MagicRS zone (Strong/Mild Bull or Bear)
    IF a_mrs_zone[i] IS NOT NULL THEN
      v_rs_bullish := a_mrs_zone[i] IN ('Strong Bull', 'Mild Bull');
      v_rs_bearish := a_mrs_zone[i] IN ('Strong Bear', 'Mild Bear');
    END IF;

    -- Tier 2: Raw MagicRS vs MagicMA (when zone is Neutral or NULL)
    IF NOT v_rs_bullish AND NOT v_rs_bearish THEN
      IF a_magic_rs[i] IS NOT NULL AND a_magic_ma[i] IS NOT NULL THEN
        v_rs_bullish := a_magic_rs[i] > a_magic_ma[i];
        v_rs_bearish := a_magic_rs[i] < a_magic_ma[i];
      END IF;
    END IF;

    -- Tier 3: RSI-14 as directional proxy (when MagicRS gives no signal)
    IF NOT v_rs_bullish AND NOT v_rs_bearish THEN
      IF a_rsi_14[i] IS NOT NULL THEN
        v_rs_bullish := a_rsi_14[i] > 52;
        v_rs_bearish := a_rsi_14[i] < 48;
      END IF;
      -- RSI 48-52 dead zone: both stay FALSE → MIXED (genuinely ambiguous)
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

    -- ── 2b. VOLUME DIVERGENCE ──
    -- Price moving on DECLINING (but real) volume.
    -- Distinct from vacuum: vacuum = near-zero volume (RVOL < 0.5),
    -- divergence = weakening volume (still real, but fading conviction).
    -- Mutually exclusive by design: avg_rvol > 0.5 guard.
    --
    -- Sustained decline: rvol[i] < rvol[i-3] < rvol[i-5]
    -- Two intermediate declining points prevent single-bar dips
    -- from triggering — needs a genuine sustained trend.
    IF a_close[i-5] IS NOT NULL AND a_close[i-5] > 0
       AND a_rvol[i] IS NOT NULL
       AND a_rvol[i-3] IS NOT NULL
       AND a_rvol[i-5] IS NOT NULL THEN

      -- Compute avg RVOL over last 5 days (independent of vacuum section)
      v_sum := 0; v_cnt := 0;
      FOR j IN (i-4)..i LOOP
        IF a_rvol[j] IS NOT NULL THEN
          v_sum := v_sum + a_rvol[j];
          v_cnt := v_cnt + 1;
        END IF;
      END LOOP;
      v_avg_rvol_5 := CASE WHEN v_cnt > 0 THEN v_sum / v_cnt ELSE NULL END;

      IF v_avg_rvol_5 IS NOT NULL AND v_avg_rvol_5 > 0.5
         AND a_rvol[i] < a_rvol[i-3]
         AND a_rvol[i-3] < a_rvol[i-5] THEN
        IF a_close[i] > a_close[i-5] THEN
          a_vol_div[i] := 'VOLUME_DIV_UP';
        ELSIF a_close[i] < a_close[i-5] THEN
          a_vol_div[i] := 'VOLUME_DIV_DOWN';
        END IF;
      END IF;
    END IF;

    -- ── 3. ACCUMULATION / DISTRIBUTION ──
    -- Structural regime classification: price position vs GreenLine (SMA 150)
    -- combined with momentum (RSI + MFI both > 50 / < 50) or MagicRS direction.
    -- No volume gate — A/D is a regime, not a volume event.
    v_above_gl := a_sma_150[i] IS NOT NULL AND a_close[i] > a_sma_150[i];
    v_below_gl := a_sma_150[i] IS NOT NULL AND a_close[i] < a_sma_150[i];
    v_mom_bullish := COALESCE(a_rsi_14[i], 0) > 50 AND COALESCE(a_mfi_14[i], 0) > 50;
    v_mom_bearish := COALESCE(a_rsi_14[i], 100) < 50 AND COALESCE(a_mfi_14[i], 100) < 50;

    IF v_below_gl AND (v_mom_bullish OR v_rs_bullish) THEN
      a_accum_distrib[i] := 'ACCUMULATION';
    ELSIF v_above_gl AND (v_mom_bearish OR v_rs_bearish) THEN
      a_accum_distrib[i] := 'DISTRIBUTION';
    END IF;

    -- ── 4. VOLUME SCALE MISMATCH GUARD ──
    -- RVOL < 0.1 with TVOL > 0.5 = data scale discontinuity, not real signal.
    -- RVOL uses 50-day average (crosses scale boundary), TVOL uses 20-day
    -- (stays within same scale period). When they diverge this severely,
    -- RVOL-dependent signals are unreliable — NULL them out.
    -- accum_distrib is NOT nulled here; it does not depend on RVOL magnitude.
    IF COALESCE(a_rvol[i], 0) < 0.1 AND COALESCE(a_tvol[i], 0) > 0.5 THEN
      a_flow_type[i] := NULL;
      a_vacuum_flag[i] := NULL;
      a_vol_div[i] := NULL;
    END IF;

  END LOOP;

  -- ── Batch UPDATE ──
  FOR i IN start_idx..n LOOP
    EXECUTE format(
      'UPDATE %I SET flow_type=$1, vacuum_flag=$2, volume_divergence_flag=$3, accum_distrib=$4
       WHERE %I=$5 AND trade_date=$6',
      p_table, p_id_col
    ) USING a_flow_type[i], a_vacuum_flag[i], a_vol_div[i], a_accum_distrib[i],
            p_symbol_id, a_date[i];
    updated := updated + 1;
  END LOOP;

  RETURN updated;
END;
$$;


-- ── Permissions ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION compute_flow_intelligence(TEXT, TEXT, INT, DATE) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
