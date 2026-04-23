import { useQuery } from '@tanstack/react-query';
import { executeScan, getAllScanCounts, fetchScanPresets, SCAN_PRESETS, type ExchangeFilter, type ScanCountsResult } from '@/services/scanEngine';
import type { ScanStock, ScanDefinition } from '@/types';

export function useScan(scanId: string, exchangeFilter: ExchangeFilter = 'combined') {
  return useQuery<ScanStock[]>({
    queryKey: ['scan', scanId, exchangeFilter],
    queryFn: () => executeScan(scanId, exchangeFilter),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useAllScanCounts(exchangeFilter: ExchangeFilter = 'combined') {
  return useQuery<ScanCountsResult>({
    queryKey: ['scan_counts', exchangeFilter],
    queryFn: () => getAllScanCounts(exchangeFilter),
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
