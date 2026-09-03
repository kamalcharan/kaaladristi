import { useQuery } from '@tanstack/react-query';
import { executeScan, getAllScanCounts, fetchScanPresets, fetchVaniHighlights, fetchFpbActive, fetchScanReadyDate, fetchScanMembershipHistory, SCAN_PRESETS, type ExchangeFilter, type ScanTimeframe, type ScanCountsResult, type VaniHighlights, type FpbActiveRow, type ScanMembershipRow } from '@/services/scanEngine';
import type { ScanStock, ScanDefinition } from '@/types';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';

const PIPELINE_URL = import.meta.env.VITE_PIPELINE_API_URL ?? '';

export interface Stage2Stock {
  equity_id: number;
  trade_date: string;
  symbol: string;
  company_name: string;
  industry: string;
  exchange: string;
  isin: string;
  mcap_cr: number | null;
  close: number;
  sma_50: number | null;
  sma_150: number | null;
  sma_200: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  sniper_inst: number | null;
  supertrend_dir: number | null;
  rss_spread: number | null;
  rvol: number | null;
  w52_high: number | null;
  w52_low: number | null;
  lifetime_high: number | null;
  avg_amt_5d: number | null;
  avg_amt_22d: number | null;
  delivery_surge_x: number | null;
  pct_of_ath: number | null;
  pct_of_52wh: number | null;
  is_vani: boolean;
}

export interface Stage2Result {
  stocks: Stage2Stock[];
  total: number;
  vani_count: number;
}

export interface Stage2Filters {
  exchange?: string;
  industry?: string;
  mcap_min?: number;
  mcap_max?: number;
  pct_ath_min?: number;
  rs_min?: number;
  supertrend?: string;
  sort?: string;
  order?: string;
}

async function fetchStage2(filters: Stage2Filters): Promise<Stage2Result> {
  const params = new URLSearchParams();
  if (filters.exchange && filters.exchange !== 'combined') params.set('exchange', filters.exchange);
  if (filters.industry) params.set('industry', filters.industry);
  if (filters.mcap_min && filters.mcap_min > 0) params.set('mcap_min', String(filters.mcap_min));
  if (filters.mcap_max && filters.mcap_max > 0) params.set('mcap_max', String(filters.mcap_max));
  if (filters.pct_ath_min && filters.pct_ath_min > 0) params.set('pct_ath_min', String(filters.pct_ath_min));
  if (filters.rs_min && filters.rs_min > 0) params.set('rs_min', String(filters.rs_min));
  if (filters.supertrend) params.set('supertrend', filters.supertrend);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);
  const url = `${PIPELINE_URL}/api/scan/run/stage_2_leaders?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useStage2Scan(filters: Stage2Filters) {
  return useQuery<Stage2Result>({
    queryKey: ['stage2_scan', filters],
    queryFn: () => fetchStage2(filters),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

// Scan queries key on the PIPELINE-CONFIRMED data date (usePipelineStatus,
// polled every 60s), not just wall-clock staleTime.
//
// ⚠ History: the query key used to be ['scan', scanId, exchangeFilter,
// timeframe] — no date. React Query only refetches stale data when
// something TRIGGERS a check (mount, window focus, reconnect); it never
// refetches purely because time passed while a tab sat open and in focus.
// useMidnightDateRefresh (App.tsx) only updates a date-picker default — it
// invalidates nothing. Net effect: a tab left open through a day boundary
// (or several) could silently keep serving the previous day's — or older
// — scan results forever, with the header's data-date pill correctly
// showing today while the table underneath was frozen on a stale date, no
// visual cue anything was wrong. (Confirmed live: Breakout Surge showed a
// stock's 2-day-old close/1D%/breakout-level row verbatim while its actual
// latest EOD row already reflected the real current price.)
//
// Including latestDataDate in the key makes a pipeline-confirmed date
// change produce a genuinely NEW query — it fetches immediately on the
// next poll tick, no reliance on focus/mount timing at all. staleTime stays
// short as a secondary guard for exchange/timeframe/filter changes.
//
// The key is the SCANNER-READY date, not latestDataDate. Those diverge for the
// length of every daily run: the calendar is marked 'completed' at step 2 of
// 38, so latestDataDate advances the moment the bhavcopy lands, while the
// scanners keep serving the last fully processed session. Keyed on
// latestDataDate, the key would flip at ~18:02 (a refetch that returns the
// same previous session) and then NOT flip again when the run actually
// finished — leaving the owner on yesterday's rows until they reloaded by
// hand, which is the exact staleness this key exists to prevent. Keyed on the
// ready date it flips once, at the moment there is something new to show.
// Falls back to latestDataDate when the matview is unavailable.
function useScanDateKey(): string {
  const { latestDataDate } = usePipelineStatus();
  const { data: readyDate } = useScanReadyDate();
  return readyDate ?? latestDataDate ?? 'unknown';
}

export function useScan(
  scanId: string,
  exchangeFilter: ExchangeFilter = 'combined',
  timeframe: ScanTimeframe = 'daily',
) {
  const dateKey = useScanDateKey();
  return useQuery<ScanStock[]>({
    queryKey: ['scan', scanId, exchangeFilter, timeframe, dateKey],
    queryFn: () => executeScan(scanId, exchangeFilter, timeframe),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useAllScanCounts(exchangeFilter: ExchangeFilter = 'combined') {
  const dateKey = useScanDateKey();
  return useQuery<ScanCountsResult>({
    queryKey: ['scan_counts', exchangeFilter, dateKey],
    queryFn: () => getAllScanCounts(exchangeFilter, 'daily'), // landing always daily
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

/** Union of ✦ VaNi Highlights across all scanners (Workspace Discovery board). */
export function useVaniHighlights() {
  const dateKey = useScanDateKey();
  return useQuery<VaniHighlights>({
    queryKey: ['vani_highlights', dateKey],
    queryFn: fetchVaniHighlights,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

/** Recent Flower Pot releases + day-2 hold/crack verdict + stop/target. */
export function useFpbActive() {
  const dateKey = useScanDateKey();
  return useQuery<FpbActiveRow[]>({
    queryKey: ['fpb_active', dateKey],
    queryFn: fetchFpbActive,
    staleTime: 3 * 60 * 1000,
    retry: 0,
  });
}

/** Newest trade_date every scanner input exists for — the output of the last
 *  matview-building pipeline step, not the calendar's "completed" flag, which
 *  is written twenty steps earlier. Null when the matview is unavailable. */
export function useScanReadyDate() {
  return useQuery<string | null>({
    queryKey: ['scan_ready_date'],
    queryFn: fetchScanReadyDate,
    // Polled on the same 60s cadence as usePipelineStatus, and for the same
    // reason: this value flips exactly once a day, at the end of the nightly
    // run, and it is the trigger that swaps every scanner onto the new
    // session. Without the poll it would only move on focus or remount, so a
    // page left open through the run would sit on the previous session until
    // someone reloaded — the staleness this whole path exists to remove.
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

/** Day-over-day scan-membership history (km_scan_membership_daily) for the
 *  3 Phase-3 VaNi intents (new-since-yesterday / RS-flip / is-unusual) —
 *  see fetchScanMembershipHistory's own comment. `beforeDate` is the page's
 *  own live scan data date; this never includes that date's row. */
export function useScanMembershipHistory(presetId: string, beforeDate: string | null, lookbackDays = 10) {
  return useQuery<ScanMembershipRow[]>({
    queryKey: ['scanMembershipHistory', presetId, beforeDate, lookbackDays],
    queryFn: () => fetchScanMembershipHistory(presetId, beforeDate!, lookbackDays),
    enabled: !!beforeDate,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/** Preset definitions from DB, falls back to hardcoded SCAN_PRESETS if unavailable. */
export function useScanPresets() {
  return useQuery<ScanDefinition[]>({
    queryKey: ['scan_presets'],
    queryFn: fetchScanPresets,
    staleTime: 30 * 60 * 1000, // 30 min — rarely changes
    retry: 1,
    placeholderData: SCAN_PRESETS,
  });
}
