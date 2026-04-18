import { useQuery } from '@tanstack/react-query';
import { executeScan, getAllScanCounts, type ExchangeFilter } from '@/services/scanEngine';
import type { ScanStock } from '@/types';

export function useScan(scanId: string, exchangeFilter: ExchangeFilter = 'combined') {
  return useQuery<ScanStock[]>({
    queryKey: ['scan', scanId, exchangeFilter],
    queryFn: () => executeScan(scanId, exchangeFilter),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useAllScanCounts(exchangeFilter: ExchangeFilter = 'combined') {
  return useQuery<Record<string, number>>({
    queryKey: ['scan_counts', exchangeFilter],
    queryFn: () => getAllScanCounts(exchangeFilter),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
