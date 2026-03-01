/**
 * LuckyPop Indicator Computation Engine
 * Ports PineScript logic to TypeScript for client-side calculation.
 * Takes raw OHLCV rows and returns them with all indicator fields populated.
 */
import type { KmIndexEod } from '@/types';

// ── Helper: Simple Moving Average ──
function sma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      result.push(sum / period);
    }
  }
  return result;
}

// ── Helper: RSI ──
function rsi(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [null];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First avg using SMA
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i] ?? 0;
    avgLoss += losses[i] ?? 0;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

// ── Helper: MFI (Money Flow Index) ──
function mfi(high: number[], low: number[], close: number[], volume: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const tp: number[] = []; // typical price
  const mf: number[] = []; // raw money flow

  for (let i = 0; i < high.length; i++) {
    tp.push((high[i] + low[i] + close[i]) / 3);
    mf.push(tp[i] * volume[i]);
  }

  for (let i = 0; i < high.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }
    let posMF = 0;
    let negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posMF += mf[j];
      else if (tp[j] < tp[j - 1]) negMF += mf[j];
    }
    const ratio = negMF === 0 ? 100 : posMF / negMF;
    result.push(100 - 100 / (1 + ratio));
  }
  return result;
}

// ── Helper: ATR (Average True Range) ──
function atr(high: number[], low: number[], close: number[], period: number): (number | null)[] {
  const tr: number[] = [];
  for (let i = 0; i < high.length; i++) {
    if (i === 0) {
      tr.push(high[i] - low[i]);
    } else {
      tr.push(Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1]),
      ));
    }
  }
  return sma(tr, period);
}

// ── Helper: OBV ──
function obv(close: number[], volume: number[]): number[] {
  const result: number[] = [0];
  for (let i = 1; i < close.length; i++) {
    if (close[i] > close[i - 1]) result.push(result[i - 1] + volume[i]);
    else if (close[i] < close[i - 1]) result.push(result[i - 1] - volume[i]);
    else result.push(result[i - 1]);
  }
  return result;
}

// ── Helper: Highest over lookback ──
function highest(values: number[], period: number, index: number): number {
  let max = -Infinity;
  const start = Math.max(0, index - period + 1);
  for (let i = start; i <= index; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}

// ── Helper: Lowest over lookback ──
function lowest(values: number[], period: number, index: number): number {
  let min = Infinity;
  const start = Math.max(0, index - period + 1);
  for (let i = start; i <= index; i++) {
    if (values[i] < min) min = values[i];
  }
  return min;
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPUTATION FUNCTION
// ══════════════════════════════════════════════════════════════

export function computeIndicators(rows: KmIndexEod[]): KmIndexEod[] {
  if (rows.length === 0) return rows;

  // Extract arrays
  const closes = rows.map((r) => r.close ?? 0);
  const opens = rows.map((r) => r.open ?? 0);
  const highs = rows.map((r) => r.high ?? 0);
  const lows = rows.map((r) => r.low ?? 0);
  const volumes = rows.map((r) => r.volume ?? 0);

  // ── SMAs ──
  const sma8 = sma(closes, 8);
  const sma21 = sma(closes, 21);
  const sma55 = sma(closes, 55);
  const sma89 = sma(closes, 89);
  const sma233 = sma(closes, 233);
  const goldenLine = sma(closes, 150);

  // ── RSI (14) ──
  const rsiValues = rsi(closes, 14);

  // ── MFI (14) ──
  const mfiValues = mfi(highs, lows, closes, volumes, 14);

  // ── ATR (10) for SuperTrend ──
  const atrValues = atr(highs, lows, closes, 10);

  // ── SuperTrend (factor=3, ATR=10) ──
  const stVal: (number | null)[] = [];
  const stDir: (number | null)[] = [];
  const stBuy: boolean[] = [];
  const stSell: boolean[] = [];
  {
    let up = 0, dn = 0, trend = 1;
    for (let i = 0; i < rows.length; i++) {
      const atrVal = atrValues[i];
      if (atrVal == null) {
        stVal.push(null);
        stDir.push(null);
        stBuy.push(false);
        stSell.push(false);
        continue;
      }
      const hl2 = (highs[i] + lows[i]) / 2;
      let newUp = hl2 - 3 * atrVal;
      let newDn = hl2 + 3 * atrVal;

      if (i > 0 && closes[i - 1] > up) newUp = Math.max(newUp, up);
      if (i > 0 && closes[i - 1] < dn) newDn = Math.min(newDn, dn);

      const prevTrend = trend;
      if (trend === -1 && closes[i] > dn) trend = 1;
      else if (trend === 1 && closes[i] < up) trend = -1;

      up = newUp;
      dn = newDn;

      stVal.push(trend === 1 ? up : dn);
      stDir.push(trend);
      stBuy.push(trend === 1 && prevTrend === -1);
      stSell.push(trend === -1 && prevTrend === 1);
    }
  }

  // ── OBV ──
  const obvValues = obv(closes, volumes);
  const obvSma = sma(obvValues, 20);

  // ── Volume metrics ──
  const volSma55 = sma(volumes, 55);
  const volSma50 = sma(volumes, 50);
  const volSma20 = sma(volumes, 20);
  const volSma52 = sma(volumes, 52); // for dots

  // ── Average range ──
  const ranges = highs.map((h, i) => h - lows[i]);
  const avgRange = sma(ranges, 233);

  // ── RSS (Relative Strength Spread) ──
  const e1 = sma(closes, 10);
  const e2 = sma(closes, 40);
  const spread: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    spread.push((e1[i] ?? 0) - (e2[i] ?? 0));
  }
  const rsSpread = rsi(spread, 5);
  const rssSmooth = sma(
    rsSpread.map((v) => v ?? 0),
    3,
  );

  // ── Pivot / Fibo / Gann (based on previous day) ──
  // For EOD data, "previous day" means the prior row
  const pivotPP: (number | null)[] = [null];
  const pivotR1: (number | null)[] = [null];
  const pivotR2: (number | null)[] = [null];
  const pivotS1: (number | null)[] = [null];
  const pivotS2: (number | null)[] = [null];
  const fibo382: (number | null)[] = [null];
  const fibo500: (number | null)[] = [null];
  const fibo618: (number | null)[] = [null];
  const gann250: (number | null)[] = [null];
  const gann500: (number | null)[] = [null];
  const gann750: (number | null)[] = [null];

  for (let i = 1; i < rows.length; i++) {
    const pH = highs[i - 1];
    const pL = lows[i - 1];
    const pC = closes[i - 1];
    const pp = (pH + pL + pC) / 3;
    pivotPP.push(pp);
    pivotR1.push(2 * pp - pL);
    pivotR2.push(pp + (pH - pL));
    pivotS1.push(2 * pp - pH);
    pivotS2.push(pp - (pH - pL));

    const fiboRange = pH - pL;
    fibo382.push(pL + fiboRange * 0.382);
    fibo500.push(pL + fiboRange * 0.5);
    fibo618.push(pL + fiboRange * 0.618);

    gann250.push(pL + fiboRange * 0.25);
    gann500.push(pL + fiboRange * 0.5);
    gann750.push(pL + fiboRange * 0.75);
  }

  // ══════════════════════════════════════════════════════════
  // Assemble results — mutate rows in place for performance
  // ══════════════════════════════════════════════════════════
  const result = rows.map((row, i) => {
    const c = closes[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const v = volumes[i];

    // SMA distances
    const distSma8 = sma8[i] != null ? 100 * (c - sma8[i]!) / sma8[i]! : null;
    const distSma21 = sma21[i] != null ? 100 * (c - sma21[i]!) / sma21[i]! : null;
    const distSma55 = sma55[i] != null ? 100 * (c - sma55[i]!) / sma55[i]! : null;
    const distGolden = goldenLine[i] != null ? 100 * (c - goldenLine[i]!) / goldenLine[i]! : null;

    // Relative volume metrics
    const relVol = volSma55[i] != null && volSma55[i]! > 0 ? v / volSma55[i]! : null;
    const rvolVal = volSma50[i] != null && volSma50[i]! > 0 ? v / volSma50[i]! : null;
    const tvolVal = volSma20[i] != null && volSma20[i]! > 0 ? v / volSma20[i]! : null;

    // OBV trend
    const obvTrend = obvSma[i] != null
      ? (obvValues[i] > obvSma[i]! ? 'Bullish' : obvValues[i] < obvSma[i]! ? 'Bearish' : 'Neutral')
      : null;

    // Dot conditions
    const volAvg = volSma52[i] ?? 0;
    const volAvg50 = volSma50[i] ?? 0;
    const bodyRatio = h !== l ? Math.abs(c - o) / (h - l) : 0;
    const prevClose = i > 0 ? closes[i - 1] : c;

    const svdCond = v > 1000 && volAvg > 0 && v >= 10 * volAvg && c > (h + l) / 2 && c > o && bodyRatio >= 0.5 && c > prevClose * 1.03;
    const sbdCond = v > 1000 && volAvg > 0 && v >= 3 * volAvg && v < 10 * volAvg && c > prevClose && c > h - (h - l) / 3 && bodyRatio >= 0.5;
    const sydCond = i > 0 && c < prevClose && volAvg50 > 0 && v >= 2 * volAvg50 && c < l + (h - l) / 3 && v > volumes[i - 1];

    // MFI/RSI cross
    const mfiRsiCross = i > 0 && mfiValues[i] != null && rsiValues[i] != null && mfiValues[i - 1] != null && rsiValues[i - 1] != null
      ? ((mfiValues[i]! > rsiValues[i]!) !== (mfiValues[i - 1]! > rsiValues[i - 1]!))
      : false;

    // Bias
    const gl = goldenLine[i];
    let biasStatus: string | null = null;
    if (gl != null) {
      const glDist = Math.abs(c - gl) / gl * 100;
      biasStatus = glDist < 0.5 ? 'NEUTRAL' : c > gl ? 'LONG' : 'SHORT';
    }

    // Momentum
    const rsiVal = rsiValues[i];
    const mfiVal = mfiValues[i];
    let momentumStatus: string | null = null;
    if (rsiVal != null && mfiVal != null) {
      const bullish = rsiVal > 50 && mfiVal > 50;
      const bearish = rsiVal < 50 && mfiVal < 50;
      momentumStatus = bullish ? 'ALIGNED UP' : bearish ? 'ALIGNED DOWN' : 'MIXED';
    }

    // Order flow (simple: up_volume - down_volume)
    const deltaVal = i > 0 ? (c > prevClose ? v : c < prevClose ? -v : 0) : 0;

    // SMA crossover (sma21 vs sma55)
    let smaCrossUp = false;
    let smaCrossDown = false;
    let smaCrossDist: number | null = null;
    if (i > 0 && sma21[i] != null && sma55[i] != null && sma21[i - 1] != null && sma55[i - 1] != null) {
      smaCrossUp = sma21[i]! > sma55[i]! && sma21[i - 1]! <= sma55[i - 1]!;
      smaCrossDown = sma21[i]! < sma55[i]! && sma21[i - 1]! >= sma55[i - 1]!;
      smaCrossDist = sma55[i]! !== 0 ? 100 * (sma21[i]! - sma55[i]!) / sma55[i]! : null;
    }

    // Confluence score (0-10)
    let confluence = 0;
    if (biasStatus === 'LONG') confluence += 2;
    else if (biasStatus === 'SHORT') confluence += 1;
    if (momentumStatus === 'ALIGNED UP' || momentumStatus === 'ALIGNED DOWN') confluence += 2;
    if (rvolVal != null && rvolVal >= 1.3) confluence += 2;
    if (svdCond || sbdCond) confluence += 2;
    if (stDir[i] === 1 && biasStatus === 'LONG') confluence += 1;
    else if (stDir[i] === -1 && biasStatus === 'SHORT') confluence += 1;
    if (obvTrend === 'Bullish' && biasStatus === 'LONG') confluence += 1;
    else if (obvTrend === 'Bearish' && biasStatus === 'SHORT') confluence += 1;

    // Chartink Rule 1: Explosive move (8 weeks = 40 bars)
    const rule1BarsBack = 40;
    const weeksAgoPrice = i >= rule1BarsBack ? closes[i - rule1BarsBack] : null;
    const rule1MovePct = weeksAgoPrice && weeksAgoPrice > 0 ? ((c - weeksAgoPrice) / weeksAgoPrice) * 100 : null;
    const rule1Sat = rule1MovePct != null && rule1MovePct >= 100;

    // Chartink Rule 2: Correction < 20%
    const rule2Lookback = 30; // 6 weeks * 5
    const recentHigh = i >= rule2Lookback ? highest(highs, rule2Lookback, i) : null;
    const correctionPct = recentHigh && recentHigh > 0 ? ((recentHigh - c) / recentHigh) * 100 : null;
    const rule2Sat = correctionPct != null && correctionPct <= 20 && correctionPct >= 0;

    // Chartink Rule 3: Volume surge + MA proximity
    const volSurge = volSma20[i] != null && v >= volSma20[i]! * 1.5;
    const nearMa1 = sma8[i] != null && Math.abs(c - sma8[i]!) / sma8[i]! * 100 <= 3;
    const nearMa2 = sma21[i] != null && Math.abs(c - sma21[i]!) / sma21[i]! * 100 <= 3;
    const nearGl = gl != null && Math.abs(c - gl) / gl * 100 <= 3;
    const maProx = nearMa1 || nearMa2 || nearGl;
    const rule3Sat = volSurge && maProx;

    const chartinkScore = (rule1Sat ? 1 : 0) + (rule2Sat ? 1 : 0) + (rule3Sat ? 1 : 0);
    const chartinkStatus = chartinkScore === 3 ? 'Perfect' : chartinkScore === 2 ? 'Strong' : chartinkScore === 1 ? 'Partial' : 'Weak';

    // Absorption
    const absorptionDetected = volSma20[i] != null && v > volSma20[i]! * 2 && Math.abs(c - o) < (h - l) * 0.3;

    // Flow type (simplified — no MagicRS multi-TF in frontend)
    let flowType: string | null = null;
    let flowMeaning: string | null = null;
    if (rvolVal != null && rvolVal < 1.1) {
      flowType = 'GREY';
      flowMeaning = 'Low Volume';
    } else if (c > prevClose && momentumStatus === 'ALIGNED UP') {
      flowType = 'SOLID GREEN';
      flowMeaning = 'Fresh Longs';
    } else if (c > prevClose && momentumStatus !== 'ALIGNED UP') {
      flowType = 'HOLLOW GREEN';
      flowMeaning = 'Short Covering';
    } else if (c < prevClose && momentumStatus === 'ALIGNED DOWN') {
      flowType = 'SOLID RED';
      flowMeaning = 'Fresh Shorts';
    } else if (c < prevClose && momentumStatus !== 'ALIGNED DOWN') {
      flowType = 'HOLLOW RED';
      flowMeaning = 'Long Liquidation';
    } else {
      flowType = 'MIXED';
      flowMeaning = 'Mixed Flow';
    }

    // Vacuum detection
    let vacuumStatus: string | null = 'NONE';
    if (i >= 5 && rvolVal != null) {
      const priceChange5 = ((c - closes[i - 5]) / closes[i - 5]) * 100;
      let avgRvol = 0;
      let count = 0;
      for (let j = Math.max(0, i - 4); j <= i; j++) {
        const rv = volSma50[j] != null && volSma50[j]! > 0 ? volumes[j] / volSma50[j]! : null;
        if (rv != null) { avgRvol += rv; count++; }
      }
      avgRvol = count > 0 ? avgRvol / count : 0;
      if (priceChange5 > 1 && avgRvol < 0.5) vacuumStatus = 'VACUUM UP';
      else if (priceChange5 < -1 && avgRvol < 0.5) vacuumStatus = 'VACUUM DOWN';
    }

    // Swing high/low (simplified: 10 bar lookback each side where available)
    let isSwingHigh = false;
    let isSwingLow = false;
    if (i >= 10 && i < rows.length - 10) {
      isSwingHigh = true;
      isSwingLow = true;
      for (let j = i - 10; j <= i + 10; j++) {
        if (j !== i) {
          if (highs[j] >= h) isSwingHigh = false;
          if (lows[j] <= l) isSwingLow = false;
        }
      }
    }

    // Simple recommendation (EOD-level, no IB30 for daily)
    let recommendation: string | null = null;
    let recReason: string | null = null;
    let signalScore = 0;

    if (biasStatus != null && rvolVal != null && tvolVal != null && rsiVal != null && mfiVal != null) {
      if (rvolVal < 0.7 && tvolVal < 0.5) {
        recommendation = 'AVOID'; recReason = 'Dead Day';
      } else if (biasStatus === 'NEUTRAL') {
        recommendation = 'NO TRADE'; recReason = 'Unclear Bias';
      } else if (biasStatus === 'LONG') {
        if (!momentumStatus || momentumStatus !== 'ALIGNED UP') {
          recommendation = 'CAUTION'; recReason = 'Momentum Not Aligned';
        } else if (sydCond) {
          recommendation = 'CAUTION'; recReason = 'SYD Conflict';
        } else if (rvolVal < 1.1) {
          recommendation = 'AVOID'; recReason = 'Low RVOL';
        } else if (tvolVal < 0.8) {
          recommendation = 'SCALP ONLY'; recReason = 'Low TVOL';
        } else if (svdCond && rvolVal >= 1.3) {
          recommendation = 'STRONG BUY'; recReason = 'SVD Present'; signalScore = 8;
        } else if (sbdCond && rvolVal >= 1.1) {
          recommendation = 'BUY CONFIRMED'; recReason = 'SBD Present'; signalScore = 6;
        } else if (rvolVal >= 1.3 && tvolVal >= 1.0) {
          recommendation = 'BUY'; recReason = 'Full Conviction'; signalScore = 5;
        } else {
          recommendation = 'BUY'; recReason = 'Standard Setup'; signalScore = 3;
        }
      } else if (biasStatus === 'SHORT') {
        if (momentumStatus !== 'ALIGNED DOWN') {
          recommendation = 'CAUTION'; recReason = 'Momentum Not Aligned';
        } else if (svdCond || sbdCond) {
          recommendation = 'AVOID'; recReason = 'Buyers Active';
        } else if (rvolVal < 1.3) {
          recommendation = 'AVOID'; recReason = 'Low RVOL';
        } else if (tvolVal < 1.0) {
          recommendation = 'SCALP SHORT'; recReason = 'Low TVOL'; signalScore = -3;
        } else {
          recommendation = 'SELL'; recReason = 'Standard Setup'; signalScore = -5;
        }
      }
    }

    // RSSI values
    const rssiRss = rssSmooth[i];
    const rssiRsi = rsiValues[i];

    return {
      ...row,
      // SMAs
      sma_8: sma8[i], sma_21: sma21[i], sma_55: sma55[i],
      sma_89: sma89[i], sma_233: sma233[i], golden_line: goldenLine[i],
      // SMA distances
      dist_sma_8: distSma8, dist_sma_21: distSma21, dist_sma_55: distSma55, dist_golden: distGolden,
      // SuperTrend
      supertrend_val: stVal[i], supertrend_dir: stDir[i],
      st_buy_signal: stBuy[i], st_sell_signal: stSell[i],
      // Dots
      svd_condition: svdCond, sbd_condition: sbdCond, syd_condition: sydCond,
      pre_syd_warning: false, // simplified
      // RSI / MFI / OBV
      rsi: rsiVal, mfi: mfiVal, mfi_rsi_cross: mfiRsiCross, obv_trend: obvTrend,
      // Volume metrics
      rel_volume: relVol, rvol: rvolVal, tvol: tvolVal, avg_range: avgRange[i],
      // RSS
      rss_smooth: rssiRss, rss_spread: spread[i], rss_direction: e1[i] != null && e2[i] != null ? e1[i]! > e2[i]! : null,
      // Chartink
      rule1_move_pct: rule1MovePct, rule1_satisfied: rule1Sat,
      correction_pct: correctionPct, rule2_satisfied: rule2Sat,
      volume_surge: volSurge, ma_proximity: maProx, rule3_satisfied: rule3Sat,
      chartink_score: chartinkScore, chartink_status: chartinkStatus,
      // Order flow
      delta: deltaVal, smoothed_delta: null, absorption: absorptionDetected,
      // Flow
      flow_type: flowType, flow_meaning: flowMeaning,
      // Vacuum
      vacuum_status: vacuumStatus, accum_dist: 'NONE',
      // SMA cross
      sma_cross_up: smaCrossUp, sma_cross_down: smaCrossDown, sma_cross_dist: smaCrossDist,
      // Confluence
      confluence: Math.min(confluence, 10),
      // Bias & Momentum
      bias_status: biasStatus, momentum_status: momentumStatus,
      // Recommendation
      recommendation, rec_reason: recReason, signal_score: signalScore,
      display_mode: recommendation ? 'SCANNING' : null,
      // Swing
      is_swing_high: isSwingHigh, is_swing_low: isSwingLow,
      // Pivot / Fibo / Gann
      pivot_pp: pivotPP[i], pivot_r1: pivotR1[i], pivot_r2: pivotR2[i],
      pivot_s1: pivotS1[i], pivot_s2: pivotS2[i],
      fibo_382: fibo382[i], fibo_500: fibo500[i], fibo_618: fibo618[i],
      gann_250: gann250[i], gann_500: gann500[i], gann_750: gann750[i],
      // RSSI
      rssi_rss: rssiRss, rssi_rsi: rssiRsi,
      // Metadata
      indicators_computed_at: new Date().toISOString(),
    } as KmIndexEod;
  });

  // Smoothed delta (SMA of delta, 5 bars)
  const deltas = result.map((r) => r.delta ?? 0);
  const smoothedDelta = sma(deltas, 5);
  for (let i = 0; i < result.length; i++) {
    result[i].smoothed_delta = smoothedDelta[i];
  }

  return result;
}
