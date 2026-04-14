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
}

export async function fetchIndustryRotation(): Promise<IndustryRotationData> {
  const dates = await fetchRecentTradeDates(INDUSTRY_ROTATION_LOOKBACK_DAYS + 1);

  if (dates.length === 0) {
    return { rotatingIn: [], leading: [], rotatingOut: [], latestDate: null };
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

  return { rotatingIn, leading, rotatingOut, latestDate };
}

// ── Stock Expansion ────────────────────────────────────────────

export interface IndustryStockRow {
  equity_id: number;
  symbol: string;
  company_name: string | null;
  close: number;
  pct_chng: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  rvol: number | null;
}

/** Fetch top 10 stocks for an industry by magic_rs */
export async function fetchIndustryStocks(
  industry: string,
  tradeDate: string,
): Promise<IndustryStockRow[]> {
  // Step 1: Get equity IDs for this industry
  const { data: symbols, error: symErr } = await from('km_equity_symbols')
    .select('id,symbol,company_name')
    .eq('industry', industry)
    .is('is_active', 'true')
    .execute();

  if (symErr || !symbols || symbols.length === 0) return [];

  const symbolMap = new Map<number, { symbol: string; company_name: string | null }>();
  const ids: number[] = [];
  for (const s of symbols as EquitySymbolRow[]) {
    symbolMap.set(s.id, { symbol: s.symbol, company_name: s.company_name });
    ids.push(s.id);
  }

  // Step 2: Get EOD data for these equities on the trade date
  const { data: eodData, error: eodErr } = await from('km_equity_eod')
    .select('equity_id,close,pct_chng,magic_rs,magic_rs_zone,flow_type,rvol')
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
      close: e.close,
      pct_chng: e.pct_chng,
      magic_rs: e.magic_rs,
      magic_rs_zone: e.magic_rs_zone,
      flow_type: e.flow_type,
      rvol: e.rvol,
    };
  });
}
