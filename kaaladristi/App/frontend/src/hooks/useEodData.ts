/**
 * EOD chart data hooks — delegates to edge function (production) or direct Supabase (fallback).
 *
 * VITE_DATA_MODE=snapshot → uses Edge Function /api/eod-chart (server-side downsampling)
 * VITE_DATA_MODE=mock     → uses direct Supabase query (existing behavior)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchIndexChartData } from '@/services/eodData';
import { fetchEodChart } from '@/services/edgeFunctions';
import type { MarketSymbol, TimeRange, ChartDataPoint, IndexStats } from '@/types';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'mock';

export function useIndexChart(symbol: MarketSymbol, range: TimeRange) {
  // Snapshot mode: Edge Function with server-side downsampling
  const edgeResult = useQuery({
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
    enabled: DATA_MODE === 'snapshot',
  });

  // Mock/fallback mode: direct Supabase query
  const directResult = useQuery({
    queryKey: ['eod', 'index-chart', symbol, range],
    queryFn: () => fetchIndexChartData(symbol, range),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: DATA_MODE !== 'snapshot',
  });

  return DATA_MODE === 'snapshot' ? edgeResult : directResult;
}
