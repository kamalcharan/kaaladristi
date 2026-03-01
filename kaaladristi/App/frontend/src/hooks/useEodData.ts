import { useQuery } from '@tanstack/react-query';
import { fetchIndexChartData, fetchIndexSymbol, fetchIndexEod } from '@/services/eodData';
import type { MarketSymbol, TimeRange, KmIndexEod } from '@/types';

export function useIndexChart(symbol: MarketSymbol, range: TimeRange) {
  return useQuery({
    queryKey: ['eod', 'index-chart', symbol, range],
    queryFn: () => fetchIndexChartData(symbol, range),
    staleTime: 10 * 60 * 1000, // 10 min — EOD data doesn't change intraday
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Fetch full KmIndexEod rows (OHLCV + all indicator columns).
 * Used by LuckyPopChart.
 */
export function useIndexEodFull(symbol: MarketSymbol, range: TimeRange) {
  return useQuery<KmIndexEod[]>({
    queryKey: ['eod', 'index-full', symbol, range],
    queryFn: async () => {
      const index = await fetchIndexSymbol(symbol);
      if (!index) return [];
      return fetchIndexEod(index.id, range);
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
