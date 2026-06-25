/**
 * Sector Rotation Service
 * =======================
 * Fetches km_index_eod + km_index_symbols data for the /sector-rotation page.
 *
 * Two-step fetch pattern (same as industryRotation.ts):
 *   1. Fetch active index symbols filtered by category
 *   2. Fetch latest-date EOD rows for those index IDs
 */

import { from } from './postgrest';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SectorIndexSymbol {
  id: number;
  name: string;
  category: string;
}

export interface SectorIndexRow {
  // Identity
  index_id: number;
  name: string;
  category: string;
  trade_date: string;
  // OHLCV
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  chng: number | null;
  pct_chng: number | null;
  volume: number | null;
  value_cr: number | null;
  // Returns
  ret_5d: number | null;
  ret_22d: number | null;
  ret_66d: number | null;
  // Indicators
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  sniper_inst: number | null;
  // Sector rotation cols (migration 113)
  avg_amt_5d: number | null;
  avg_amt_22d: number | null;
  avg_amt_66d: number | null;
  score_5d: number | null;
  score_22d: number | null;
}

// Broad Market needs two category values — others are single strings.
// Callers pass the tab key; this map resolves the DB filter.
export type SectorTab = 'broad' | 'sectoral' | 'thematic';

export const SECTOR_TAB_CATEGORIES: Record<SectorTab, string[]> = {
  broad:     ['index', 'broad market index'],
  sectoral:  ['sectoral index'],
  thematic:  ['thematic market index'],
};

export const SECTOR_TAB_LABELS: Record<SectorTab, string> = {
  broad:    'Broad Market',
  sectoral: 'Sectoral',
  thematic: 'Thematic',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch the latest available trade_date in km_index_eod */
async function fetchLatestIndexDate(): Promise<string | null> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (error || !data || data.length === 0) return null;
  return (data[0] as { trade_date: string }).trade_date;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all active sector indices for a tab, at the latest available trade_date.
 * Pass an optional `forDate` to query a specific historical date.
 */
export async function fetchSectorIndices(
  category: string | string[],
  forDate?: string,
): Promise<SectorIndexRow[]> {
  const categories = Array.isArray(category) ? category : [category];

  // Step 1: Get active index IDs + names for this category set
  const { data: symbols, error: symErr } = await from('km_index_symbols')
    .select('id,name,category')
    .in('category', categories)
    .is('is_active', 'true')
    .order('name', { ascending: true })
    .execute();

  if (symErr) throw new Error(`[sectorRotation] symbol fetch failed: ${symErr.message}`);
  const syms = (symbols ?? []) as SectorIndexSymbol[];
  if (syms.length === 0) return [];

  const symbolMap = new Map<number, SectorIndexSymbol>();
  for (const s of syms) symbolMap.set(s.id, s);
  const indexIds = syms.map((s) => s.id);

  // Step 2: Resolve trade date
  const tradeDate = forDate ?? (await fetchLatestIndexDate());
  if (!tradeDate) return [];

  // Step 3: Fetch EOD rows for those index IDs on that date
  const { data: eodData, error: eodErr } = await from('km_index_eod')
    .select(
      'index_id,trade_date,open,high,low,close,chng,pct_chng,volume,value_cr,' +
      'ret_5d,ret_22d,ret_66d,rsi_14,magic_rs,magic_rs_zone,flow_type,sniper_inst,' +
      'avg_amt_5d,avg_amt_22d,avg_amt_66d,score_5d,score_22d',
    )
    .eq('trade_date', tradeDate)
    .in('index_id', indexIds)
    .execute();

  if (eodErr) throw new Error(`[sectorRotation] EOD fetch failed: ${eodErr.message}`);

  return ((eodData ?? []) as Omit<SectorIndexRow, 'name' | 'category'>[]).map((row) => {
    const sym = symbolMap.get(row.index_id);
    return {
      ...row,
      name: sym?.name ?? `Index ${row.index_id}`,
      category: sym?.category ?? '',
    };
  });
}

export interface VixRow {
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  pct_chng: number | null;
  ret_5d: number | null;
  ret_22d: number | null;
  ret_66d: number | null;
}

/**
 * Fetch latest India VIX OHLC + returns (index_id = 94).
 * Returns null if no data is available.
 */
export async function fetchVix(): Promise<VixRow | null> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date,open,high,low,close,pct_chng,ret_5d,ret_22d,ret_66d')
    .eq('index_id', 94)
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (error || !data || data.length === 0) return null;
  return data[0] as VixRow;
}
