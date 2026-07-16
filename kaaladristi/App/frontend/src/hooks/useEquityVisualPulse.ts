/**
 * useEquityVisualPulse — Data Fetch Hook for Equity Visual Pulse Page
 * ====================================================================
 * Fetches equity metadata, EOD bars (6 months), DC inferences,
 * manipulation status, scan presence, and industry context.
 *
 * Returns bar data (chronological: index 0 = oldest, N-1 = most recent).
 */

import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { getDaysInMonth, toIso } from '@/lib/dateUtils';
import type { PulseBar, DcInferenceEvent } from '@/services/visualPulseEngine';
import type { EquitySymbolRow, IndustryEodRow } from '@/types';

// ── Extended PulseBar with equity-specific SMA columns ─────────

export interface EquityPulseBar extends PulseBar {
  sma_21: number | null;
  sma_55: number | null;
  pct_chng: number | null;
  prev_close: number | null;
}

// ── Equity metadata ────────────────────────────────────────────

export interface EquityMeta {
  id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string | null;
  isin: string | null;
  is_active: boolean;
  mcap_cr?: number | null;
}

// ── Columns fetched from km_equity_eod ─────────────────────────

const EQUITY_PULSE_COLS = [
  'trade_date', 'open', 'high', 'low', 'close', 'prev_close', 'pct_chng', 'volume',
  'rvol', 'tvol',
  'rsi_14', 'mfi_14',
  'rss_value', 'rss_spread',
  'sma_21', 'sma_55', 'sma_150',
  'sniper_inst', 'sniper_hot',
  'flow_type', 'vacuum_flag', 'volume_divergence_flag',
  'accum_distrib',
  'magic_rs', 'magic_ma', 'magic_rs_zone',
].join(',');

// ── Fetch equity metadata ──────────────────────────────────────

async function fetchEquityMeta(equityId: number): Promise<EquityMeta | null> {
  const { data, error } = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry,exchange,isin,is_active,mcap_cr')
    .eq('id', equityId)
    .limit(1)
    .single()
    .execute();

  if (error || !data) return null;
  return data as EquityMeta;
}

// ── Fetch 6 months of EOD bars ─────────────────────────────────

async function fetchEquityBars(equityId: number): Promise<EquityPulseBar[]> {
  const { data, error } = await from('km_equity_eod')
    .select(EQUITY_PULSE_COLS)
    .eq('equity_id', equityId)
    .order('trade_date', { ascending: false })
    .limit(130) // ~6 months of trading days
    .execute();

  if (error) throw new Error(`Failed to fetch equity bars: ${error.message}`);

  const rows = (data ?? []) as EquityPulseBar[];
  rows.reverse(); // index 0 = oldest, N-1 = most recent
  return rows;
}

// ── Fetch DC inferences for current month ──────────────────────

async function fetchPulseInferences(): Promise<DcInferenceEvent[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const firstDay = toIso(year, month, 1);
  const lastDay = toIso(year, month, getDaysInMonth(year, month));

  const { data, error } = await from('dc_inference')
    .select('id,astro_event,start_date,end_date,market_impact,inference')
    .lte('start_date', lastDay)
    .order('start_date', { ascending: true })
    .limit(500)
    .execute();

  if (error) throw new Error(`Failed to fetch DC inferences: ${error.message}`);

  return ((data ?? []) as DcInferenceEvent[]).filter((r) =>
    r.end_date === null
      ? r.start_date >= firstDay
      : r.end_date >= firstDay,
  );
}

// ── Fetch industry EOD context ─────────────────────────────────

export interface IndustryContext {
  current: IndustryEodRow | null;
  previous: IndustryEodRow | null;
  totalIndustries: number;
  percentile: number;            // higher = stronger (99%ile = top)
  prevPercentile: number | null;
  category: 'rotating_in' | 'leading' | 'rotating_out' | 'stable';
  stockRank: number | null;      // this stock's rank within its industry by magic_rs
  industryStockCount: number;
}

async function fetchIndustryContext(industry: string | null): Promise<IndustryContext | null> {
  if (!industry) return null;

  // Fetch latest 6 dates of industry data
  const { data: dateRows, error: dateErr } = await from('km_industry_eod')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(360) // overfetch for dedup
    .execute();

  if (dateErr || !dateRows) return null;

  const dates = [...new Set((dateRows as { trade_date: string }[]).map((r) => r.trade_date))];
  dates.sort((a: string, b: string) => b.localeCompare(a));
  if (dates.length === 0) return null;

  const latestDate = dates[0];
  const lookbackDate = dates[Math.min(5, dates.length - 1)];

  // Fetch all industries for latest date + this industry for lookback
  const [allCurrent, prevRow] = await Promise.all([
    from('km_industry_eod')
      .select('*')
      .eq('trade_date', latestDate)
      .order('industry_rank', { ascending: true })
      .execute()
      .then((r) => (r.data ?? []) as IndustryEodRow[]),

    latestDate !== lookbackDate
      ? from('km_industry_eod')
        .select('*')
        .eq('trade_date', lookbackDate)
        .eq('industry', industry)
        .limit(1)
        .single()
        .execute()
        .then((r) => (r.data as IndustryEodRow) || null)
      : Promise.resolve(null),
  ]);

  const current = allCurrent.find((r) => r.industry === industry) ?? null;
  if (!current) return null;

  const totalIndustries = allCurrent.length;
  const percentile = Math.round((1 - current.industry_rank / totalIndustries) * 100);
  const topQuartileCutoff = Math.ceil(totalIndustries / 4);

  let prevPercentile: number | null = null;
  if (prevRow) {
    // Need total count from lookback to compute prev percentile accurately
    prevPercentile = Math.round((1 - prevRow.industry_rank / totalIndustries) * 100);
  }

  const percentileChange = prevPercentile !== null ? percentile - prevPercentile : 0;
  let category: IndustryContext['category'];
  if (percentileChange >= 10) category = 'rotating_in';
  else if (percentileChange <= -10) category = 'rotating_out';
  else if (current.industry_rank <= topQuartileCutoff) category = 'leading';
  else category = 'stable';

  return {
    current,
    previous: prevRow,
    totalIndustries,
    percentile,
    prevPercentile,
    category,
    stockRank: null,       // computed separately below
    industryStockCount: 0,
  };
}

// ── Fetch stock rank within its industry ───────────────────────

async function fetchStockRankInIndustry(
  equityId: number,
  industry: string | null,
): Promise<{ rank: number; total: number } | null> {
  if (!industry) return null;

  // Get equity IDs for this industry
  const { data: symData } = await from('km_equity_symbols')
    .select('id')
    .eq('industry', industry)
    .is('is_active', 'true')
    .limit(500)
    .execute();

  if (!symData || symData.length === 0) return null;
  const ids = (symData as { id: number }[]).map((s) => s.id);

  // Get latest indicator-complete date for this stock — gating on ema_20
  // avoids ranking against peers whose magic_rs hasn't computed yet during
  // the daily pipeline window, which would silently shuffle the rank.
  const { data: dateData } = await from('km_equity_eod')
    .select('trade_date')
    .eq('equity_id', equityId)
    .notNull('ema_20')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (!dateData || dateData.length === 0) return null;
  const latestDate = (dateData[0] as { trade_date: string }).trade_date;

  // Get magic_rs for all stocks in this industry on this date
  const { data: eodData } = await from('km_equity_eod')
    .select('equity_id,magic_rs')
    .in('equity_id', ids)
    .eq('trade_date', latestDate)
    .order('magic_rs', { ascending: false })
    .limit(500)
    .execute();

  if (!eodData) return null;

  const rows = eodData as { equity_id: number; magic_rs: number | null }[];
  const rank = rows.findIndex((r) => r.equity_id === equityId);
  return rank >= 0 ? { rank: rank + 1, total: rows.length } : null;
}

// ── Combined Hook ──────────────────────────────────────────────

export function useEquityVisualPulse(equityId: number | null) {
  const metaQuery = useQuery({
    queryKey: ['equity-vp-meta', equityId],
    queryFn: () => fetchEquityMeta(equityId!),
    staleTime: 30 * 60 * 1000, // 30 min — metadata rarely changes
    enabled: !!equityId,
  });

  const barsQuery = useQuery({
    queryKey: ['equity-vp-bars', equityId],
    queryFn: () => fetchEquityBars(equityId!),
    staleTime: 5 * 60 * 1000,
    enabled: !!equityId,
  });

  const dcQuery = useQuery({
    queryKey: ['equity-vp-dc-inferences'],
    queryFn: fetchPulseInferences,
    staleTime: 60 * 60 * 1000,
  });

  const industry = metaQuery.data?.industry ?? null;

  const industryQuery = useQuery({
    queryKey: ['equity-vp-industry', industry],
    queryFn: () => fetchIndustryContext(industry),
    staleTime: 5 * 60 * 1000,
    enabled: !!industry,
  });

  const rankQuery = useQuery({
    queryKey: ['equity-vp-rank', equityId, industry],
    queryFn: () => fetchStockRankInIndustry(equityId!, industry),
    staleTime: 5 * 60 * 1000,
    enabled: !!equityId && !!industry,
  });

  // Merge rank into industry context
  const industryContext: IndustryContext | null = industryQuery.data
    ? {
        ...industryQuery.data,
        stockRank: rankQuery.data?.rank ?? null,
        industryStockCount: rankQuery.data?.total ?? 0,
      }
    : null;

  return {
    meta: metaQuery.data ?? null,
    bars: (barsQuery.data ?? []) as EquityPulseBar[],
    dcInferences: dcQuery.data ?? [],
    industryContext,
    isLoading: metaQuery.isLoading || barsQuery.isLoading,
    error: metaQuery.error || barsQuery.error,
  };
}
