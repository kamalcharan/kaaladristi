import { useQuery } from '@tanstack/react-query';
import { fetchIndicatorData } from '@/services/indicatorData';
import type { MarketSymbol, TimeRange } from '@/types';

export function useIndicatorChart(symbol: MarketSymbol, range: TimeRange) {
  return useQuery({
    queryKey: ['indicators', 'chart', symbol, range],
    queryFn: () => fetchIndicatorData(symbol, range),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
