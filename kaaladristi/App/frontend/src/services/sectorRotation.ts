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
  // Constituent count
  stock_count: number | null;
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
export async function fetchLatestIndexDate(): Promise<string | null> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (error || !data || data.length === 0) return null;
  return (data[0] as { trade_date: string }).trade_date;
}

/** Fetch the earliest available trade_date in km_index_eod */
export async function fetchEarliestIndexDate(): Promise<string | null> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date')
    .order('trade_date', { ascending: true })
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

  // Step 3: Fetch EOD rows + constituent counts in parallel
  const [eodRes, constRes] = await Promise.all([
    from('km_index_eod')
      .select(
        'index_id,trade_date,open,high,low,close,chng,pct_chng,volume,value_cr,' +
        'ret_5d,ret_22d,ret_66d,rsi_14,magic_rs,magic_rs_zone,flow_type,sniper_inst,' +
        'avg_amt_5d,avg_amt_22d,avg_amt_66d,score_5d,score_22d',
      )
      .eq('trade_date', tradeDate)
      .in('index_id', indexIds)
      .execute(),
    from('km_index_constituents')
      .select('index_id')
      .in('index_id', indexIds)
      .execute(),
  ]);

  if (eodRes.error) throw new Error(`[sectorRotation] EOD fetch failed: ${eodRes.error.message}`);

  const countMap = new Map<number, number>();
  for (const c of (constRes.data ?? []) as { index_id: number }[]) {
    countMap.set(c.index_id, (countMap.get(c.index_id) ?? 0) + 1);
  }

  return ((eodRes.data ?? []) as Omit<SectorIndexRow, 'name' | 'category' | 'stock_count'>[]).map((row) => {
    const sym = symbolMap.get(row.index_id);
    return {
      ...row,
      name: sym?.name ?? `Index ${row.index_id}`,
      category: sym?.category ?? '',
      stock_count: countMap.get(row.index_id) ?? null,
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

// ── IndexDrawer supporting types + fetches ────────────────────────────────────

export interface SparklinePoint {
  trade_date: string;
  close: number;
}

export interface ConstituentDetail {
  equity_id: number;
  symbol: string;
  company_name: string;
  close: number | null;
  pct_chng: number | null;
  ret_5d: number | null;
  ret_22d: number | null;
  ret_66d: number | null;
  flow_type: string | null;
  rsi_14: number | null;
  score_5d: number | null;
  magic_rs: number | null;
}

/** Last 22 trading days of close prices for a single index (newest first). */
export async function fetchIndexSparkline(indexId: number): Promise<SparklinePoint[]> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date,close')
    .eq('index_id', indexId)
    .order('trade_date', { ascending: false })
    .limit(22)
    .execute();

  if (error) throw new Error(`[sparkline] ${error.message}`);
  return ((data ?? []) as SparklinePoint[]).reverse();
}

/**
 * Batch fetch sparklines for multiple indices.
 * Returns a Map<index_id, SparklinePoint[]> with the last `days` rows per index.
 */
export async function fetchIndexSparklines(
  indexIds: number[],
  days = 22,
): Promise<Map<number, SparklinePoint[]>> {
  if (indexIds.length === 0) return new Map();

  const latestDate = await fetchLatestIndexDate();
  if (!latestDate) return new Map();

  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - days * 2);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data, error } = await from('km_index_eod')
    .select('index_id,trade_date,close')
    .in('index_id', indexIds)
    .gte('trade_date', cutoffStr)
    .order('trade_date', { ascending: true })
    .execute();

  if (error) throw new Error(`[sparklines] ${error.message}`);

  const rows = (data ?? []) as Array<{ index_id: number; trade_date: string; close: number }>;
  const grouped = new Map<number, SparklinePoint[]>();
  for (const row of rows) {
    if (!grouped.has(row.index_id)) grouped.set(row.index_id, []);
    grouped.get(row.index_id)!.push({ trade_date: row.trade_date, close: row.close });
  }
  for (const [id, pts] of grouped) {
    grouped.set(id, pts.slice(-days));
  }
  return grouped;
}

/**
 * For a set of equity IDs, fetch symbol + company_name from km_equity_symbols
 * and the latest signals (flow_type, rsi_14, score_5d) from km_equity_eod
 * on a given trade date.
 */
export async function fetchConstituentDetails(
  equityIds: number[],
  tradeDate: string,
): Promise<ConstituentDetail[]> {
  if (equityIds.length === 0) return [];

  const [symRes, eodRes] = await Promise.all([
    from('km_equity_symbols')
      .select('id,symbol,company_name')
      .in('id', equityIds)
      .execute(),
    from('km_equity_eod')
      .select('equity_id,close,pct_chng,ret_5d,ret_22d,ret_66d,flow_type,rsi_14,score_5d,magic_rs')
      .in('equity_id', equityIds)
      .eq('trade_date', tradeDate)
      .execute(),
  ]);

  if (symRes.error) throw new Error(`[constituentDetails] ${symRes.error.message}`);
  if (eodRes.error) throw new Error(`[constituentDetails] ${eodRes.error.message}`);

  type SymRow = { id: number; symbol: string; company_name: string };
  type EodRow = { equity_id: number; close: number | null; pct_chng: number | null; ret_5d: number | null; ret_22d: number | null; ret_66d: number | null; flow_type: string | null; rsi_14: number | null; score_5d: number | null; magic_rs: number | null };

  const syms = (symRes.data ?? []) as SymRow[];
  const eods = (eodRes.data ?? []) as EodRow[];
  const eodMap = new Map(eods.map((e) => [e.equity_id, e]));

  return syms.map((s) => {
    const eod = eodMap.get(s.id);
    return {
      equity_id: s.id,
      symbol: s.symbol,
      company_name: s.company_name,
      close: eod?.close ?? null,
      pct_chng: eod?.pct_chng ?? null,
      ret_5d: eod?.ret_5d ?? null,
      ret_22d: eod?.ret_22d ?? null,
      ret_66d: eod?.ret_66d ?? null,
      flow_type: eod?.flow_type ?? null,
      rsi_14: eod?.rsi_14 ?? null,
      score_5d: eod?.score_5d ?? null,
      magic_rs: eod?.magic_rs ?? null,
    };
  });
}

/**
 * Fetch a single index's latest EOD row plus its symbol metadata.
 * Returns null if no data found.
 */
export async function fetchIndexDetail(indexId: number): Promise<SectorIndexRow | null> {
  const [symRes, eodRes] = await Promise.all([
    from('km_index_symbols')
      .select('id,name,category')
      .eq('id', indexId)
      .limit(1)
      .execute(),
    from('km_index_eod')
      .select(
        'index_id,trade_date,open,high,low,close,chng,pct_chng,volume,value_cr,' +
        'ret_5d,ret_22d,ret_66d,rsi_14,magic_rs,magic_rs_zone,flow_type,sniper_inst,' +
        'avg_amt_5d,avg_amt_22d,avg_amt_66d,score_5d,score_22d',
      )
      .eq('index_id', indexId)
      .order('trade_date', { ascending: false })
      .limit(1)
      .execute(),
  ]);

  if (symRes.error || eodRes.error) return null;
  const sym = ((symRes.data ?? []) as SectorIndexSymbol[])[0];
  const eod = ((eodRes.data ?? []) as Omit<SectorIndexRow, 'name' | 'category' | 'stock_count'>[])[0];
  if (!sym || !eod) return null;

  return { ...eod, name: sym.name, category: sym.category, stock_count: null };
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

// ── FlowIntensityMap types + fetch ────────────────────────────────────────────

export interface FlowCellData {
  amt: number;   // ₹ Cr traded value
  sx: number;    // surge multiple vs baseline (avg_amt_22d proxy)
  d1: number;    // 1D price % change
}

export interface FlowIntensityData {
  rows: string[];
  dates: string[];
  cells: Record<string, FlowCellData[]>;
}

/**
 * Fetches last `days` trading days of per-constituent flow data for an index.
 * Returns rows sorted by avg surge DESC so the most active stocks appear first.
 *
 * NOTE: sx uses avg_amt_22d as the baseline proxy.
 * TODO: switch to avg_amt_66d when it is added to km_equity_eod.
 */
export async function fetchIndexFlowIntensity(
  indexId: number,
  days = 22,
): Promise<FlowIntensityData> {
  // Step 1: get constituent equity IDs
  const { data: constData, error: constErr } = await from('km_index_constituents')
    .select('equity_id')
    .eq('index_id', indexId)
    .execute();

  if (constErr) throw new Error(`[flowIntensity] constituents: ${constErr.message}`);
  const equityIds = ((constData ?? []) as { equity_id: number }[]).map((r) => r.equity_id);
  if (equityIds.length === 0) return { rows: [], dates: [], cells: {} };

  // Step 2: fetch recent trade dates (newest first, limit days)
  const { data: dateData, error: dateErr } = await from('km_equity_eod')
    .select('trade_date')
    .in('equity_id', equityIds)
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (dateErr || !dateData || dateData.length === 0) return { rows: [], dates: [], cells: {} };
  const latestDate = (dateData[0] as { trade_date: string }).trade_date;

  // Compute cutoff (fetch extra calendar days to cover weekends/holidays)
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - days * 2);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // Step 3: fetch symbols
  const { data: symData, error: symErr } = await from('km_equity_symbols')
    .select('id,symbol')
    .in('id', equityIds)
    .execute();

  if (symErr) throw new Error(`[flowIntensity] symbols: ${symErr.message}`);
  const symMap = new Map<number, string>(
    ((symData ?? []) as { id: number; symbol: string }[]).map((s) => [s.id, s.symbol]),
  );

  // Step 4: fetch EOD rows for all constituents in the date window
  const { data: eodData, error: eodErr } = await from('km_equity_eod')
    .select('equity_id,trade_date,value_cr,pct_chng,avg_amt_22d')
    .in('equity_id', equityIds)
    .gte('trade_date', cutoffStr)
    .order('trade_date', { ascending: true })
    .execute();

  if (eodErr) throw new Error(`[flowIntensity] eod: ${eodErr.message}`);

  type EodRow = {
    equity_id: number;
    trade_date: string;
    value_cr: number | null;
    pct_chng: number | null;
    avg_amt_22d: number | null;
  };

  const allRows = (eodData ?? []) as EodRow[];

  // Step 5: collect ordered date list (up to `days`)
  const dateSet = new Set<string>();
  for (const r of allRows) dateSet.add(r.trade_date);
  const sortedDates = Array.from(dateSet).sort().slice(-days);

  // Format dates as 'DD MMM'
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };
  const formattedDates = sortedDates.map(fmtDate);

  // Build per-symbol cell arrays + compute avg sx for sorting
  const cellMap: Record<string, FlowCellData[]> = {};
  const avgSx: Record<string, number> = {};

  for (const equityId of equityIds) {
    const sym = symMap.get(equityId);
    if (!sym) continue;

    const byDate = new Map<string, EodRow>();
    for (const r of allRows) {
      if (r.equity_id === equityId) byDate.set(r.trade_date, r);
    }

    const row: FlowCellData[] = sortedDates.map((d) => {
      const r = byDate.get(d);
      if (!r) return { amt: 0, sx: 0, d1: 0 };
      const amt = r.value_cr ?? 0;
      const baseline = r.avg_amt_22d ?? 0;
      const sx = baseline > 0 ? amt / baseline : 1.0;
      return { amt, sx, d1: r.pct_chng ?? 0 };
    });

    cellMap[sym] = row;
    const sxVals = row.filter((c) => c.sx > 0).map((c) => c.sx);
    avgSx[sym] = sxVals.length > 0 ? sxVals.reduce((a, b) => a + b, 0) / sxVals.length : 0;
  }

  // Sort rows by avg sx DESC
  const sortedRows = Object.keys(cellMap).sort((a, b) => (avgSx[b] ?? 0) - (avgSx[a] ?? 0));

  return { rows: sortedRows, dates: formattedDates, cells: cellMap };
}
