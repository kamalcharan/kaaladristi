import { useQuery } from '@tanstack/react-query';
import { executeScan, getAllScanCounts, type ExchangeFilter, type ScanCountsResult } from '@/services/scanEngine';
import { fetchConvictionFlow } from '@/services/convictionFlow';
import type { ScanStock, ConvictionFlowStock } from '@/types';

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

export function useConvictionFlow(date?: string) {
  return useQuery<ConvictionFlowStock[]>({
    queryKey: ['conviction_flow', date ?? 'today'],
    queryFn: () => fetchConvictionFlow(date),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
