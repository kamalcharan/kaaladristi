import { useQuery } from '@tanstack/react-query';
import { executeScan, getAllScanCounts, fetchScanPresets, SCAN_PRESETS, type ExchangeFilter, type ScanTimeframe, type ScanCountsResult } from '@/services/scanEngine';
import type { ScanStock, ScanDefinition } from '@/types';

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
