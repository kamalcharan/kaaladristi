import { useQuery } from '@tanstack/react-query';
import { executeScan, getAllScanCounts, fetchScanPresets, fetchVaniHighlights, SCAN_PRESETS, type ExchangeFilter, type ScanTimeframe, type ScanCountsResult, type VaniHighlights } from '@/services/scanEngine';
import type { ScanStock, ScanDefinition } from '@/types';

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

export function useScan(
  scanId: string,
  exchangeFilter: ExchangeFilter = 'combined',
  timeframe: ScanTimeframe = 'daily',
) {
  return useQuery<ScanStock[]>({
    queryKey: ['scan', scanId, exchangeFilter, timeframe],
    queryFn: () => executeScan(scanId, exchangeFilter, timeframe),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useAllScanCounts(exchangeFilter: ExchangeFilter = 'combined') {
  return useQuery<ScanCountsResult>({
    queryKey: ['scan_counts', exchangeFilter],
    queryFn: () => getAllScanCounts(exchangeFilter, 'daily'), // landing always daily
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

/** Union of ✦ VaNi Highlights across all scanners (Workspace Discovery board). */
export function useVaniHighlights() {
  return useQuery<VaniHighlights>({
    queryKey: ['vani_highlights'],
    queryFn: fetchVaniHighlights,
    staleTime: 3 * 60 * 1000,
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
