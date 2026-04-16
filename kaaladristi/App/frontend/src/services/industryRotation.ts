/**
 * Industry Rotation Service
 * =========================
 * Fetches km_industry_eod data and computes rotation categories:
 *   - Rotating In:  rank improved 5+ in last N days
 *   - Leading:      top quartile by avg_magic_rs today
 *   - Rotating Out: rank dropped 5+ in last N days
 *
 * Also fetches stock-level data for inline industry expansion.
 */

import { from } from './postgrest';
import type {
  IndustryEodRow,
  IndustryRotationItem,
  RotationCategory,
  EquityEodSnapshot,
  EquitySymbolRow,
} from '@/types';

/** Single config value — V2 will make this user-toggleable */
export const INDUSTRY_ROTATION_LOOKBACK_DAYS = 5;

// ── Data Fetching ──────────────────────────────────────────────

/** Fetch all industry EOD rows for a specific date */
async function fetchIndustryEodForDate(date: string): Promise<IndustryEodRow[]> {
  const { data, error } = await from('km_industry_eod')
    .select('*')
    .eq('trade_date', date)
    .order('industry_rank', { ascending: true })
    .execute();

  if (error) throw new Error(`Industry EOD fetch failed: ${error.message}`);
  return (data ?? []) as IndustryEodRow[];
}

/** Fetch the latest N distinct trade dates from km_industry_eod */
async function fetchRecentTradeDates(limit: number): Promise<string[]> {
  const { data, error } = await from('km_industry_eod')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(limit * 60) // overfetch to handle duplicates
    .execute();

  if (error) throw new Error(`Trade dates fetch failed: ${error.message}`);

  const rows = (data ?? []) as { trade_date: string }[];
  const unique = [...new Set(rows.map((r) => r.trade_date))];
  unique.sort((a: string, b: string) => b.localeCompare(a)); // desc
  return unique.slice(0, limit);
}

// ── Rotation Computation ───────────────────────────────────────

export interface IndustryRotationData {
  rotatingIn: IndustryRotationItem[];
  leading: IndustryRotationItem[];
  rotatingOut: IndustryRotationItem[];
  latestDate: string | null;
  nseAsOfDate: string | null;
  bseAsOfDate: string | null;
}

export async function fetchIndustryRotation(): Promise<IndustryRotationData> {
  const dates = await fetchRecentTradeDates(INDUSTRY_ROTATION_LOOKBACK_DAYS + 1);

  if (dates.length === 0) {
    return { rotatingIn: [], leading: [], rotatingOut: [], latestDate: null, nseAsOfDate: null, bseAsOfDate: null };
  }

  const latestDate = dates[0];
  const lookbackDate = dates[Math.min(INDUSTRY_ROTATION_LOOKBACK_DAYS, dates.length - 1)];

  // Fetch today's data and lookback data in parallel
  const [todayRows, lookbackRows] = await Promise.all([
    fetchIndustryEodForDate(latestDate),
    lookbackDate !== latestDate ? fetchIndustryEodForDate(lookbackDate) : Promise.resolve([]),
  ]);

  // Build lookup for lookback ranks
  const prevRankMap = new Map<string, number>();
  for (const row of lookbackRows) {
    prevRankMap.set(row.industry, row.industry_rank);
  }

  // Compute rank changes and categorize
  const totalIndustries = todayRows.length;
  const topQuartileCutoff = Math.ceil(totalIndustries / 4);

  const items: IndustryRotationItem[] = todayRows.map((row) => {
    const prevRank = prevRankMap.get(row.industry) ?? null;
    const rankChange = prevRank !== null ? prevRank - row.industry_rank : 0;

    let category: RotationCategory;
    if (rankChange >= 5) {
      category = 'rotating_in';
    } else if (row.industry_rank <= topQuartileCutoff) {
      category = 'leading';
    } else if (rankChange <= -5) {
      category = 'rotating_out';
    } else {
      category = 'leading'; // fallback — won't be shown
    }

    return { ...row, category, rank_change: rankChange, prev_rank: prevRank };
  });

  const rotatingIn = items
    .filter((i) => i.rank_change >= 5)
    .sort((a, b) => b.rank_change - a.rank_change)
    .slice(0, 5);

  const rotatingInNames = new Set(rotatingIn.map((i) => i.industry));
  const rotatingOut = items
    .filter((i) => i.rank_change <= -5)
    .sort((a, b) => a.rank_change - b.rank_change)
    .slice(0, 5);

  const rotatingOutNames = new Set(rotatingOut.map((i) => i.industry));
  const leading = items
    .filter((i) =>
      i.industry_rank <= topQuartileCutoff &&
      !rotatingInNames.has(i.industry) &&
      !rotatingOutNames.has(i.industry)
    )
    .sort((a, b) => a.industry_rank - b.industry_rank)
    .slice(0, 8);

  // Derive as-of dates from today's data (max across all industries)
  let nseAsOfDate: string | null = null;
  let bseAsOfDate: string | null = null;
  for (const row of todayRows) {
    if (row.nse_as_of_date && (!nseAsOfDate || row.nse_as_of_date > nseAsOfDate)) {
      nseAsOfDate = row.nse_as_of_date;
    }
    if (row.bse_as_of_date && (!bseAsOfDate || row.bse_as_of_date > bseAsOfDate)) {
      bseAsOfDate = row.bse_as_of_date;
    }
  }

  return { rotatingIn, leading, rotatingOut, latestDate, nseAsOfDate, bseAsOfDate };
}

// ── Stock Expansion ────────────────────────────────────────────

export interface IndustryStockRow {
  equity_id: number;
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  close: number;
  pct_chng: number | null;
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  rvol: number | null;
  sniper_inst: number | null;
  rss_value: number | null;
  rss_spread: number | null;
  sma_150: number | null;
  volume_divergence_flag: string | null;
}

/** Fetch top 10 stocks for an industry by magic_rs */
export async function fetchIndustryStocks(
  industry: string,
  tradeDate: string,
): Promise<IndustryStockRow[]> {
  // Step 1: Get equity IDs for this industry
  const { data: symbols, error: symErr } = await from('km_equity_symbols')
    .select('id,symbol,company_name,exchange')
    .eq('industry', industry)
    .is('is_active', 'true')
    .execute();

  if (symErr || !symbols || symbols.length === 0) return [];

  const symbolMap = new Map<number, { symbol: string; company_name: string | null; exchange: string | null }>();
  const ids: number[] = [];
  for (const s of symbols as EquitySymbolRow[]) {
    symbolMap.set(s.id, { symbol: s.symbol, company_name: s.company_name, exchange: s.exchange ?? null });
    ids.push(s.id);
  }

  // Step 2: Get EOD data for these equities on the trade date
  const { data: eodData, error: eodErr } = await from('km_equity_eod')
    .select('equity_id,close,pct_chng,rsi_14,magic_rs,magic_rs_zone,flow_type,rvol,sniper_inst,rss_value,rss_spread,sma_150,volume_divergence_flag')
    .in('equity_id', ids)
    .eq('trade_date', tradeDate)
    .order('magic_rs', { ascending: false })
    .limit(10)
    .execute();

  if (eodErr || !eodData) return [];

  return (eodData as EquityEodSnapshot[]).map((e) => {
    const sym = symbolMap.get(e.equity_id);
    return {
      equity_id: e.equity_id,
      symbol: sym?.symbol ?? '???',
      company_name: sym?.company_name ?? null,
      exchange: sym?.exchange ?? null,
      close: e.close,
      pct_chng: e.pct_chng,
      rsi_14: e.rsi_14,
      magic_rs: e.magic_rs,
      magic_rs_zone: e.magic_rs_zone,
      flow_type: e.flow_type,
      rvol: e.rvol,
      sniper_inst: e.sniper_inst,
      rss_value: e.rss_value,
      rss_spread: e.rss_spread,
      sma_150: e.sma_150,
      volume_divergence_flag: e.volume_divergence_flag,
    };
  });
}


// ── Full Industry Transition (dedicated page) ─────────────────

export interface IndustryTransitionItem extends IndustryRotationItem {
  percentile: number;         // current percentile (1 = best, 100 = worst)
  prevPercentile: number | null;
  percentileChange: number;   // positive = improved (percentile decreased)
  sparkline: number[];        // percentile values over last 6 dates (oldest first)
}

export type TransitionCategory = 'rotating_in' | 'leading' | 'rotating_out' | 'stable';

export interface IndustryTransitionData {
  rotatingIn: IndustryTransitionItem[];
  leading: IndustryTransitionItem[];
  rotatingOut: IndustryTransitionItem[];
  stable: IndustryTransitionItem[];
  latestDate: string | null;
  nseAsOfDate: string | null;
  bseAsOfDate: string | null;
  totalIndustries: number;
  tradeDates: string[];       // available dates for date picker
}

/** Fetch ALL industries with full transition data for the dedicated page */
export async function fetchFullIndustryTransition(): Promise<IndustryTransitionData> {
  // Fetch 6 recent dates for sparkline + transition detection
  const dates = await fetchRecentTradeDates(6);

  if (dates.length === 0) {
    return {
      rotatingIn: [], leading: [], rotatingOut: [], stable: [],
      latestDate: null, nseAsOfDate: null, bseAsOfDate: null,
      totalIndustries: 0, tradeDates: [],
    };
  }

  const latestDate = dates[0];
  const lookbackDate = dates[Math.min(INDUSTRY_ROTATION_LOOKBACK_DAYS, dates.length - 1)];

  // Fetch all dates' data in parallel
  const allDateRows = await Promise.all(dates.map((d) => fetchIndustryEodForDate(d)));

  // Build history map: industry → { date → row }
  const historyMap = new Map<string, Map<string, IndustryEodRow>>();
  for (let di = 0; di < dates.length; di++) {
    for (const row of allDateRows[di]) {
      if (!historyMap.has(row.industry)) historyMap.set(row.industry, new Map());
      historyMap.get(row.industry)!.set(dates[di], row);
    }
  }

  const todayRows = allDateRows[0];
  const totalIndustries = todayRows.length;
  const topQuartileCutoff = Math.ceil(totalIndustries / 4);

  // Build prev rank map from lookback date
  const lookbackIdx = dates.indexOf(lookbackDate);
  const lookbackRows = lookbackIdx >= 0 ? allDateRows[lookbackIdx] : [];
  const prevRankMap = new Map<string, number>();
  const prevTotalMap = new Map<string, number>();
  for (const row of lookbackRows) {
    prevRankMap.set(row.industry, row.industry_rank);
  }
  const prevTotal = lookbackRows.length || totalIndustries;

  // As-of dates
  let nseAsOfDate: string | null = null;
  let bseAsOfDate: string | null = null;
  for (const row of todayRows) {
    if (row.nse_as_of_date && (!nseAsOfDate || row.nse_as_of_date > nseAsOfDate)) nseAsOfDate = row.nse_as_of_date;
    if (row.bse_as_of_date && (!bseAsOfDate || row.bse_as_of_date > bseAsOfDate)) bseAsOfDate = row.bse_as_of_date;
  }

  // Build items with percentile + sparkline
  const items: IndustryTransitionItem[] = todayRows.map((row) => {
    const prevRank = prevRankMap.get(row.industry) ?? null;
    const rankChange = prevRank !== null ? prevRank - row.industry_rank : 0;

    // Percentile: higher = stronger (99%ile = rank 1, top industry)
    const percentile = Math.round((1 - row.industry_rank / totalIndustries) * 100);
    const prevPercentile = prevRank !== null ? Math.round((1 - prevRank / prevTotal) * 100) : null;
    const percentileChange = prevPercentile !== null ? percentile - prevPercentile : 0;

    // Sparkline: percentile over each date (oldest first, higher = stronger)
    const sparkline: number[] = [];
    for (let di = dates.length - 1; di >= 0; di--) {
      const dateRows = allDateRows[di];
      const dateTotal = dateRows.length || 1;
      const history = historyMap.get(row.industry);
      const histRow = history?.get(dates[di]);
      if (histRow) {
        sparkline.push(Math.round((1 - histRow.industry_rank / dateTotal) * 100));
      }
    }

    // Category (same logic as dashboard but using percentile threshold)
    let category: RotationCategory;
    if (percentileChange >= 10) {
      category = 'rotating_in';
    } else if (percentileChange <= -10) {
      category = 'rotating_out';
    } else if (row.industry_rank <= topQuartileCutoff) {
      category = 'leading';
    } else {
      category = 'leading'; // will be re-classified as stable below
    }

    return {
      ...row,
      category,
      rank_change: rankChange,
      prev_rank: prevRank,
      percentile,
      prevPercentile,
      percentileChange,
      sparkline,
    };
  });

  // Classify into buckets
  const rotatingIn = items
    .filter((i) => i.percentileChange >= 10)
    .sort((a, b) => b.percentileChange - a.percentileChange);

  const rotatingInSet = new Set(rotatingIn.map((i) => i.industry));

  const rotatingOut = items
    .filter((i) => i.percentileChange <= -10)
    .sort((a, b) => a.percentileChange - b.percentileChange);

  const rotatingOutSet = new Set(rotatingOut.map((i) => i.industry));

  const leading = items
    .filter((i) =>
      i.industry_rank <= topQuartileCutoff &&
      !rotatingInSet.has(i.industry) &&
      !rotatingOutSet.has(i.industry)
    )
    .sort((a, b) => a.industry_rank - b.industry_rank);

  const leadingSet = new Set(leading.map((i) => i.industry));

  const stable = items
    .filter((i) =>
      !rotatingInSet.has(i.industry) &&
      !rotatingOutSet.has(i.industry) &&
      !leadingSet.has(i.industry)
    )
    .sort((a, b) => a.percentile - b.percentile);

  return {
    rotatingIn,
    leading,
    rotatingOut,
    stable,
    latestDate,
    nseAsOfDate,
    bseAsOfDate,
    totalIndustries,
    tradeDates: dates,
  };
}


// ── Stock-Level Enriched View ─────────────────────────────────
// Combines stock EOD data with industry transition context.
// Each stock gets its industry's percentile + category.

export interface IndustryEnrichedStock {
  // Stock fields (ScanStock-compatible)
  equity_id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string | null;
  close: number;
  pct_chng: number | null;
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  rvol: number | null;
  sniper_inst: number | null;
  accum_distrib: string | null;
  rss_value: number | null;
  rss_spread: number | null;
  sma_150: number | null;
  volume_divergence_flag: string | null;
  has_recent_svd: boolean;
  has_recent_sbd: boolean;
  has_recent_syd: boolean;
  // Industry context
  industryPercentile: number;       // 0-100, higher = stronger
  industryCategory: RotationCategory | 'stable';
  industryPercentileChange: number; // positive = improving
}

export interface IndustryTransitionStocksResult {
  stocks: IndustryEnrichedStock[];
  latestDate: string | null;
  nseAsOfDate: string | null;
  bseAsOfDate: string | null;
  totalIndustries: number;
  industryCounts: { all: number; rotating_in: number; leading: number; rotating_out: number; stable: number };
}

let _itsCache: { data: IndustryTransitionStocksResult; fetchedAt: number } | null = null;

/** Fetch all stocks enriched with industry transition context */
export async function fetchIndustryTransitionStocks(): Promise<IndustryTransitionStocksResult> {
  if (_itsCache && Date.now() - _itsCache.fetchedAt < 3 * 60 * 1000) {
    return _itsCache.data;
  }

  // Step 1: Get industry transition data
  const transition = await fetchFullIndustryTransition();

  // Build industry lookup: name → { percentile, category, percentileChange }
  const industryMap = new Map<string, { percentile: number; category: RotationCategory | 'stable'; percentileChange: number }>();
  for (const item of [...transition.rotatingIn, ...transition.leading, ...transition.rotatingOut]) {
    industryMap.set(item.industry, {
      percentile: item.percentile,
      category: item.percentileChange >= 10 ? 'rotating_in' : item.percentileChange <= -10 ? 'rotating_out' : 'leading',
      percentileChange: item.percentileChange,
    });
  }
  for (const item of transition.stable) {
    industryMap.set(item.industry, {
      percentile: item.percentile,
      category: 'stable',
      percentileChange: item.percentileChange,
    });
  }

  if (!transition.latestDate) {
    return {
      stocks: [], latestDate: null, nseAsOfDate: null, bseAsOfDate: null,
      totalIndustries: 0,
      industryCounts: { all: 0, rotating_in: 0, leading: 0, rotating_out: 0, stable: 0 },
    };
  }

  // Step 2: Fetch all active symbols + latest EOD in parallel
  const [symbolRes, eodRes] = await Promise.all([
    from('km_equity_symbols')
      .select('id,symbol,company_name,industry,exchange,is_active')
      .is('is_active', 'true')
      .limit(8000)
      .execute(),

    from('km_equity_eod')
      .select('equity_id,close,pct_chng,rsi_14,magic_rs,magic_rs_zone,flow_type,accum_distrib,rvol,sniper_inst,rss_value,rss_spread,sma_150,volume_divergence_flag')
      .eq('trade_date', transition.latestDate)
      .limit(8000)
      .execute(),
  ]);

  const symbols = new Map<number, EquitySymbolRow>();
  for (const s of (symbolRes.data ?? []) as EquitySymbolRow[]) {
    symbols.set(s.id, s);
  }

  // Step 3: Merge stocks with industry context
  const stocks: IndustryEnrichedStock[] = [];
  for (const eod of (eodRes.data ?? []) as EquityEodSnapshot[]) {
    const sym = symbols.get(eod.equity_id);
    if (!sym || !sym.industry) continue;

    const indCtx = industryMap.get(sym.industry);
    if (!indCtx) continue; // skip stocks in non-qualifying industries

    stocks.push({
      equity_id: eod.equity_id,
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
      industryPercentile: indCtx.percentile,
      industryCategory: indCtx.category,
      industryPercentileChange: indCtx.percentileChange,
    });
  }

  // Sort by industry percentile desc, then magic_rs desc
  stocks.sort((a, b) => b.industryPercentile - a.industryPercentile || (b.magic_rs ?? 0) - (a.magic_rs ?? 0));

  const result: IndustryTransitionStocksResult = {
    stocks,
    latestDate: transition.latestDate,
    nseAsOfDate: transition.nseAsOfDate,
    bseAsOfDate: transition.bseAsOfDate,
    totalIndustries: transition.totalIndustries,
    industryCounts: {
      all: transition.rotatingIn.length + transition.leading.length + transition.rotatingOut.length + transition.stable.length,
      rotating_in: transition.rotatingIn.length,
      leading: transition.leading.length,
      rotating_out: transition.rotatingOut.length,
      stable: transition.stable.length,
    },
  };

  _itsCache = { data: result, fetchedAt: Date.now() };
  return result;
}
