import { useQuery } from '@tanstack/react-query';
import { fetchIndexChartData } from '@/services/eodData';
import type { MarketSymbol, TimeRange } from '@/types';

export function useIndexChart(symbol: MarketSymbol, range: TimeRange) {
  return useQuery({
    queryKey: ['eod', 'index-chart', symbol, range],
    queryFn: () => fetchIndexChartData(symbol, range),
    staleTime: 10 * 60 * 1000, // 10 min — EOD data doesn't change intraday
    gcTime: 30 * 60 * 1000,
  });
}
