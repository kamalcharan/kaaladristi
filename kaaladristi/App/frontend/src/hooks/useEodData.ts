/**
 * EOD chart data hooks — always uses Edge Function.
 *
 * No fallback to direct Supabase or mock. If the edge function
 * fails, React Query surfaces the error to the UI.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchEodChart } from '@/services/edgeFunctions';
import type { MarketSymbol, TimeRange, ChartDataPoint, IndexStats } from '@/types';

export function useIndexChart(symbol: MarketSymbol, range: TimeRange) {
  return useQuery({
    queryKey: ['eod', 'edge-chart', symbol, range],
    queryFn: async (): Promise<{ chartData: ChartDataPoint[]; stats: IndexStats | null }> => {
      const res = await fetchEodChart(symbol, range);
      return {
        chartData: res.chartData.map(r => ({
          date: r.date,
          close: r.close ?? 0,
          open: r.open ?? 0,
          high: r.high ?? 0,
          low: r.low ?? 0,
          volume: r.volume ?? 0,
        })),
        stats: res.stats,
      };
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!symbol,
  });
}
