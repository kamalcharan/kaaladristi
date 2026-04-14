/**
 * useVisualPulse — Data Fetch Hook for Visual Pulse Page
 * =======================================================
 * Fetches last 60 bars from km_index_eod for a given index_id,
 * plus dc_inference events for the current month.
 *
 * Returns bar data (chronological: index 0 = oldest, N-1 = most recent)
 * and dc inference events for astro scoring.
 */

import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { getDaysInMonth, toIso } from '@/lib/dateUtils';
import type { PulseBar, DcInferenceEvent } from '@/services/visualPulseEngine';

// ── Columns fetched from km_index_eod ───────────────────────────

const PULSE_COLS = [
  'trade_date', 'open', 'high', 'low', 'close', 'volume',
  'rvol', 'tvol',
  'rsi_14', 'mfi_14',
  'rss_value', 'rss_spread',
  'sma_150',
  'sniper_inst', 'sniper_hot',
  'flow_type', 'vacuum_flag', 'volume_divergence_flag',
  'accum_distrib',
  'magic_rs', 'magic_ma', 'magic_rs_zone',
].join(',');

// ── Fetch 60 bars ───────────────────────────────────────────────

async function fetchPulseBars(indexId: number): Promise<PulseBar[]> {
  const { data, error } = await from('km_index_eod')
    .select(PULSE_COLS)
    .eq('index_id', indexId)
    .order('trade_date', { ascending: false })
    .limit(60)
    .execute();

  if (error) throw new Error(`Failed to fetch pulse bars: ${error.message}`);

  const rows = (data ?? []) as PulseBar[];
  // Reverse so index 0 = oldest, N-1 = most recent (NOW)
  rows.reverse();
  return rows;
}

// ── Fetch DC inferences for current month ───────────────────────

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

  // Filter to events active during this month
  return ((data ?? []) as DcInferenceEvent[]).filter((r) =>
    r.end_date === null
      ? r.start_date >= firstDay
      : r.end_date >= firstDay,
  );
}

// ── Combined Hook ───────────────────────────────────────────────

export interface VisualPulseData {
  bars: PulseBar[];
  dcInferences: DcInferenceEvent[];
}

export function useVisualPulse(indexId: number | null) {
  const barsQuery = useQuery({
    queryKey: ['visual-pulse-bars', indexId],
    queryFn: () => fetchPulseBars(indexId!),
    staleTime: 5 * 60 * 1000, // 5 min
    enabled: !!indexId,
  });

  const dcQuery = useQuery({
    queryKey: ['visual-pulse-dc-inferences'],
    queryFn: fetchPulseInferences,
    staleTime: 60 * 60 * 1000, // 1 hour — inferences don't change often
  });

  return {
    bars: barsQuery.data ?? [],
    dcInferences: dcQuery.data ?? [],
    isLoading: barsQuery.isLoading || dcQuery.isLoading,
    error: barsQuery.error || dcQuery.error,
  };
}
