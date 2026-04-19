/**
 * Scan Engine — 6 Preset Market Scans
 * ====================================
 * Takes broad market data and applies filter/rank logic per scan.
 * All computation in TypeScript — no backend RPC needed for MVP.
 *
 * Vocabulary (KaalaDristi):
 *   "Smart Money"           — sniper_inst
 *   "Accumulation Signature" — SBD
 *   "Conditions Favorable"   — scan match
 */

import { from } from './postgrest';
import type {
  ScanStock,
  ScanDefinition,
  IndustryEodRow,
  EquitySymbolRow,
  EquityEodSnapshot,
  VaniOpportunityConfig,
} from '@/types';

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';

// ── Scan Definitions ───────────────────────────────────────────

export const SCAN_PRESETS: ScanDefinition[] = [
  {
    id: 'power_buy',
    name: 'Strength Confluence',
    description: 'Stocks where multiple bullish conditions converge in leading or rotating-in industries',
    tooltip: 'Stocks where multiple positive conditions are converging — strong relative strength, accumulation patterns, recent institutional fingerprints, in rotating-in or leading industries. Not a buy recommendation.',
    limit: 25,
  },
  {
    id: 'power_sell',
    name: 'Weakness Confluence',
    description: 'Stocks where multiple bearish conditions converge in lagging or rotating-out industries',
    tooltip: 'Stocks where multiple negative conditions are converging — weakness, distribution, selling pressure, in rotating-out industries. Not a sell recommendation.',
    limit: 25,
  },
  {
    id: 'smart_money',
    name: 'Smart Money Loading',
    description: 'Industries with heavy accumulation and rising institutional presence',
    limit: 25,
  },
  {
    id: 'fresh_breakout',
    name: 'Fresh Breakouts',
    description: 'Stocks breaking above recent highs with strong volume in leading industries',
    limit: 25,
  },
  {
    id: 'quiet_accumulation',
    name: 'Quiet Accumulation',
    description: 'Under-the-radar industries where smart money is quietly building positions',
    limit: 25,
  },
  {
    id: 'distribution_warning',
    name: 'Distribution Warnings',
    description: 'Previously strong stocks showing signs of institutional exit',
    limit: 25,
  },
];

// ── Data Loading ───────────────────────────────────────────────

interface OppConfig {
  ema_atr_band: number;
  reward_min_atr_multiple: number;
  magic_rs_zones: string[];
  flow_types: string[];
  rvol_min: number;
}

const DEFAULT_OPP_CONFIG: OppConfig = {
  ema_atr_band: 1.0,
  reward_min_atr_multiple: 0.0,
  magic_rs_zones: ['Strong Bull', 'Mild Bull'],
  flow_types: ['FRESH_LONGS', 'SHORT_COVERING'],
  rvol_min: 1.2,
};

interface ScanDataBundle {
  industries: IndustryEodRow[];
  industriesHistory: Map<string, IndustryEodRow[]>; // industry → rows by date desc
  symbols: Map<number, EquitySymbolRow>;
  latestEod: Map<number, EquityEodSnapshot>;
  eodHistory: Map<number, EquityEodSnapshot[]>; // equity_id → rows by date desc
  latestDate: string | null;
  oppConfigMap: Map<string, OppConfig>; // presetId → config
}

let _cachedBundle: { data: ScanDataBundle; fetchedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000; // 3 min

// Session-level config cache — presetId → OppConfig, fetched once per page load.
let _oppConfigCache: Map<string, OppConfig> | null = null;

async function fetchOpportunityConfig(): Promise<Map<string, OppConfig>> {
  if (_oppConfigCache) return _oppConfigCache;
  const map = new Map<string, OppConfig>();
  try {
    const res = await fetch(`${PIPELINE_URL}/api/vani-opportunity/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const configs = (await res.json()) as VaniOpportunityConfig[];
    console.log('[scanEngine] raw API configs:', configs.map(c => ({ name: c.config_name, presets: c.applies_to_presets })));
    for (const cfg of configs) {
      const p = cfg.parameters;
      const opp: OppConfig = {
        ema_atr_band: Number(p.atr_multiplier),
        reward_min_atr_multiple: Number(p.min_reward_atr_multiple),
        magic_rs_zones: Array.isArray(p.rs_zones) ? p.rs_zones : DEFAULT_OPP_CONFIG.magic_rs_zones,
        flow_types: Array.isArray(p.flow_types) ? p.flow_types : DEFAULT_OPP_CONFIG.flow_types,
        rvol_min: Number(p.min_rvol),
      };
      for (const presetId of cfg.applies_to_presets) {
        map.set(presetId, opp);
      }
    }
    console.log('[scanEngine] oppConfig map keys:', [...map.keys()]);
  } catch (e) {
    console.warn('[scanEngine] config fetch failed, using defaults:', e);
    for (const preset of SCAN_PRESETS) {
      map.set(preset.id, { ...DEFAULT_OPP_CONFIG });
    }
  }
  _oppConfigCache = map;
  return map;
}

// 3b: Fetch trading dates from km_trading_calendar — exchange-aware, exact count
async function fetchRecentDates(limit: number): Promise<string[]> {
  const { data } = await from('km_trading_calendar')
    .select('trade_date')
    .eq('status', 'completed')
    .eq('exchange', 'NSE')
    .order('trade_date', { ascending: false })
    .limit(limit)
    .execute();

  const rows = (data ?? []) as { trade_date: string }[];
  return rows.map((r) => r.trade_date).sort((a, b) => b.localeCompare(a));
}

async function loadScanData(): Promise<ScanDataBundle> {
  if (_cachedBundle && Date.now() - _cachedBundle.fetchedAt < CACHE_TTL) {
    return _cachedBundle.data;
  }

  // Get last 20 trade dates (enough for all scan lookbacks)
  const dates = await fetchRecentDates(21);
  if (dates.length === 0) {
    const empty: ScanDataBundle = {
      industries: [],
      industriesHistory: new Map(),
      symbols: new Map(),
      latestEod: new Map(),
      eodHistory: new Map(),
      latestDate: null,
      oppConfigMap: new Map(),
    };
    return empty;
  }

  const latestDate = dates[0];
  const oldestDate = dates[dates.length - 1];

  // Parallel fetches — market data + session-cached opportunity config map
  const [industryRes, symbolRes, eodRes, oppConfigMap] = await Promise.all([
    // Industry EOD for last 11 dates
    from('km_industry_eod')
      .select('*')
      .gte('trade_date', dates[Math.min(10, dates.length - 1)])
      .order('trade_date', { ascending: false })
      .limit(1000)
      .execute(),

    // All active equity symbols
    from('km_equity_symbols')
      .select('id,symbol,company_name,industry,exchange,isin,is_active')
      .is('is_active', 'true')
      .limit(8000)
      .execute(),

    // Equity EOD — explicit date list + extended select with ema_20/atr_14/delivery_pct/w52_high
    from('km_equity_eod')
      .select('equity_id,trade_date,open,high,low,close,prev_close,pct_chng,volume,value_cr,rvol,tvol,rsi_14,magic_rs,magic_rs_zone,flow_type,accum_distrib,sniper_inst,sniper_hot,rss_value,rss_spread,sma_150,volume_divergence_flag,ema_20,atr_14,delivery_pct,delivery_qty,w52_high')
      .in('trade_date', dates)
      .order('trade_date', { ascending: false })
      .limit(120000)
      .execute(),

    // VaNi opportunity config — session-cached, fetched from pipeline API
    fetchOpportunityConfig(),
  ]);

  // Process industries
  const allIndustryRows = (industryRes.data ?? []) as IndustryEodRow[];
  const industries = allIndustryRows.filter((r) => r.trade_date === latestDate);
  const industriesHistory = new Map<string, IndustryEodRow[]>();
  for (const r of allIndustryRows) {
    const arr = industriesHistory.get(r.industry) ?? [];
    arr.push(r);
    industriesHistory.set(r.industry, arr);
  }

  // Process symbols
  const symbols = new Map<number, EquitySymbolRow>();
  for (const s of (symbolRes.data ?? []) as EquitySymbolRow[]) {
    symbols.set(s.id, s);
  }

  // Process EOD
  const latestEod = new Map<number, EquityEodSnapshot>();
  const eodHistory = new Map<number, EquityEodSnapshot[]>();
  for (const r of (eodRes.data ?? []) as EquityEodSnapshot[]) {
    const arr = eodHistory.get(r.equity_id) ?? [];
    arr.push(r);
    eodHistory.set(r.equity_id, arr);
    if (r.trade_date === latestDate && !latestEod.has(r.equity_id)) {
      latestEod.set(r.equity_id, r);
    }
  }

  const bundle: ScanDataBundle = {
    industries,
    industriesHistory,
    symbols,
    latestEod,
    eodHistory,
    latestDate,
    oppConfigMap,
  };

  _cachedBundle = { data: bundle, fetchedAt: Date.now() };
  return bundle;
}

// ── 3c: VaNi Opportunity evaluation ───────────────────────────

let _oppDiagCount = 0;

function evaluateOpportunity(stock: Omit<ScanStock, 'vaniOpportunity'>, config: OppConfig): boolean {
  if (!stock.ema_20 || !stock.atr_14 || stock.atr_14 <= 0) return false;
  const isBearish = config.flow_types.some(f => f === 'FRESH_SHORTS' || f === 'LONG_LIQUIDATION');
  const withinBand =
    stock.close >= stock.ema_20 - config.ema_atr_band * stock.atr_14 &&
    stock.close <= stock.ema_20 + config.ema_atr_band * stock.atr_14;
  // Bullish: upside runway = (ema20 + atr14) - close
  // Bearish: downside runway = close - (ema20 - atr14)
  const runway = isBearish
    ? stock.close - (stock.ema_20 - stock.atr_14)
    : (stock.ema_20 + stock.atr_14) - stock.close;
  const hasReward = runway > config.reward_min_atr_multiple * stock.atr_14;
  const zoneOk = config.magic_rs_zones.includes(stock.magic_rs_zone ?? '');
  const flowOk = config.flow_types.includes(stock.flow_type ?? '');
  const rvolOk = (stock.rvol ?? 0) >= config.rvol_min;
  const result = withinBand && hasReward && zoneOk && flowOk && rvolOk;
  if (!isBearish && !result && _oppDiagCount < 5) {
    _oppDiagCount++;
    console.log(`[scanEngine] VaNi miss (${stock.symbol}): band=${withinBand} reward=${hasReward} zone=${zoneOk}(${stock.magic_rs_zone}) flow=${flowOk}(${stock.flow_type}) rvol=${rvolOk}(${stock.rvol?.toFixed(2)}) ema=${stock.ema_20?.toFixed(1)} atr=${stock.atr_14?.toFixed(1)}`);
  }
  return result;
}

// ── Helper: DOT detection in history ───────────────────────────
// Per-stock lookback copy of the canonical DOT logic.
// Source of truth: visualPulseEngine.ts computeDots()
// SQL copy:        km_migration_033_industry_eod.sql dot_signals CTE
// If you change a threshold, update all three locations.

function hasDotInHistory(
  history: EquityEodSnapshot[],
  dotType: 'svd' | 'sbd' | 'syd',
  lookback: number,
): boolean {
  const bars = history.slice(0, lookback + 1); // already sorted desc
  for (let i = 0; i < bars.length - 1 && i < lookback; i++) {
    const bar = bars[i];
    const prev = bars[i + 1];
    if (!bar || !prev) continue;

    const range = bar.high - bar.low;
    if (range <= 0) continue;
    const bodyRatio = Math.abs(bar.close - bar.open) / range;

    if (dotType === 'svd') {
      if (
        (bar.rvol ?? 0) > 10 &&
        bar.close > (bar.high + bar.low) / 2 &&
        prev.close > 0 && bar.close > prev.close * 1.02 &&
        bodyRatio >= 0.5 &&
        bar.close > bar.open
      ) return true;
    } else if (dotType === 'sbd') {
      if (
        (bar.rvol ?? 0) >= 3 && (bar.rvol ?? 0) < 10 &&
        bar.close > bar.open &&
        bar.close > bar.high - range / 3 &&
        bodyRatio >= 0.45
      ) return true;
    } else if (dotType === 'syd') {
      if (
        bar.close < prev.close &&
        (bar.rvol ?? 0) >= 2 &&
        bar.close < bar.low + range / 3
      ) return true;
    }
  }
  return false;
}

// ── Helper: Industry classifications ───────────────────────────

function getIndustryClassifications(bundle: ScanDataBundle) {
  const total = bundle.industries.length;
  const topQuartileCutoff = Math.ceil(total / 4);
  const bottomQuartileCutoff = total - topQuartileCutoff;

  // Compare with ~5 days ago for rotation detection
  const rotatingIn = new Set<string>();
  const rotatingOut = new Set<string>();
  const leading = new Set<string>();
  const lagging = new Set<string>();

  for (const ind of bundle.industries) {
    const history = bundle.industriesHistory.get(ind.industry) ?? [];
    const oldRow = history.length > 4 ? history[Math.min(4, history.length - 1)] : null;
    const rankChange = oldRow ? oldRow.industry_rank - ind.industry_rank : 0;

    if (rankChange >= 5) rotatingIn.add(ind.industry);
    if (rankChange <= -5) rotatingOut.add(ind.industry);
    if (ind.industry_rank <= topQuartileCutoff) leading.add(ind.industry);
    if (ind.industry_rank > bottomQuartileCutoff) lagging.add(ind.industry);
  }

  return { rotatingIn, rotatingOut, leading, lagging, topQuartileCutoff };
}

// ── Build ScanStock from equity data ───────────────────────────

function buildScanStock(
  equityId: number,
  bundle: ScanDataBundle,
  presetId: string,
): ScanStock | null {
  const eod = bundle.latestEod.get(equityId);
  const sym = bundle.symbols.get(equityId);
  if (!eod || !sym) return null;

  const history = bundle.eodHistory.get(equityId) ?? [];

  // 3c: Computed financial fields
  const ema20 = eod.ema_20 ?? null;
  const atr14 = eod.atr_14 ?? null;
  const reward = (ema20 && atr14) ? (ema20 + atr14) - eod.close : null;
  const rewardPct = (ema20 && atr14 && atr14 > 0) ? ((ema20 + atr14) - eod.close) / atr14 : null;
  const pctBelow52wHigh = (eod.w52_high && eod.w52_high > 0)
    ? ((eod.w52_high - eod.close) / eod.w52_high) * 100
    : null;

  const magicRsTrend: (boolean | null)[] = history.slice(0, 5).map((h, i) =>
    h.magic_rs != null && (history[i + 1]?.magic_rs ?? null) != null
      ? h.magic_rs > history[i + 1].magic_rs!
      : null,
  );

  const partial: Omit<ScanStock, 'vaniOpportunity'> = {
    equity_id: equityId,
    symbol: sym.symbol,
    company_name: sym.company_name,
    industry: sym.industry,
    exchange: sym.exchange ?? null,
    close: eod.close,
    pct_chng: eod.pct_chng,
    rsi_14: eod.rsi_14,
    magic_rs: eod.magic_rs,
    magic_rs_zone: eod.magic_rs_zone,
    flow_type: eod.flow_type,
    rvol: eod.rvol,
    sniper_inst: eod.sniper_inst,
    sniper_hot: eod.sniper_hot ?? null,
    accum_distrib: eod.accum_distrib,
    rss_value: eod.rss_value,
    rss_spread: eod.rss_spread,
    sma_150: eod.sma_150,
    volume_divergence_flag: eod.volume_divergence_flag,
    has_recent_svd: hasDotInHistory(history, 'svd', 5),
    has_recent_sbd: hasDotInHistory(history, 'sbd', 5),
    has_recent_syd: hasDotInHistory(history, 'syd', 5),
    ema_20: ema20,
    atr_14: atr14,
    delivery_pct: eod.delivery_pct ?? null,
    w52_high: eod.w52_high ?? null,
    magicRsTrend,
    reward,
    rewardPct,
    pctBelow52wHigh,
  };

  const presetCfg = bundle.oppConfigMap.get(presetId) ?? null;
  if (!presetCfg) {
    console.warn(`[scanEngine] no OppConfig for presetId="${presetId}" — map keys: [${[...bundle.oppConfigMap.keys()].join(', ')}]`);
  }
  return { ...partial, vaniOpportunity: presetCfg ? evaluateOpportunity(partial, presetCfg) : false };
}

// ── Scan Implementations ───────────────────────────────────────

// FILTER LOGIC NOTE:
// accum_distrib captures classical Wyckoff accumulation (price below
// Golden Line + 3x volume + bullish momentum). This signal is naturally
// rare — typically 1-5% of stocks meet it on any given day.
//
// The OR clause captures the broader bullish confluence pattern that
// traders also recognize as strength building: above Golden Line,
// strong/mild bull RS zone, bullish flow type, elevated volume.
//
// Both paths surface stocks worth attention; the strict path is high
// conviction, the confluence path is broader signal.

/** Scan 1: Strength Confluence */
function scanPowerBuy(bundle: ScanDataBundle): ScanStock[] {
  const { rotatingIn, leading } = getIndustryClassifications(bundle);
  const eligible = new Set([...rotatingIn, ...leading]);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'power_buy');
    if (!stock || !stock.industry) continue;

    // Industry gate (unchanged)
    if (!eligible.has(stock.industry)) continue;

    // Path 1: Strict Wyckoff accumulation (rare, high conviction)
    const wyckoffAccumulation = stock.accum_distrib === 'ACCUMULATION';

    // Path 2: Broader bullish confluence (common, also valid)
    const bullishConfluence =
      stock.sma_150 != null && stock.close > stock.sma_150 &&
      ['Strong Bull', 'Mild Bull'].includes(stock.magic_rs_zone ?? '') &&
      ['FRESH_LONGS', 'SHORT_COVERING'].includes(stock.flow_type ?? '') &&
      (stock.rvol ?? 0) > 1.5;

    if (!wyckoffAccumulation && !bullishConfluence) continue;
    results.push(stock);
  }

  return results
    .sort((a, b) => (b.magic_rs ?? 0) - (a.magic_rs ?? 0))
    .slice(0, 25);
}

// FILTER LOGIC NOTE (mirror of Strength Confluence):
// accum_distrib = 'DISTRIBUTION' captures classical Wyckoff distribution.
// The OR clause captures broader bearish confluence: below Golden Line,
// strong/mild bear RS zone, bearish flow type, elevated volume.

/** Scan 2: Weakness Confluence */
function scanPowerSell(bundle: ScanDataBundle): ScanStock[] {
  const { rotatingOut, lagging } = getIndustryClassifications(bundle);
  const eligible = new Set([...rotatingOut, ...lagging]);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'power_sell');
    if (!stock || !stock.industry) continue;

    // Industry gate (unchanged)
    if (!eligible.has(stock.industry)) continue;

    // Path 1: Strict Wyckoff distribution (rare, high conviction)
    const wyckoffDistribution = stock.accum_distrib === 'DISTRIBUTION';

    // Path 2: Broader bearish confluence (common, also valid)
    const bearishConfluence =
      stock.sma_150 != null && stock.close < stock.sma_150 &&
      ['Strong Bear', 'Mild Bear'].includes(stock.magic_rs_zone ?? '') &&
      ['FRESH_SHORTS', 'LONG_LIQUIDATION'].includes(stock.flow_type ?? '') &&
      (stock.rvol ?? 0) > 1.5;

    if (!wyckoffDistribution && !bearishConfluence) continue;
    results.push(stock);
  }

  return results
    .sort((a, b) => (a.magic_rs ?? 0) - (b.magic_rs ?? 0))
    .slice(0, 25);
}

/** Scan 3: Smart Money Loading */
function scanSmartMoney(bundle: ScanDataBundle): ScanStock[] {
  // Industries with pct_accumulation > 60
  const accumulatingIndustries = new Set(
    bundle.industries
      .filter((i) => (i.pct_accumulation ?? 0) > 60)
      .map((i) => i.industry)
  );

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'smart_money');
    if (!stock || !stock.industry) continue;
    if (!accumulatingIndustries.has(stock.industry)) continue;

    // THRESHOLD CALIBRATION NOTE:
    // sniper_inst ranges 0-40 in km_equity_eod (avg ~5.4 as of Apr 2026).
    // Threshold 20 = top ~8% of the universe. The previous threshold of 50
    // was theoretical (assumed 0-100 RSI scale) and never triggered with
    // actual data.
    if ((stock.sniper_inst ?? 0) <= 20) continue;

    // sniper_inst rising over last 5 bars
    const history = bundle.eodHistory.get(id) ?? [];
    const sniperNow = history[0]?.sniper_inst ?? 0;
    const sniper5 = history.length > 4 ? (history[4]?.sniper_inst ?? 0) : 0;
    const sniperSlope = sniperNow - sniper5;
    if (sniperSlope <= 0) continue;

    // rss_value recovering from < 30 (now > 30)
    const rssNow = stock.rss_value ?? 0;
    const hadLowRss = history.slice(0, 6).some((h) => (h.rss_value ?? 100) < 30);
    if (rssNow <= 30 || !hadLowRss) continue;

    const rssRecovery = rssNow - 30;
    const score = sniperSlope * rssRecovery;
    results.push({ ...stock, _sortScore: score } as ScanStock & { _sortScore: number });
  }

  return results
    .sort((a, b) => ((b as any)._sortScore ?? 0) - ((a as any)._sortScore ?? 0))
    .slice(0, 25);
}

/** Scan 4: Fresh Breakouts */
function scanFreshBreakout(bundle: ScanDataBundle): ScanStock[] {
  const { leading } = getIndustryClassifications(bundle);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'fresh_breakout');
    if (!stock || !stock.industry) continue;
    if (!leading.has(stock.industry)) continue;
    if ((stock.rvol ?? 0) <= 2) continue;

    // close > 20-day high
    const history = bundle.eodHistory.get(id) ?? [];
    const closesLast20 = history.slice(1, 21).map((h) => h.close);
    const high20 = closesLast20.length > 0 ? Math.max(...closesLast20) : Infinity;
    if (stock.close <= high20) continue;

    // close > sma_150
    const eod = bundle.latestEod.get(id);
    if (eod && eod.sma_150 && stock.close <= eod.sma_150) continue;

    results.push(stock);
  }

  return results
    .sort((a, b) => (b.rvol ?? 0) - (a.rvol ?? 0))
    .slice(0, 25);
}

/** Scan 5: Quiet Accumulation (contrarian) */
function scanQuietAccumulation(bundle: ScanDataBundle): ScanStock[] {
  const { topQuartileCutoff } = getIndustryClassifications(bundle);

  // Industries NOT in top quartile with rising pct_accumulation
  const eligibleIndustries = new Map<string, number>();
  for (const ind of bundle.industries) {
    if (ind.industry_rank <= topQuartileCutoff) continue;

    const history = bundle.industriesHistory.get(ind.industry) ?? [];
    const accNow = ind.pct_accumulation ?? 0;
    const acc5 = history.length > 4 ? (history[4]?.pct_accumulation ?? 0) : 0;
    const accChange = accNow - acc5;
    if (accChange <= 0) continue;

    eligibleIndustries.set(ind.industry, accChange);
  }

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'quiet_accumulation');
    if (!stock || !stock.industry) continue;
    if (!eligibleIndustries.has(stock.industry)) continue;
    if (stock.accum_distrib !== 'ACCUMULATION') continue;

    // sniper_inst trending up
    const history = bundle.eodHistory.get(id) ?? [];
    const sniperNow = history[0]?.sniper_inst ?? 0;
    const sniper5 = history.length > 4 ? (history[4]?.sniper_inst ?? 0) : 0;
    if (sniperNow <= sniper5) continue;

    const accChange = eligibleIndustries.get(stock.industry) ?? 0;
    results.push({ ...stock, _sortScore: accChange } as ScanStock & { _sortScore: number });
  }

  return results
    .sort((a, b) => ((b as any)._sortScore ?? 0) - ((a as any)._sortScore ?? 0))
    .slice(0, 25);
}

/** Scan 6: Distribution Warnings */
function scanDistributionWarning(bundle: ScanDataBundle): ScanStock[] {
  const results: ScanStock[] = [];

  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'distribution_warning');
    if (!stock) continue;

    // Current zone NOT Strong Bull (degraded)
    const zone = stock.magic_rs_zone;
    if (!zone || zone === 'Strong Bull' || zone === 'Strong Bear') continue;
    if (!['Mild Bull', 'Neutral', 'Mild Bear'].includes(zone)) continue;

    // Was in Strong Bull 10 days ago
    const history = bundle.eodHistory.get(id) ?? [];
    const bar10 = history.length > 9 ? history[9] : null;
    if (!bar10 || bar10.magic_rs_zone !== 'Strong Bull') continue;

    // Has SYD in last 5 bars OR volume_div_down
    if (!stock.has_recent_syd && stock.volume_divergence_flag !== 'VOLUME_DIV_DOWN') continue;

    // Score: rank_drop * abs(magic_rs_change)
    const magicRsNow = stock.magic_rs ?? 0;
    const magicRs10 = bar10.magic_rs ?? 0;
    const magicRsChange = Math.abs(magicRsNow - magicRs10);

    // Get industry rank drop
    const sym = bundle.symbols.get(id);
    const indNow = sym?.industry ? bundle.industries.find((i) => i.industry === sym.industry) : null;
    const indHistory = sym?.industry ? bundle.industriesHistory.get(sym.industry) ?? [] : [];
    const ind10 = indHistory.length > 9 ? indHistory[9] : null;
    const rankDrop = indNow && ind10 ? ind10.industry_rank - indNow.industry_rank : 0;

    const score = Math.abs(rankDrop) * magicRsChange;
    results.push({ ...stock, _sortScore: score } as ScanStock & { _sortScore: number });
  }

  return results
    .sort((a, b) => ((b as any)._sortScore ?? 0) - ((a as any)._sortScore ?? 0))
    .slice(0, 25);
}

// ── Public API ─────────────────────────────────────────────────

const SCAN_FUNCTIONS: Record<string, (bundle: ScanDataBundle) => ScanStock[]> = {
  power_buy: scanPowerBuy,
  power_sell: scanPowerSell,
  smart_money: scanSmartMoney,
  fresh_breakout: scanFreshBreakout,
  quiet_accumulation: scanQuietAccumulation,
  distribution_warning: scanDistributionWarning,
};

/**
 * Deduplicate scan results by ISIN (prefer NSE over BSE).
 * For Combined mode, ensures one row per company.
 */
function deduplicateByIsin(stocks: ScanStock[], symbols: Map<number, EquitySymbolRow>): ScanStock[] {
  const seen = new Map<string, ScanStock>();
  for (const stock of stocks) {
    const sym = symbols.get(stock.equity_id);
    const isin = sym?.isin;
    if (!isin) {
      // No ISIN — keep as-is (won't deduplicate)
      seen.set(`_noisn_${stock.equity_id}`, stock);
      continue;
    }
    const existing = seen.get(isin);
    if (!existing) {
      seen.set(isin, stock);
    } else if (stock.exchange === 'NSE' && existing.exchange !== 'NSE') {
      seen.set(isin, stock); // NSE preferred
    }
  }
  return [...seen.values()];
}

export type ExchangeFilter = 'combined' | 'NSE' | 'BSE';

export async function executeScan(scanId: string, exchangeFilter: ExchangeFilter = 'combined'): Promise<ScanStock[]> {
  const fn = SCAN_FUNCTIONS[scanId];
  if (!fn) throw new Error(`Unknown scan: ${scanId}`);

  const bundle = await loadScanData();
  let results = fn(bundle);

  if (exchangeFilter === 'combined') {
    results = deduplicateByIsin(results, bundle.symbols);
  } else {
    results = results.filter((s) => s.exchange === exchangeFilter);
  }

  return results;
}

/** Invalidate scan data cache (call after data refresh) */
export function invalidateScanCache(): void {
  _cachedBundle = null;
  _oppConfigCache = null;
  _oppDiagCount = 0;
}

export interface ScanCountsResult {
  counts: Record<string, number>;
  latestDate: string | null;
}

/** Return result counts for all 6 scans — uses shared cached data */
export async function getAllScanCounts(exchangeFilter: ExchangeFilter = 'combined'): Promise<ScanCountsResult> {
  const bundle = await loadScanData();
  const counts: Record<string, number> = {};
  for (const [id, fn] of Object.entries(SCAN_FUNCTIONS)) {
    let results = fn(bundle);
    if (exchangeFilter === 'combined') {
      results = deduplicateByIsin(results, bundle.symbols);
    } else {
      results = results.filter((s) => s.exchange === exchangeFilter);
    }
    counts[id] = results.length;
  }
  return { counts, latestDate: bundle.latestDate };
}

// ── Manipulation Watch ────────────────────────────────────────
// Separate from scanner presets — safety feature, not opportunity.
// No industry filter: manipulation can happen anywhere.
// Scans across a date range (default 30 trading days) to catch
// patterns that play out over days/weeks.

export interface ManipulationWatchStock extends ScanStock {
  whyFlagged: string[];
  triggerDates: string[];   // dates where conditions were met (desc order)
  triggerCount: number;     // how many days in range the stock triggered
  latestTrigger: string;    // most recent trigger date
}

export interface ManipulationWatchResult {
  pumpSuspects: ManipulationWatchStock[];
  dumpSuspects: ManipulationWatchStock[];
  latestDate: string | null;
  lookbackDays: number;
}

// Separate cache for manipulation watch (wider date range than scanner)
let _mwCache: { data: ManipulationWatchBundle; fetchedAt: number; lookback: number } | null = null;

interface ManipulationWatchBundle {
  symbols: Map<number, EquitySymbolRow>;
  // equity_id → array of snapshots sorted by date desc
  eodHistory: Map<number, EquityEodSnapshot[]>;
  tradeDates: string[]; // all trade dates in range, desc order
}

async function loadManipulationData(lookbackDays: number): Promise<ManipulationWatchBundle> {
  if (_mwCache && Date.now() - _mwCache.fetchedAt < CACHE_TTL && _mwCache.lookback === lookbackDays) {
    return _mwCache.data;
  }

  // Fetch lookback + 6 dates (extra for sniper slope calculation)
  const dates = await fetchRecentDates(lookbackDays + 6);
  if (dates.length === 0) {
    return { symbols: new Map(), eodHistory: new Map(), tradeDates: [] };
  }

  const oldestDate = dates[dates.length - 1];

  const [symbolRes, eodRes] = await Promise.all([
    from('km_equity_symbols')
      .select('id,symbol,company_name,industry,exchange,isin,is_active')
      .is('is_active', 'true')
      .limit(8000)
      .execute(),

    from('km_equity_eod')
      .select('equity_id,trade_date,open,high,low,close,prev_close,pct_chng,volume,value_cr,rvol,tvol,rsi_14,magic_rs,magic_rs_zone,flow_type,accum_distrib,sniper_inst,sniper_hot,rss_value,rss_spread,sma_150,volume_divergence_flag')
      .gte('trade_date', oldestDate)
      .order('trade_date', { ascending: false })
      .limit(lookbackDays * 8000) // ~8K equities × N days
      .execute(),
  ]);

  const symbols = new Map<number, EquitySymbolRow>();
  for (const s of (symbolRes.data ?? []) as EquitySymbolRow[]) {
    symbols.set(s.id, s);
  }

  const eodHistory = new Map<number, EquityEodSnapshot[]>();
  for (const r of (eodRes.data ?? []) as EquityEodSnapshot[]) {
    const arr = eodHistory.get(r.equity_id) ?? [];
    arr.push(r);
    eodHistory.set(r.equity_id, arr);
  }

  const bundle: ManipulationWatchBundle = {
    symbols,
    eodHistory,
    tradeDates: dates.slice(0, lookbackDays), // only the lookback range (not the buffer dates)
  };

  _mwCache = { data: bundle, fetchedAt: Date.now(), lookback: lookbackDays };
  return bundle;
}

/**
 * Eligibility gate — manipulation requires operator capability.
 * Large-caps with deep float can't be operator-pumped/dumped.
 *
 * Uses value_cr (daily turnover in crores) when available (~50% populated).
 * Falls back to volume × close proxy when value_cr is NULL.
 *
 *   > 25 cr daily = too liquid for operator manipulation
 *   < 1 cr daily = untradeable noise
 */
function isOperatorEligible(eod: EquityEodSnapshot): boolean {
  const turnover = eod.value_cr;

  if (turnover != null && turnover > 0) {
    return turnover >= 1 && turnover <= 25;
  }

  // Fallback: compute turnover proxy from volume × close
  const proxyCr = ((eod.volume ?? 0) * eod.close) / 1e7;
  return proxyCr >= 1 && proxyCr <= 25;
}

/** Check pump conditions for a single EOD snapshot */
function isPumpSignal(eod: EquityEodSnapshot): boolean {
  if (!isOperatorEligible(eod)) return false;
  return (
    (eod.rss_value ?? 0) > 75 &&
    (eod.rss_spread ?? 0) < -200 &&
    eod.flow_type === 'SHORT_COVERING' &&
    eod.volume_divergence_flag === 'VOLUME_DIV_UP'
  );
}

/** Check dump conditions for a single EOD snapshot.
 *  sniper_slope check removed — sniper_inst is structurally floored at 0
 *  for oversold stocks (derived from RSI-9 above 61). See LESSONS_LEARNED. */
function isDumpSignal(eod: EquityEodSnapshot): boolean {
  if (!isOperatorEligible(eod)) return false;
  if ((eod.rss_value ?? 100) >= 25) return false;
  if (eod.flow_type !== 'LONG_LIQUIDATION') return false;
  if (eod.volume_divergence_flag !== 'VOLUME_DIV_DOWN') return false;
  return true;
}

/** Build why-flagged tags for a pump signal */
function buildPumpTags(eod: EquityEodSnapshot): string[] {
  const rssVal = eod.rss_value ?? 0;
  const rssSpread = eod.rss_spread ?? 0;
  return [
    `RSS overbought (${Math.round(rssVal)})`,
    `Spread broken (${rssSpread > -1000 ? rssSpread.toFixed(0) : (rssSpread / 1000).toFixed(1) + 'K'})`,
    'Short covering',
    'Volume diverging up',
  ];
}

/** Build why-flagged tags for a dump signal */
function buildDumpTags(eod: EquityEodSnapshot): string[] {
  const rssVal = eod.rss_value ?? 0;
  return [
    `RSS oversold (${Math.round(rssVal)})`,
    'Long liquidation',
    'Volume diverging down',
  ];
}

/** Build a ScanStock-like object from any EOD snapshot (not just latest) */
function buildStockFromEod(
  equityId: number,
  eod: EquityEodSnapshot,
  history: EquityEodSnapshot[],
  sym: EquitySymbolRow,
): ScanStock {
  return {
    equity_id: equityId,
    symbol: sym.symbol,
    company_name: sym.company_name,
    industry: sym.industry,
    exchange: sym.exchange ?? null,
    close: eod.close,
    pct_chng: eod.pct_chng,
    rsi_14: eod.rsi_14,
    magic_rs: eod.magic_rs,
    magic_rs_zone: eod.magic_rs_zone,
    flow_type: eod.flow_type,
    rvol: eod.rvol,
    sniper_inst: eod.sniper_inst,
    accum_distrib: eod.accum_distrib,
    rss_value: eod.rss_value,
    rss_spread: eod.rss_spread,
    sma_150: eod.sma_150,
    volume_divergence_flag: eod.volume_divergence_flag,
    has_recent_svd: false,
    has_recent_sbd: false,
    has_recent_syd: false,
    sniper_hot: null,
    ema_20: null,
    atr_14: null,
    delivery_pct: null,
    w52_high: null,
    magicRsTrend: [],
    reward: null,
    rewardPct: null,
    pctBelow52wHigh: null,
    vaniOpportunity: false,
  };
}

/** Execute Manipulation Watch — scans across lookbackDays trading days */
export async function executeManipulationWatch(lookbackDays: number = 30): Promise<ManipulationWatchResult> {
  const bundle = await loadManipulationData(lookbackDays);

  // Track triggers per stock: equity_id → { dates, latestEod, tags }
  const pumpMap = new Map<number, { dates: string[]; eod: EquityEodSnapshot; tags: string[] }>();
  const dumpMap = new Map<number, { dates: string[]; eod: EquityEodSnapshot; tags: string[] }>();

  for (const [equityId, history] of bundle.eodHistory) {
    const sym = bundle.symbols.get(equityId);
    if (!sym) continue;

    // Iterate over each date in the lookback range
    for (let i = 0; i < history.length; i++) {
      const eod = history[i];
      if (!bundle.tradeDates.includes(eod.trade_date)) continue; // skip buffer dates

      // Check pump
      if (isPumpSignal(eod)) {
        const existing = pumpMap.get(equityId);
        if (existing) {
          existing.dates.push(eod.trade_date);
        } else {
          pumpMap.set(equityId, {
            dates: [eod.trade_date],
            eod, // first hit = most recent (history sorted desc)
            tags: buildPumpTags(eod),
          });
        }
      }

      // Check dump
      if (isDumpSignal(eod)) {
        const existing = dumpMap.get(equityId);
        if (existing) {
          existing.dates.push(eod.trade_date);
        } else {
          dumpMap.set(equityId, {
            dates: [eod.trade_date],
            eod,
            tags: buildDumpTags(eod),
          });
        }
      }
    }
  }

  // Convert to result arrays
  const buildResult = (
    map: Map<number, { dates: string[]; eod: EquityEodSnapshot; tags: string[] }>,
  ): ManipulationWatchStock[] => {
    const results: ManipulationWatchStock[] = [];
    for (const [equityId, trigger] of map) {
      const sym = bundle.symbols.get(equityId);
      if (!sym) continue;
      const history = bundle.eodHistory.get(equityId) ?? [];
      const stock = buildStockFromEod(equityId, trigger.eod, history, sym);
      results.push({
        ...stock,
        whyFlagged: trigger.tags,
        triggerDates: trigger.dates,
        triggerCount: trigger.dates.length,
        latestTrigger: trigger.dates[0],
      });
    }
    // Sort: most frequent triggers first, then by rvol
    return results
      .sort((a, b) => b.triggerCount - a.triggerCount || (b.rvol ?? 0) - (a.rvol ?? 0))
      .slice(0, 50); // higher limit for range scan
  };

  let pumpSuspects = buildResult(pumpMap);
  let dumpSuspects = buildResult(dumpMap);

  // Deduplicate by ISIN
  pumpSuspects = deduplicateByIsin(pumpSuspects, bundle.symbols) as ManipulationWatchStock[];
  dumpSuspects = deduplicateByIsin(dumpSuspects, bundle.symbols) as ManipulationWatchStock[];

  return {
    pumpSuspects,
    dumpSuspects,
    latestDate: bundle.tradeDates[0] ?? null,
    lookbackDays,
  };
}
