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
import { displaySymbol } from '@/lib/symbolUtils';
import type { MarketBreadthDay, BreadthRocDay } from '@/types';

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
export type SectorTab = 'broad' | 'sectoral' | 'thematic' | 'custom';

export const SECTOR_TAB_CATEGORIES: Record<SectorTab, string[]> = {
  broad:     ['index', 'broad market index'],
  sectoral:  ['sectoral index'],
  thematic:  ['thematic market index'],
  custom:    ['custom'],
};

export const SECTOR_TAB_LABELS: Record<SectorTab, string> = {
  broad:    'Broad Market',
  sectoral: 'Sectoral',
  thematic: 'Thematic',
  custom:   'Curated',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch the latest INDICATOR-complete trade_date in km_index_eod. Gated on
 *  ema_20 (not just latest row) — index_eod_download lands raw rows before
 *  index_indicators/index_magic_rs compute, so an ungated latest date can
 *  surface a row set with sector indices still mid-calculation. */
export async function fetchLatestIndexDate(): Promise<string | null> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date')
    .notNull('ema_20')
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
  /** Money-flow scores — only populated by fetchIndexSparkline (detail page) */
  score_5d?: number | null;
  score_22d?: number | null;
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
  score_22d: number | null;
  magic_rs: number | null;
}

/** Last 22 trading days of close prices for a single index (newest first). */
export async function fetchIndexSparkline(indexId: number): Promise<SparklinePoint[]> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date,close,score_5d,score_22d')
    .eq('index_id', indexId)
    .order('trade_date', { ascending: false })
    .limit(30)
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
      .select('equity_id,close,pct_chng,ret_5d,ret_22d,ret_66d,flow_type,rsi_14,score_5d,score_22d,magic_rs')
      .in('equity_id', equityIds)
      .eq('trade_date', tradeDate)
      .execute(),
  ]);

  if (symRes.error) throw new Error(`[constituentDetails] ${symRes.error.message}`);
  if (eodRes.error) throw new Error(`[constituentDetails] ${eodRes.error.message}`);

  type SymRow = { id: number; symbol: string; company_name: string };
  type EodRow = { equity_id: number; close: number | null; pct_chng: number | null; ret_5d: number | null; ret_22d: number | null; ret_66d: number | null; flow_type: string | null; rsi_14: number | null; score_5d: number | null; score_22d: number | null; magic_rs: number | null };

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
      score_22d: eod?.score_22d ?? null,
      magic_rs: eod?.magic_rs ?? null,
    };
  });
}

/**
 * Fetch a single index's latest EOD row plus its symbol metadata.
 * Returns null if no data found.
 */
const INDEX_DETAIL_COLS =
  'index_id,trade_date,open,high,low,close,chng,pct_chng,volume,value_cr,' +
  'ret_5d,ret_22d,ret_66d,rsi_14,magic_rs,magic_rs_zone,flow_type,sniper_inst,' +
  'avg_amt_5d,avg_amt_22d,avg_amt_66d,score_5d,score_22d';

export async function fetchIndexDetail(indexId: number, forDate?: string): Promise<SectorIndexRow | null> {
  // Resolve the date to read this index at. Default: the latest
  // INDICATOR-complete date globally (ema_20-gated, anchored by standard
  // indices). A pinned `forDate` (Overview date picker) reads that day instead.
  // Do NOT gate the per-row read on ema_20: custom (category='custom') indices
  // synthesize close/returns/score but do not reliably compute ema_20 (B78) — a
  // per-row ema_20 gate silently drops every row of such an index and 404s the
  // page (hit on CPaaS / other thinly-synthesized curated indices, 2026-07-16).
  // This mirrors fetchSectorIndices, which gates the DATE, not each row.
  const [symRes, resolvedDate] = await Promise.all([
    from('km_index_symbols').select('id,name,category').eq('id', indexId).limit(1).execute(),
    forDate ? Promise.resolve(forDate) : fetchLatestIndexDate(),
  ]);

  if (symRes.error) return null;
  const sym = ((symRes.data ?? []) as SectorIndexSymbol[])[0];
  if (!sym) return null;

  type EodOnly = Omit<SectorIndexRow, 'name' | 'category' | 'stock_count'>;
  let eod: EodOnly | undefined;

  if (resolvedDate) {
    // For a pinned date, read the latest row ON OR BEFORE it (holidays / an
    // index that didn't trade that exact session still resolve to a real bar).
    const q = from('km_index_eod').select(INDEX_DETAIL_COLS).eq('index_id', indexId);
    const r = forDate
      ? await q.lte('trade_date', resolvedDate).order('trade_date', { ascending: false }).limit(1).execute()
      : await q.eq('trade_date', resolvedDate).limit(1).execute();
    if (r.error) return null;
    eod = ((r.data ?? []) as EodOnly[])[0];
  }

  // Fallback: this index has no row on the global latest date (e.g. a custom
  // index synthesized on a slightly different calendar) — take its own latest.
  if (!eod) {
    const r = await from('km_index_eod')
      .select(INDEX_DETAIL_COLS)
      .eq('index_id', indexId)
      .order('trade_date', { ascending: false })
      .limit(1)
      .execute();
    if (r.error) return null;
    eod = ((r.data ?? []) as EodOnly[])[0];
  }

  if (!eod) return null;

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
    .notNull('ema_20')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (error || !data || data.length === 0) return null;
  return data[0] as VixRow;
}

// ── FlowIntensityMap types + service functions ────────────────────────────────

export interface FlowCellData {
  d1: number;
  amt: number;
  amt_5d?: number;
  amt_22d?: number;
  ret_5d?: number;
  ret_22d?: number;
  s5?: number;   // score_5d  — money-flow conviction (both modes)
  s22?: number;  // score_22d — 1-month conviction baseline (both modes)
}

export interface FlowMapData {
  rows: string[];
  dates: string[];
  cells: Record<string, FlowCellData[]>;
  /** Constituent mode only: display-name → equity identity, for drill-down to
   *  the stock's chart. Empty for index mode. */
  rowMeta?: Record<string, { equity_id: number; symbol: string; company_name: string }>;
}

/**
 * Fetches last `days` trading days of per-constituent flow data for an index.
 *
 * Cells carry the same score/return/amount fields as the sector heatmap
 * (fetchIndexFlowMap) so FlowIntensityMap renders both maps identically —
 * conviction-first, per the owner's Score doctrine. The equity score already
 * embeds delivery surge (Index_Score_Spec: surge is a score component), so
 * nothing from the old surge-colored map is lost.
 *
 * Rows sorted by average Score 5D DESC; date columns run newest-first
 * (column 0 = latest session), exactly like fetchIndexFlowMap — the
 * MicroTrend bars provide the chronological oldest → newest read.
 */
export async function fetchConstituentFlowMap(
  indexId: number,
  days = 22,
): Promise<FlowMapData> {
  // Step 1: get constituent equity IDs + display names
  const { data: constData, error: constErr } = await from('km_index_constituents')
    .select('equity_id')
    .eq('index_id', indexId)
    .execute();
  if (constErr) throw new Error(`[constituentFlowMap] constituents: ${constErr.message}`);

  const equityIds = ((constData ?? []) as { equity_id: number }[]).map((r) => r.equity_id);
  if (equityIds.length === 0) return { rows: [], dates: [], cells: {} };

  const { data: symData, error: symErr } = await from('km_equity_symbols')
    .select('id,symbol,company_name')
    .in('id', equityIds)
    .execute();
  if (symErr) throw new Error(`[constituentFlowMap] symbols: ${symErr.message}`);

  // displaySymbol: BSE constituents have numeric scrip codes — render a
  // human-readable short name derived from company_name instead.
  const symRows = (symData ?? []) as { id: number; symbol: string; company_name: string }[];
  const symMap = new Map<number, string>(
    symRows.map((s) => [s.id, displaySymbol({ symbol: s.symbol, company_name: s.company_name })]),
  );
  const metaById = new Map<number, { symbol: string; company_name: string }>(
    symRows.map((s) => [s.id, { symbol: s.symbol, company_name: s.company_name }]),
  );

  // Step 2: latest N trade dates from first equity's EOD
  const anchorId = equityIds[0];
  const { data: dateData, error: dateErr } = await from('km_equity_eod')
    .select('trade_date')
    .eq('equity_id', anchorId)
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (dateErr || !dateData || dateData.length === 0) return { rows: [], dates: [], cells: {} };

  const sortedDates = ((dateData as { trade_date: string }[])
    .map((r) => r.trade_date))
    .sort();                        // oldest first — chronological, like the sector heatmap
  const earliestDate = sortedDates[0];

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };
  const formattedDates = sortedDates.map(fmtDate);

  // Step 3: fetch EOD for all constituents in the date window
  const { data: eodData, error: eodErr } = await from('km_equity_eod')
    .select('equity_id,trade_date,pct_chng,value_cr,ret_5d,ret_22d,score_5d,score_22d,avg_amt_5d,avg_amt_22d')
    .in('equity_id', equityIds)
    .gte('trade_date', earliestDate)
    .order('trade_date', { ascending: true })
    .execute();
  if (eodErr) throw new Error(`[constituentFlowMap] eod: ${eodErr.message}`);

  type EodRow = {
    equity_id: number; trade_date: string;
    pct_chng: number | null; value_cr: number | null;
    ret_5d: number | null; ret_22d: number | null;
    score_5d: number | null; score_22d: number | null;
    avg_amt_5d: number | null; avg_amt_22d: number | null;
  };
  const allRows = (eodData ?? []) as EodRow[];

  // Step 4: build cell arrays keyed by display name
  const cellMap: Record<string, FlowCellData[]> = {};
  const avgS5:   Record<string, number>          = {};
  const rowMeta: Record<string, { equity_id: number; symbol: string; company_name: string }> = {};

  for (const equityId of equityIds) {
    const sym = symMap.get(equityId);
    if (!sym) continue;
    const meta = metaById.get(equityId);
    if (meta) rowMeta[sym] = { equity_id: equityId, symbol: meta.symbol, company_name: meta.company_name };

    const byDate = new Map<string, EodRow>();
    for (const r of allRows) {
      if (r.equity_id === equityId) byDate.set(r.trade_date, r);
    }

    const row: FlowCellData[] = sortedDates.map((d) => {
      const r = byDate.get(d);
      if (!r) return { d1: 0, amt: 0 };
      return {
        d1:      r.pct_chng ?? 0,
        amt:     r.value_cr ?? 0,
        ret_5d:  r.ret_5d  ?? undefined,
        ret_22d: r.ret_22d ?? undefined,
        s5:      r.score_5d  ?? undefined,
        s22:     r.score_22d ?? undefined,
        amt_5d:  r.avg_amt_5d  ?? undefined,
        amt_22d: r.avg_amt_22d ?? undefined,
      };
    });

    cellMap[sym] = row;
    const s5Vals = row.filter((c) => (c.s5 ?? 0) > 0).map((c) => c.s5 ?? 0);
    avgS5[sym] = s5Vals.length > 0 ? s5Vals.reduce((a, b) => a + b, 0) / s5Vals.length : 0;
  }

  // Step 5: strongest conviction on top; reverse so newest date is column 0
  // (same orientation as fetchIndexFlowMap — MicroTrend un-reverses for its
  // chronological read)
  const sortedRows = Object.keys(cellMap).sort((a, b) => (avgS5[b] ?? 0) - (avgS5[a] ?? 0));
  const reversedDates = [...formattedDates].reverse();
  for (const sym of Object.keys(cellMap)) {
    cellMap[sym] = [...cellMap[sym]].reverse();
  }
  return { rows: sortedRows, dates: reversedDates, cells: cellMap, rowMeta };
}

// ── Sector Pulse (Workspace · Discovery) ──────────────────────────────────────

export interface SectorPulseRow {
  id: number;
  name: string;
  isCustom: boolean;
  /** Score/flow cells, NEWEST FIRST (index 0 = latest session) — same shape
   *  the heatmap uses, so flowSignal() and MicroTrend consume them directly. */
  cells: FlowCellData[];
}

/**
 * Data for the Workspace Discovery "Sector Pulse" widget — sectoral + curated
 * indices with enough recent history to compute the 5-state money-flow signal
 * and render a micro-trend. Replaces the old industry-rank rotation panel
 * (owner decision 2026-07-06: the sector-index score framework is the stable
 * taxonomy; one verdict language across workspace and /sector-rotation).
 */
export async function fetchSectorPulse(days = 22): Promise<SectorPulseRow[]> {
  const { data: symbols, error: symErr } = await from('km_index_symbols')
    .select('id,name,category')
    .in('category', [...SECTOR_TAB_CATEGORIES.sectoral, ...SECTOR_TAB_CATEGORIES.custom])
    .is('is_active', 'true')
    .execute();
  if (symErr) throw new Error(`[sectorPulse] symbols: ${symErr.message}`);

  const syms = (symbols ?? []) as SectorIndexSymbol[];
  if (syms.length === 0) return [];
  const indexIds = syms.map((s) => s.id);

  const latestDate = await fetchLatestIndexDate();
  if (!latestDate) return [];
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - Math.ceil(days * 1.8));
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data: eodData, error: eodErr } = await from('km_index_eod')
    .select('index_id,trade_date,pct_chng,value_cr,score_5d,score_22d,avg_amt_5d,avg_amt_22d,ret_5d,ret_22d')
    .in('index_id', indexIds)
    .gte('trade_date', cutoffStr)
    .order('trade_date', { ascending: true })
    .execute();
  if (eodErr) throw new Error(`[sectorPulse] eod: ${eodErr.message}`);

  type Row = {
    index_id: number; trade_date: string; pct_chng: number | null; value_cr: number | null;
    score_5d: number | null; score_22d: number | null;
    avg_amt_5d: number | null; avg_amt_22d: number | null;
    ret_5d: number | null; ret_22d: number | null;
  };
  const byIndex = new Map<number, Row[]>();
  for (const r of (eodData ?? []) as Row[]) {
    const arr = byIndex.get(r.index_id) ?? [];
    arr.push(r);
    byIndex.set(r.index_id, arr);
  }

  const result: SectorPulseRow[] = [];
  for (const sym of syms) {
    const rows = byIndex.get(sym.id);
    if (!rows || rows.length === 0) continue;
    const cells: FlowCellData[] = [...rows].reverse().slice(0, days).map((r) => ({
      d1:      r.pct_chng ?? 0,
      amt:     r.value_cr ?? 0,
      s5:      r.score_5d  ?? undefined,
      s22:     r.score_22d ?? undefined,
      amt_5d:  r.avg_amt_5d  ?? undefined,
      amt_22d: r.avg_amt_22d ?? undefined,
      ret_5d:  r.ret_5d  ?? undefined,
      ret_22d: r.ret_22d ?? undefined,
    }));
    result.push({ id: sym.id, name: sym.name, isCustom: sym.category === 'custom', cells });
  }
  return result;
}

// ── Stock membership (Study cockpit) ──────────────────────────────────────────

export interface StockMembership {
  id: number;
  name: string;
  isCurated: boolean;
}

/**
 * Which indices does this stock belong to? Official NSE indices come from
 * km_equity_symbols.index_names[]; curated themes from km_index_constituents.
 * Names are resolved against active km_index_symbols so every chip can link
 * to its /sector-rotation drilldown.
 */
export async function fetchStockMembership(equityId: number): Promise<StockMembership[]> {
  const [symRes, idxRes, constRes] = await Promise.all([
    from('km_equity_symbols')
      .select('id,index_names')
      .eq('id', equityId)
      .limit(1)
      .execute(),
    from('km_index_symbols')
      .select('id,name,category')
      .is('is_active', 'true')
      .execute(),
    from('km_index_constituents')
      .select('index_id')
      .eq('equity_id', equityId)
      .execute(),
  ]);

  if (symRes.error) throw new Error(`[membership] symbol: ${symRes.error.message}`);
  if (idxRes.error) throw new Error(`[membership] indices: ${idxRes.error.message}`);
  if (constRes.error) throw new Error(`[membership] constituents: ${constRes.error.message}`);

  const indexNames: string[] =
    ((symRes.data ?? []) as { index_names: string[] | null }[])[0]?.index_names ?? [];
  const allIndices = (idxRes.data ?? []) as { id: number; name: string; category: string }[];
  const byName = new Map(allIndices.map((i) => [i.name.toUpperCase(), i]));
  const byId = new Map(allIndices.map((i) => [i.id, i]));

  const result = new Map<number, StockMembership>();

  for (const n of indexNames) {
    const idx = byName.get(n.toUpperCase());
    if (idx) result.set(idx.id, { id: idx.id, name: idx.name, isCurated: idx.category === 'custom' });
  }
  for (const c of (constRes.data ?? []) as { index_id: number }[]) {
    const idx = byId.get(c.index_id);
    if (idx && !result.has(idx.id)) {
      result.set(idx.id, { id: idx.id, name: idx.name, isCurated: idx.category === 'custom' });
    }
  }

  // Curated themes first (the user built those lenses), then alphabetical.
  return [...result.values()].sort(
    (a, b) => Number(b.isCurated) - Number(a.isCurated) || a.name.localeCompare(b.name),
  );
}

// ── Index Breadth (per-index, computed client-side) ───────────────────────────

const BREADTH_LOOKBACK = 252;  // sessions for percentile history
const BREADTH_FLOOR    = 126;  // min sessions before percentile mode activates
// Min constituents — below this, suppress the gauge entirely (breadth of a
// handful of names is per-stock noise, Breadth_ROC_Spec §4). Lowered 8→5 for
// small curated themes (owner decision 2026-07-05), matching the ≥5-stock
// rule used for km_industry_eod. 5–7 constituents render with a
// small-sample caption (BREADTH_SMALL_N) rather than being hidden.
export const BREADTH_MIN_N   = 5;
export const BREADTH_SMALL_N = 8;

export type RocBadge = 'expanding' | 'slowing' | 'turning' | 'contracting' | 'warming_up';

export interface IndexBreadthResult {
  /** Computed breadth rows, oldest first. Length = min(days, available sessions). */
  data: MarketBreadthDay[];
  /** Computed ROC rows, oldest first. Length = min(days, available sessions). */
  roc: BreadthRocDay[];
  /** 0–1 percentile rank of latest score in the index's own history. Null if < BREADTH_FLOOR sessions. */
  percentileRank: number | null;
  /** Number of constituents found in km_index_constituents for this index. */
  stockCount: number;
  /**
   * 'absolute'    — fewer than BREADTH_FLOOR sessions; use NSE 35/55 zones.
   * 'provisional' — BREADTH_FLOOR ≤ sessions < BREADTH_LOOKBACK; percentile + provisional label.
   * 'percentile'  — full BREADTH_LOOKBACK history available; relative zones.
   */
  zoneMode: 'absolute' | 'provisional' | 'percentile';
  /** Badge key derived from latest roc_13 vs sma_breadth. */
  rocBadge: RocBadge;
}

/**
 * Compute market breadth for a specific index from constituent-level EOD data.
 *
 * Two PostgREST calls:
 *   1. km_index_constituents — resolve equity_id set for this index
 *   2. v_equity_eod_deduped  — fetch close/ema_20/sma_50/sma_150 for those IDs
 *
 * Computation (per Breadth_ROC_Spec_v1.0 §2):
 *   p20  = count(close > ema_20)  / N_with_valid_ema20
 *   p50  = count(close > sma_50)  / N_with_valid_sma50
 *   p150 = count(close > sma_150) / N_with_valid_sma150
 *   BreadthScore = 100 × (0.50·p20 + 0.30·p50 + 0.20·p150)
 *
 * Constituents with ema_20/sma_50/sma_150 = 0 or null are excluded from that
 * ratio's denominator (new listings / insufficient price history).
 */
export async function fetchIndexBreadth(
  indexId: number,
  days = 66,
): Promise<IndexBreadthResult> {
  // ── Step 1: resolve constituent equity IDs ────────────────────────────────
  const { data: constData, error: constErr } = await from('km_index_constituents')
    .select('equity_id')
    .eq('index_id', indexId)
    .execute();
  if (constErr) throw new Error(`[indexBreadth] constituents: ${constErr.message}`);

  const equityIds = ((constData ?? []) as { equity_id: number }[]).map((r) => r.equity_id);
  const stockCount = equityIds.length;

  if (stockCount < BREADTH_MIN_N) {
    return { data: [], roc: [], percentileRank: null, stockCount, zoneMode: 'absolute', rocBadge: 'warming_up' };
  }

  // ── Step 2: fetch constituent EOD from the deduped view ───────────────────
  // Calendar cutoff = 1.6× trading days to safely cover BREADTH_LOOKBACK sessions.
  const calendarDays = Math.ceil(BREADTH_LOOKBACK * 1.6);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - calendarDays);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const { data: eodData, error: eodErr } = await from('v_equity_eod_deduped')
    .select('equity_id,trade_date,close,pct_chng,ema_20,sma_50,sma_150')
    .in('equity_id', equityIds)
    .gte('trade_date', cutoff)
    .order('trade_date', { ascending: true })
    .execute();
  if (eodErr) throw new Error(`[indexBreadth] eod: ${eodErr.message}`);

  // ── Step 3: group by date and compute breadth score ───────────────────────
  type EodRow = {
    equity_id: number;
    trade_date: string;
    close:    number | null;
    pct_chng: number | null;
    ema_20:  number | null;
    sma_50:  number | null;
    sma_150: number | null;
  };
  const rows = (eodData ?? []) as EodRow[];

  const byDate = new Map<string, EodRow[]>();
  for (const row of rows) {
    if (!byDate.has(row.trade_date)) byDate.set(row.trade_date, []);
    byDate.get(row.trade_date)!.push(row);
  }

  // Per-equity trailing 5-session return (for the >20%/5D thrust rows). Rows are
  // date-ascending, so grouping by equity preserves order. Warm-up (first 5
  // sessions per stock) has no value → left undefined (honest blank, not 0).
  const byEquity = new Map<number, EodRow[]>();
  for (const row of rows) {
    if (!byEquity.has(row.equity_id)) byEquity.set(row.equity_id, []);
    byEquity.get(row.equity_id)!.push(row);
  }
  const ret5dKey = (eq: number, d: string) => `${eq}|${d}`;
  const ret5d = new Map<string, number>();
  for (const [eq, series] of byEquity) {
    for (let i = 5; i < series.length; i++) {
      const c = series[i].close, base = series[i - 5].close;
      if (c != null && base != null && base > 0) {
        ret5d.set(ret5dKey(eq, series[i].trade_date), (c / base - 1) * 100);
      }
    }
  }

  const allDates = [...byDate.keys()].sort();

  const computed: MarketBreadthDay[] = allDates.map((date) => {
    const dayRows = byDate.get(date)!;
    let n20 = 0, a20 = 0;
    let n50 = 0, a50 = 0;
    let n150 = 0, a150 = 0;

    for (const r of dayRows) {
      if (r.close == null) continue;
      // Exclude constituent from denominator if indicator is null or 0 (warm-up / new listing)
      if (r.ema_20  != null && r.ema_20  > 0) { n20++;  if (r.close > r.ema_20)  a20++;  }
      if (r.sma_50  != null && r.sma_50  > 0) { n50++;  if (r.close > r.sma_50)  a50++;  }
      if (r.sma_150 != null && r.sma_150 > 0) { n150++; if (r.close > r.sma_150) a150++; }
    }

    const p20  = n20  > 0 ? a20  / n20  : 0;
    const p50  = n50  > 0 ? a50  / n50  : 0;
    const p150 = n150 > 0 ? a150 / n150 : 0;
    const anyValid = n20 > 0 || n50 > 0 || n150 > 0;

    // ── Movers / thrust over a single universe = constituents with a valid
    //    150-MA (mirrors the market-wide compute so above+below=universe). ──
    let universe = 0, au20 = 0, au50 = 0, au150 = 0;
    let up5 = 0, dn5 = 0, up20 = 0, dn20 = 0;
    let any5d = false;
    for (const r of dayRows) {
      if (r.close == null) continue;
      if (!(r.sma_150 != null && r.sma_150 > 0)) continue;   // universe gate
      universe++;
      if (r.ema_20 != null && r.ema_20 > 0 && r.close > r.ema_20) au20++;
      if (r.sma_50 != null && r.sma_50 > 0 && r.close > r.sma_50) au50++;
      if (r.close > r.sma_150) au150++;
      if (r.pct_chng != null) {
        if (r.pct_chng >  5) up5++;
        else if (r.pct_chng < -5) dn5++;
      }
      const r5 = ret5d.get(ret5dKey(r.equity_id, date));
      if (r5 != null) {
        any5d = true;
        if (r5 >  20) up20++;
        else if (r5 < -20) dn20++;
      }
    }
    const hasU = universe > 0;

    return {
      trade_date:    date,
      pct_above_20:  n20  > 0 ? Math.round(p20  * 1000) / 10 : null,
      pct_above_50:  n50  > 0 ? Math.round(p50  * 1000) / 10 : null,
      pct_above_150: n150 > 0 ? Math.round(p150 * 1000) / 10 : null,
      breadth_score: anyValid
        ? Math.round((100 * (0.50 * p20 + 0.30 * p50 + 0.20 * p150)) * 10) / 10
        : null,
      stock_count: dayRows.length,
      universe_count: hasU ? universe : null,
      above_20:  hasU ? au20  : null,
      above_50:  hasU ? au50  : null,
      above_150: hasU ? au150 : null,
      up_5pct:   hasU ? up5 : null,
      down_5pct: hasU ? dn5 : null,
      up_20pct_5d:   any5d ? up20 : null,
      down_20pct_5d: any5d ? dn20 : null,
    };
  });

  // ── Step 4: zone mode + percentile rank ───────────────────────────────────
  const historyLen = computed.length;
  const zoneMode: IndexBreadthResult['zoneMode'] =
    historyLen < BREADTH_FLOOR    ? 'absolute'    :
    historyLen < BREADTH_LOOKBACK ? 'provisional' :
    'percentile';

  let percentileRank: number | null = null;
  if (zoneMode !== 'absolute') {
    const latestScore = computed.at(-1)?.breadth_score ?? null;
    if (latestScore != null) {
      const scores = computed
        .map((d) => d.breadth_score)
        .filter((s): s is number => s != null);
      const below = scores.filter((s) => s < latestScore).length;
      percentileRank = scores.length > 0 ? below / scores.length : null;
    }
  }

  // ── Step 6: per-constituent ROC → index-level average ROC ────────────────────
  const dateIdx = new Map<string, number>(allDates.map((d, i) => [d, i]));
  const constituentSeries = new Map<number, Map<number, number>>();

  for (const row of rows) {
    if (row.close == null) continue;
    const i = dateIdx.get(row.trade_date);
    if (i == null) continue;
    if (!constituentSeries.has(row.equity_id)) constituentSeries.set(row.equity_id, new Map());
    constituentSeries.get(row.equity_id)!.set(i, row.close);
  }

  const rocRaw: { trade_date: string; roc_13: number | null; roc_55: number | null; stock_count: number }[] = [];

  for (let i = 0; i < allDates.length; i++) {
    const r13: number[] = [];
    const r55: number[] = [];
    for (const series of constituentSeries.values()) {
      const c0 = series.get(i);
      if (c0 == null || c0 === 0) continue;
      if (i >= 13) {
        const c13 = series.get(i - 13);
        if (c13 != null && c13 > 0) r13.push((c0 / c13 - 1) * 100);
      }
      if (i >= 55) {
        const c55 = series.get(i - 55);
        if (c55 != null && c55 > 0) r55.push((c0 / c55 - 1) * 100);
      }
    }
    rocRaw.push({
      trade_date: allDates[i],
      roc_13: r13.length > 0 ? r13.reduce((a, b) => a + b, 0) / r13.length : null,
      roc_55: r55.length > 0 ? r55.reduce((a, b) => a + b, 0) / r55.length : null,
      stock_count: byDate.get(allDates[i])?.length ?? 0,
    });
  }

  const roc: BreadthRocDay[] = rocRaw.map((row, i) => {
    let sma_breadth: number | null = null;
    if (i >= 4) {
      const window = rocRaw.slice(i - 4, i + 1).map((r) => r.roc_13).filter((v): v is number => v != null);
      if (window.length === 5) sma_breadth = window.reduce((a, b) => a + b, 0) / 5;
    }
    return { ...row, sma_breadth };
  });

  const latestRoc = roc.at(-1);
  const rocBadge: RocBadge = (() => {
    if (!latestRoc || latestRoc.roc_13 == null || latestRoc.sma_breadth == null) return 'warming_up';
    const r = latestRoc.roc_13;
    const s = latestRoc.sma_breadth;
    if (r > 0 && r > s)  return 'expanding';
    if (r > 0 && r <= s) return 'slowing';
    if (r <= 0 && r > s) return 'turning';
    return 'contracting';
  })();

  // ── Step 7: trim to display window ───────────────────────────────────────────
  return {
    data:    computed.slice(-days),
    roc:     roc.slice(-days),
    percentileRank,
    stockCount,
    zoneMode,
    rocBadge,
  };
}

/**
 * Fetches last `days` trading days of per-index flow data for a category.
 * category accepts a single string or string[] (for broad tab multi-category).
 * Rows sorted by latest ret_5d DESC.
 */
export async function fetchIndexFlowMap(
  category: string | string[],
  days: 5 | 22 | 66,
): Promise<FlowMapData> {
  const categories = Array.isArray(category) ? category : [category];

  // Step 1: active indices for this category
  const { data: idxData, error: idxErr } = await from('km_index_symbols')
    .select('id,name')
    .in('category', categories)
    .is('is_active', 'true')
    .execute();
  if (idxErr) throw new Error(`[indexFlowMap] indices: ${idxErr.message}`);

  const indices = (idxData ?? []) as { id: number; name: string }[];
  if (indices.length === 0) return { rows: [], dates: [], cells: {} };

  const idxMap  = new Map<number, string>(indices.map((r) => [r.id, r.name]));
  const indexIds = indices.map((r) => r.id);

  // Step 2: latest N trade dates from first index's EOD
  const anchorId = indexIds[0];
  const { data: dateData, error: dateErr } = await from('km_index_eod')
    .select('trade_date')
    .eq('index_id', anchorId)
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (dateErr || !dateData || dateData.length === 0) return { rows: [], dates: [], cells: {} };

  const sortedDates = ((dateData as { trade_date: string }[])
    .map((r) => r.trade_date))
    .sort();                        // oldest first
  const earliestDate = sortedDates[0];

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };
  const formattedDates = sortedDates.map(fmtDate);

  // Step 3: fetch EOD for all indices in the date window
  const { data: eodData, error: eodErr } = await from('km_index_eod')
    .select('index_id,trade_date,pct_chng,value_cr,avg_amt_5d,avg_amt_22d,ret_5d,ret_22d,score_5d,score_22d')
    .in('index_id', indexIds)
    .gte('trade_date', earliestDate)
    .order('trade_date', { ascending: true })
    .execute();
  if (eodErr) throw new Error(`[indexFlowMap] eod: ${eodErr.message}`);

  type IxRow = {
    index_id: number; trade_date: string; pct_chng: number | null;
    value_cr: number | null; avg_amt_5d: number | null; avg_amt_22d: number | null;
    ret_5d: number | null; ret_22d: number | null;
    score_5d: number | null; score_22d: number | null;
  };
  const allRows = (eodData ?? []) as IxRow[];

  // Step 4: build cell arrays
  const cellMap:   Record<string, FlowCellData[]> = {};
  const latestRet: Record<string, number>          = {};

  for (const indexId of indexIds) {
    const name = idxMap.get(indexId);
    if (!name) continue;

    const byDate = new Map<string, IxRow>();
    for (const r of allRows) {
      if (r.index_id === indexId) byDate.set(r.trade_date, r);
    }

    const row: FlowCellData[] = sortedDates.map((d) => {
      const r = byDate.get(d);
      if (!r) return { d1: 0, amt: 0 };
      return {
        d1:      r.pct_chng   ?? 0,
        amt:     r.value_cr   ?? 0,
        amt_5d:  r.avg_amt_5d  ?? undefined,
        amt_22d: r.avg_amt_22d ?? undefined,
        ret_5d:  r.ret_5d      ?? undefined,
        ret_22d: r.ret_22d     ?? undefined,
        s5:      r.score_5d    ?? undefined,
        s22:     r.score_22d   ?? undefined,
      };
    });

    cellMap[name] = row;
    const last = [...row].reverse().find((c) => c.ret_5d != null);
    latestRet[name] = last?.ret_5d ?? 0;
  }

  // Step 5: sort by latest ret_5d DESC, reverse so newest date is column 0
  const sortedRows = Object.keys(cellMap).sort((a, b) => (latestRet[b] ?? 0) - (latestRet[a] ?? 0));
  const reversedIdxDates = [...formattedDates].reverse();
  for (const name of Object.keys(cellMap)) {
    cellMap[name] = [...cellMap[name]].reverse();
  }
  return { rows: sortedRows, dates: reversedIdxDates, cells: cellMap };
}

