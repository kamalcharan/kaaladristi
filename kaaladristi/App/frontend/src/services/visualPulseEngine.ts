/**
 * Visual Pulse Engine — Signal Computation
 * =========================================
 * Pure TypeScript functions. No API calls. Takes bar data + dc_inference
 * as input, returns computed signals for the Visual Pulse page.
 *
 * All derived signals are computed here from existing DB columns.
 * No new DB columns are added.
 */

// ── Types ───────────────────────────────────────────────────────

export interface PulseBar {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rvol: number | null;
  tvol: number | null;
  rsi_14: number | null;
  mfi_14: number | null;
  rss_value: number | null;
  rss_spread: number | null;
  sma_150: number | null;
  sniper_inst: number | null;
  sniper_hot: number | null;
  flow_type: string | null;
  vacuum_flag: string | null;
  volume_divergence_flag: string | null;
  accum_distrib: string | null;
  magic_rs: number | null;
  magic_ma: number | null;
  magic_rs_zone: string | null;
}

export interface DcInferenceEvent {
  id: number;
  astro_event: string;
  start_date: string;
  end_date: string | null;
  market_impact: string | null;
  inference: string | null;
}

export interface DotSignals {
  isSVD: boolean;
  isSBD: boolean;
  isSYD: boolean;
}

export type RssZone = 'OVERBOUGHT' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'OVERSOLD';

export interface RssSignals {
  value: number | null;
  spread: number | null;
  slope: number;
  isNewHigh: boolean;
  zone: RssZone;
  spreadNarrowing: boolean;
  spreadRepaired: boolean;
  pumpRisk: boolean;
}

export interface SmartMoneySignals {
  smartMoney: number | null;
  fastMoney: number | null;
  smSlope5: number;
  fmSlope5: number;
  smTrending: boolean;
  fmTrending: boolean;
  smExiting: boolean;
  hasSVD5: boolean;
  hasSBD5: boolean;
  hasSYD: boolean;
  pumpSignal: boolean;
  relationship: string;
}

export interface DivergenceSignal {
  type:
    | 'RegularBullish'
    | 'RegularBearish'
    | 'HiddenBullish'
    | 'HiddenBearish'
    | null;
  barsAgo: number;
  freshness: 'hot' | 'recent' | 'stale' | 'old';
  label: string;
}

export interface CorrelationState {
  state: 'Aligned' | 'Converging' | 'Watch' | 'Neutral' | 'Conflicting';
  color: string;
  tagline: string;
}

export type TradingStyle = 'Conservative' | 'Balanced' | 'Aggressive';

// ── Style Weights ───────────────────────────────────────────────

interface StyleConfig {
  weights: Record<string, number>;
  thresholds: { aligned: number; converging: number; conflicting: number };
}

const STYLE_WEIGHTS: Record<TradingStyle, StyleConfig> = {
  Conservative: {
    weights: {
      FRESH_LONGS: 4,      FRESH_SHORTS: 4,
      SHORT_COVERING: 0,   LONG_LIQUIDATION: 0,
      ACCUMULATION: 3,     DISTRIBUTION: -3,
      RSS_HIGH: 3,         SPREAD_REPAIRED: 3,
      SPREAD_NARROWING: 1, SM_TRENDING: 3,
      SM_FM_ALIGNED: 2,    SVD_RECENT: 4,
      SBD_RECENT: 2,       SYD_PRESENT: -4,
      PUMP_SIGNAL: -4,     SM_EXITING: -3,
      VOL_DIV: -3,         VACUUM: -2,
    },
    thresholds: { aligned: 8, converging: 5, conflicting: -4 },
  },
  Balanced: {
    weights: {
      FRESH_LONGS: 3,      FRESH_SHORTS: 3,
      SHORT_COVERING: 1,   LONG_LIQUIDATION: -1,
      ACCUMULATION: 2,     DISTRIBUTION: -2,
      RSS_HIGH: 2,         SPREAD_REPAIRED: 2,
      SPREAD_NARROWING: 1, SM_TRENDING: 2,
      SM_FM_ALIGNED: 1,    SVD_RECENT: 2,
      SBD_RECENT: 1,       SYD_PRESENT: -2,
      PUMP_SIGNAL: -3,     SM_EXITING: -2,
      VOL_DIV: -1,         VACUUM: -1,
    },
    thresholds: { aligned: 6, converging: 4, conflicting: -3 },
  },
  Aggressive: {
    weights: {
      FRESH_LONGS: 2,      FRESH_SHORTS: 2,
      SHORT_COVERING: 2,   LONG_LIQUIDATION: 1,
      ACCUMULATION: 1,     DISTRIBUTION: -1,
      RSS_HIGH: 1,         SPREAD_REPAIRED: 1,
      SPREAD_NARROWING: 1, SM_TRENDING: 1,
      SM_FM_ALIGNED: 1,    SVD_RECENT: 1,
      SBD_RECENT: 1,       SYD_PRESENT: -1,
      PUMP_SIGNAL: -1,     SM_EXITING: -1,
      VOL_DIV: 0,          VACUUM: 0,
    },
    thresholds: { aligned: 4, converging: 3, conflicting: -2 },
  },
};

// ── Astro Weights ───────────────────────────────────────────────

const ASTRO_WEIGHTS: Record<string, number> = {
  major_positive: 4,
  bullish: 3,
  minor_positive: 1,
  neutral: 0,
  minor_negative: -1,
  bearish: -3,
  major_negative: -4,
};

// ── 2A. DOT Signals ─────────────────────────────────────────────

export function computeDots(bar: PulseBar, prevBar: PulseBar | null): DotSignals {
  const range = bar.high - bar.low;
  const bodyRatio = range > 0 ? Math.abs(bar.close - bar.open) / range : 0;
  const aboveMid = bar.close > (bar.high + bar.low) / 2;
  const strongClose = prevBar ? bar.close > prevBar.close * 1.02 : false;

  const isSVD =
    (bar.rvol ?? 0) > 10 &&
    aboveMid &&
    strongClose &&
    bodyRatio >= 0.5 &&
    bar.close > bar.open;

  const isSBD =
    (bar.rvol ?? 0) >= 3 &&
    (bar.rvol ?? 0) < 10 &&
    bar.close > bar.open &&
    bar.close > bar.high - range / 3 &&
    bodyRatio >= 0.45;

  const isSYD =
    bar.close < (prevBar?.close ?? bar.close) &&
    (bar.rvol ?? 0) >= 2 &&
    bar.close < bar.low + range / 3;

  return { isSVD, isSBD, isSYD };
}

// ── 2B. RSS Signals ─────────────────────────────────────────────

export function computeRssSignals(bars: PulseBar[], idx: number): RssSignals {
  const current = bars[idx].rss_value;
  const fallback: RssSignals = {
    value: current, spread: bars[idx].rss_spread, slope: 0,
    isNewHigh: false, zone: 'NEUTRAL', spreadNarrowing: false,
    spreadRepaired: false, pumpRisk: false,
  };

  if (current == null) return fallback;

  const window20 = bars
    .slice(Math.max(0, idx - 19), idx + 1)
    .map((b) => b.rss_value)
    .filter((v): v is number => v != null);

  const prev5 = bars[idx - 5]?.rss_value ?? current;
  const slope = current - prev5;

  const pastMax =
    window20.length >= 10
      ? Math.max(...window20.slice(0, -1))
      : current;
  const isNewHigh = window20.length >= 10 && current >= pastMax && current > 60;

  const zone: RssZone =
    current > 80 ? 'OVERBOUGHT'
    : current > 60 ? 'BULLISH'
    : current > 40 ? 'NEUTRAL'
    : current > 20 ? 'BEARISH'
    : 'OVERSOLD';

  const spreadPrev5 = bars[idx - 5]?.rss_spread ?? 0;
  const curSpread = bars[idx].rss_spread ?? 0;
  const spreadNarrowing = curSpread > spreadPrev5 && curSpread < 0;
  const spreadRepaired = curSpread > 0;

  const pumpRisk =
    current > 75 &&
    (bars[idx].rss_spread ?? 0) < -200 &&
    bars[idx].flow_type === 'SHORT_COVERING' &&
    bars[idx].volume_divergence_flag === 'VOLUME_DIV_UP';

  return {
    value: current,
    spread: bars[idx].rss_spread,
    slope,
    isNewHigh,
    zone,
    spreadNarrowing,
    spreadRepaired,
    pumpRisk,
  };
}

// ── 2C. Smart Money Signals ─────────────────────────────────────

export function computeSmartMoney(bars: PulseBar[], idx: number): SmartMoneySignals {
  const cur = bars[idx];
  const prev5 = bars[idx - 5] ?? null;

  const smSlope5 = prev5 ? (cur.sniper_inst ?? 0) - (prev5.sniper_inst ?? 0) : 0;
  const fmSlope5 = prev5 ? (cur.sniper_hot ?? 0) - (prev5.sniper_hot ?? 0) : 0;

  const smTrending = smSlope5 > 1;
  const fmTrending = fmSlope5 > 1;
  const smExiting = smSlope5 < -2 && (cur.sniper_hot ?? 0) > (cur.sniper_inst ?? 0) * 0.8;

  const window5 = bars.slice(Math.max(0, idx - 4), idx + 1);
  const dots5 = window5.map((b, i) => {
    const prevIdx = Math.max(0, idx - 4) + i - 1;
    return computeDots(b, prevIdx >= 0 ? bars[prevIdx] : null);
  });
  const hasSVD5 = dots5.some((d) => d.isSVD);
  const hasSBD5 = dots5.some((d) => d.isSBD);
  const hasSYD = dots5.some((d) => d.isSYD);

  const pumpSignal = smExiting && (cur.sniper_hot ?? 0) > 20;

  let relationship: string;
  if (pumpSignal) relationship = 'Diverging';
  else if (smTrending && !hasSYD) relationship = 'Smart Leading';
  else if (smTrending && fmTrending) relationship = 'Aligned';
  else if ((cur.sniper_inst ?? 0) < 8 && (cur.sniper_hot ?? 0) < 8) relationship = 'Absent';
  else if (fmTrending && !smTrending) relationship = 'Fast Only';
  else relationship = 'Mixed';

  return {
    smartMoney: cur.sniper_inst,
    fastMoney: cur.sniper_hot,
    smSlope5, fmSlope5,
    smTrending, fmTrending, smExiting,
    hasSVD5, hasSBD5, hasSYD,
    pumpSignal, relationship,
  };
}

// ── 2D. Astro Score ─────────────────────────────────────────────

export function computeAstroScore(
  dateStr: string,
  dcInferences: DcInferenceEvent[],
): number {
  return dcInferences
    .filter(
      (ev) =>
        dateStr >= ev.start_date &&
        dateStr <= (ev.end_date ?? ev.start_date),
    )
    .reduce(
      (sum, ev) => sum + (ASTRO_WEIGHTS[ev.market_impact ?? 'neutral'] ?? 0),
      0,
    );
}

// ── 2E. Technical Score ─────────────────────────────────────────

export function computeTechScore(
  bar: PulseBar,
  rss: RssSignals,
  sm: SmartMoneySignals,
  style: TradingStyle,
): number {
  const W = STYLE_WEIGHTS[style].weights;
  let score = 0;

  if (bar.flow_type === 'FRESH_LONGS') score += W.FRESH_LONGS;
  if (bar.flow_type === 'SHORT_COVERING') score += W.SHORT_COVERING;
  if (bar.flow_type === 'FRESH_SHORTS') score += W.FRESH_SHORTS;
  if (bar.flow_type === 'LONG_LIQUIDATION') score += W.LONG_LIQUIDATION;
  if (bar.accum_distrib === 'ACCUMULATION') score += W.ACCUMULATION;
  if (bar.accum_distrib === 'DISTRIBUTION') score += W.DISTRIBUTION;
  if ((rss.value ?? 0) > 65) score += W.RSS_HIGH;
  if (rss.spreadRepaired) score += W.SPREAD_REPAIRED;
  else if (rss.spreadNarrowing) score += W.SPREAD_NARROWING;
  if (sm.smTrending) score += W.SM_TRENDING;
  if (sm.smTrending && sm.fmTrending) score += W.SM_FM_ALIGNED;
  if (sm.hasSVD5) score += W.SVD_RECENT;
  if (sm.hasSBD5) score += W.SBD_RECENT;
  if (sm.hasSYD) score += W.SYD_PRESENT;
  if (sm.pumpSignal) score += W.PUMP_SIGNAL;
  if (sm.smExiting) score += W.SM_EXITING;
  if (bar.volume_divergence_flag) score += W.VOL_DIV;
  if (bar.vacuum_flag) score += W.VACUUM;

  return Math.max(-10, Math.min(10, score));
}

// ── 2F. Smart Money Score ───────────────────────────────────────

export function computeSmScore(sm: SmartMoneySignals): number {
  let s = 0;
  if (sm.smTrending) s += 3;
  if ((sm.smartMoney ?? 0) > 25) s += 2;
  if (sm.hasSVD5) s += 3;
  if (sm.hasSBD5) s += 1;
  if (sm.hasSYD) s -= 3;
  if (sm.smExiting) s -= 3;
  return Math.max(-8, Math.min(8, s));
}

// ── 2G. Correlation State ───────────────────────────────────────

export function getCorrelationState(
  total: number,
  style: TradingStyle,
): CorrelationState {
  const T = STYLE_WEIGHTS[style].thresholds;

  if (total >= T.aligned)
    return {
      state: 'Aligned',
      color: 'var(--risk-green)',
      tagline: 'All layers converging — highest conviction window',
    };
  if (total >= T.converging)
    return {
      state: 'Converging',
      color: 'var(--accent-gold)',
      tagline: 'Signals building toward alignment — setup forming',
    };
  if (total <= T.conflicting)
    return {
      state: 'Conflicting',
      color: 'var(--risk-red)',
      tagline: 'Layers in disagreement — elevated risk, stay cautious',
    };
  if (total > 0)
    return {
      state: 'Watch',
      color: 'var(--accent-indigo)',
      tagline: 'Positive lean — insufficient confirmation yet',
    };
  return {
    state: 'Neutral',
    color: 'var(--text-muted)',
    tagline: 'No clear edge — market undecided',
  };
}

// ── 3. RSI Divergence Detection ─────────────────────────────────

function findSwingLows(
  values: (number | null)[],
  startIdx: number,
  lookback: number,
): { idx: number; value: number }[] {
  const lows: { idx: number; value: number }[] = [];
  const from = Math.max(1, startIdx - lookback);
  for (let i = from; i < startIdx; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    const next = values[i + 1];
    if (prev != null && cur != null && next != null && cur < prev && cur < next) {
      lows.push({ idx: i, value: cur });
    }
  }
  return lows;
}

function findSwingHighs(
  values: (number | null)[],
  startIdx: number,
  lookback: number,
): { idx: number; value: number }[] {
  const highs: { idx: number; value: number }[] = [];
  const from = Math.max(1, startIdx - lookback);
  for (let i = from; i < startIdx; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    const next = values[i + 1];
    if (prev != null && cur != null && next != null && cur > prev && cur > next) {
      highs.push({ idx: i, value: cur });
    }
  }
  return highs;
}

function getFreshness(barsAgo: number): 'hot' | 'recent' | 'stale' | 'old' {
  if (barsAgo <= 3) return 'hot';
  if (barsAgo <= 15) return 'recent';
  if (barsAgo <= 30) return 'stale';
  return 'old';
}

export function detectDivergence(
  bars: PulseBar[],
  idx: number,
  lookback = 50,
): DivergenceSignal {
  const none: DivergenceSignal = { type: null, barsAgo: 0, freshness: 'old', label: '' };

  if (idx < 5) return none;

  const closes = bars.map((b) => b.close);
  const rsis = bars.map((b) => b.rsi_14);

  // Bullish divergences — compare swing lows
  const priceLows = findSwingLows(closes, idx, lookback);
  const rsiLows = findSwingLows(rsis, idx, lookback);

  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const pL1 = priceLows[priceLows.length - 2];
    const pL2 = priceLows[priceLows.length - 1];
    const rL1 = rsiLows[rsiLows.length - 2];
    const rL2 = rsiLows[rsiLows.length - 1];

    const barsAgo = idx - pL2.idx;

    // Regular Bullish: price lower low + RSI higher low
    if (pL2.value < pL1.value && rL2.value > rL1.value) {
      return {
        type: 'RegularBullish',
        barsAgo,
        freshness: getFreshness(barsAgo),
        label: 'Price making lower lows while RSI holds higher lows — bullish reversal signal.',
      };
    }

    // Hidden Bullish: price higher low + RSI lower low
    if (pL2.value > pL1.value && rL2.value < rL1.value) {
      return {
        type: 'HiddenBullish',
        barsAgo,
        freshness: getFreshness(barsAgo),
        label: 'Price holding higher lows while RSI makes lower lows — bullish continuation.',
      };
    }
  }

  // Bearish divergences — compare swing highs
  const priceHighs = findSwingHighs(closes, idx, lookback);
  const rsiHighs = findSwingHighs(rsis, idx, lookback);

  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const pH1 = priceHighs[priceHighs.length - 2];
    const pH2 = priceHighs[priceHighs.length - 1];
    const rH1 = rsiHighs[rsiHighs.length - 2];
    const rH2 = rsiHighs[rsiHighs.length - 1];

    const barsAgo = idx - pH2.idx;

    // Regular Bearish: price higher high + RSI lower high
    if (pH2.value > pH1.value && rH2.value < rH1.value) {
      return {
        type: 'RegularBearish',
        barsAgo,
        freshness: getFreshness(barsAgo),
        label: 'Price making higher highs while RSI declines — bearish reversal signal.',
      };
    }

    // Hidden Bearish: price lower high + RSI higher high
    if (pH2.value < pH1.value && rH2.value > rH1.value) {
      return {
        type: 'HiddenBearish',
        barsAgo,
        freshness: getFreshness(barsAgo),
        label: 'Price making lower highs while RSI rises — bearish continuation.',
      };
    }
  }

  return none;
}

// ── Master: Compute All Signals for One Bar ─────────────────────

export interface PulseSnapshot {
  bar: PulseBar;
  dots: DotSignals;
  rss: RssSignals;
  sm: SmartMoneySignals;
  astroScore: number;
  techScore: number;
  smScore: number;
  totalScore: number;
  corrState: CorrelationState;
  divergence: DivergenceSignal;
}

export function computePulseSnapshot(
  bars: PulseBar[],
  idx: number,
  dcInferences: DcInferenceEvent[],
  style: TradingStyle,
): PulseSnapshot {
  const bar = bars[idx];
  const prevBar = idx > 0 ? bars[idx - 1] : null;

  const dots = computeDots(bar, prevBar);
  const rss = computeRssSignals(bars, idx);
  const sm = computeSmartMoney(bars, idx);
  const astroScore = computeAstroScore(bar.trade_date, dcInferences);
  const techScore = computeTechScore(bar, rss, sm, style);
  const smScore = computeSmScore(sm);
  const totalScore = astroScore + techScore + smScore;
  const corrState = getCorrelationState(totalScore, style);
  const divergence = detectDivergence(bars, idx);

  return {
    bar, dots, rss, sm,
    astroScore, techScore, smScore, totalScore,
    corrState, divergence,
  };
}

// ── Pre-compute correlation history for all bars ────────────────

export function computeCorrHistory(
  bars: PulseBar[],
  dcInferences: DcInferenceEvent[],
  style: TradingStyle,
): CorrelationState[] {
  return bars.map((_, idx) => {
    const rss = computeRssSignals(bars, idx);
    const sm = computeSmartMoney(bars, idx);
    const astro = computeAstroScore(bars[idx].trade_date, dcInferences);
    const tech = computeTechScore(bars[idx], rss, sm, style);
    const smSc = computeSmScore(sm);
    return getCorrelationState(astro + tech + smSc, style);
  });
}
