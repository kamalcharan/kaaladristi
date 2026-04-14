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
} from '@/types';

// ── Scan Definitions ───────────────────────────────────────────

export const SCAN_PRESETS: ScanDefinition[] = [
  {
    id: 'power_buy',
    name: 'Power Buy Setups',
    description: 'Strong momentum stocks in leading or rotating-in industries with accumulation signals',
    limit: 25,
  },
  {
    id: 'power_sell',
    name: 'Power Sell Setups',
    description: 'Weakening stocks in lagging industries with distribution warnings',
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

interface ScanDataBundle {
  industries: IndustryEodRow[];
  industriesHistory: Map<string, IndustryEodRow[]>; // industry → rows by date desc
  symbols: Map<number, EquitySymbolRow>;
  latestEod: Map<number, EquityEodSnapshot>;
  eodHistory: Map<number, EquityEodSnapshot[]>; // equity_id → rows by date desc
  latestDate: string | null;
}

let _cachedBundle: { data: ScanDataBundle; fetchedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000; // 3 min

async function fetchRecentDates(limit: number): Promise<string[]> {
  const { data, error } = await from('km_equity_eod')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(limit * 1500) // overfetch for dedup
    .execute();

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { trade_date: string }[];
  const unique = [...new Set(rows.map((r) => r.trade_date))];
  unique.sort((a: string, b: string) => b.localeCompare(a));
  return unique.slice(0, limit);
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
    };
    return empty;
  }

  const latestDate = dates[0];
  const oldestDate = dates[dates.length - 1];

  // Parallel fetches
  const [industryRes, symbolRes, eodRes] = await Promise.all([
    // Industry EOD for last 10 days
    from('km_industry_eod')
      .select('*')
      .gte('trade_date', dates[Math.min(10, dates.length - 1)])
      .order('trade_date', { ascending: false })
      .limit(1000)
      .execute(),

    // All active equity symbols
    from('km_equity_symbols')
      .select('id,symbol,company_name,industry,is_active')
      .is('is_active', 'true')
      .limit(2000)
      .execute(),

    // Equity EOD for last 20 dates
    from('km_equity_eod')
      .select('equity_id,trade_date,open,high,low,close,prev_close,pct_chng,volume,rvol,tvol,magic_rs,magic_rs_zone,flow_type,accum_distrib,sniper_inst,sniper_hot,rss_value,sma_150,volume_divergence_flag')
      .gte('trade_date', oldestDate)
      .order('trade_date', { ascending: false })
      .limit(30000)
      .execute(),
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
  };

  _cachedBundle = { data: bundle, fetchedAt: Date.now() };
  return bundle;
}

// ── Helper: DOT detection in history ───────────────────────────

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
): ScanStock | null {
  const eod = bundle.latestEod.get(equityId);
  const sym = bundle.symbols.get(equityId);
  if (!eod || !sym) return null;

  const history = bundle.eodHistory.get(equityId) ?? [];

  return {
    equity_id: equityId,
    symbol: sym.symbol,
    company_name: sym.company_name,
    industry: sym.industry,
    close: eod.close,
    pct_chng: eod.pct_chng,
    magic_rs: eod.magic_rs,
    magic_rs_zone: eod.magic_rs_zone,
    flow_type: eod.flow_type,
    rvol: eod.rvol,
    sniper_inst: eod.sniper_inst,
    accum_distrib: eod.accum_distrib,
    rss_value: eod.rss_value,
    volume_divergence_flag: eod.volume_divergence_flag,
    has_recent_svd: hasDotInHistory(history, 'svd', 5),
    has_recent_sbd: hasDotInHistory(history, 'sbd', 5),
    has_recent_syd: hasDotInHistory(history, 'syd', 5),
  };
}

// ── Scan Implementations ───────────────────────────────────────

/** Scan 1: Power Buy Setups */
function scanPowerBuy(bundle: ScanDataBundle): ScanStock[] {
  const { rotatingIn, leading } = getIndustryClassifications(bundle);
  const eligible = new Set([...rotatingIn, ...leading]);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle);
    if (!stock || !stock.industry) continue;
    if (!eligible.has(stock.industry)) continue;
    if (stock.magic_rs_zone !== 'Strong Bull') continue;
    if (stock.accum_distrib !== 'ACCUMULATION') continue;
    if (!stock.has_recent_svd && !stock.has_recent_sbd) continue;
    results.push(stock);
  }

  return results
    .sort((a, b) => (b.magic_rs ?? 0) - (a.magic_rs ?? 0))
    .slice(0, 25);
}

/** Scan 2: Power Sell Setups */
function scanPowerSell(bundle: ScanDataBundle): ScanStock[] {
  const { rotatingOut, lagging } = getIndustryClassifications(bundle);
  const eligible = new Set([...rotatingOut, ...lagging]);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle);
    if (!stock || !stock.industry) continue;
    if (!eligible.has(stock.industry)) continue;
    if (stock.magic_rs_zone !== 'Strong Bear') continue;
    if (stock.accum_distrib !== 'DISTRIBUTION') continue;
    if (!stock.has_recent_syd && stock.volume_divergence_flag !== 'VOLUME_DIV_DOWN') continue;
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
    const stock = buildScanStock(id, bundle);
    if (!stock || !stock.industry) continue;
    if (!accumulatingIndustries.has(stock.industry)) continue;

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
    const stock = buildScanStock(id, bundle);
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
    const stock = buildScanStock(id, bundle);
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
    const stock = buildScanStock(id, bundle);
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

export async function executeScan(scanId: string): Promise<ScanStock[]> {
  const fn = SCAN_FUNCTIONS[scanId];
  if (!fn) throw new Error(`Unknown scan: ${scanId}`);

  const bundle = await loadScanData();
  return fn(bundle);
}

/** Invalidate scan data cache (call after data refresh) */
export function invalidateScanCache(): void {
  _cachedBundle = null;
}
