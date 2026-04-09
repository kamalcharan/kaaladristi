import { useQuery } from '@tanstack/react-query';
import { fetchPanchang, fetchMarketBreadth } from '@/services/panchang';
import { fetchInferencesForRange } from '@/services/dcInference';
import { from } from '@/services/postgrest';
import type { IndexCatalogItem } from '@/types';

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function usePanchang(date: string) {
  return useQuery({
    queryKey: ['panchang', date],
    queryFn: () => fetchPanchang(date),
    staleTime: 5 * 60 * 1000, // 5 min — allows DB updates to reflect quickly
    enabled: !!date,
  });
}

export function useMarketBreadth(days = 60) {
  return useQuery({
    queryKey: ['market_breadth', days],
    queryFn: () => fetchMarketBreadth(days),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePanchangInsight(date: string) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['panchang_insight', date],
    queryFn: async (): Promise<{ date: string; insight: string | null; ai: boolean }> => {
      const res = await fetch(`${pipelineUrl}/api/ai/panchang-insight?date=${encodeURIComponent(date)}`);
      if (!res.ok) return { date, insight: null, ai: false };
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h — daily insight is stable
    enabled: !!date,
    retry: false,
  });
}

/** Inferences active across the next 6 trading days (from tomorrow, Mon–Fri only). */
export function useOutlookInferences(fromDate: string) {
  const start = shiftDate(fromDate, 1);
  const end   = shiftDate(fromDate, 14); // 14 calendar days comfortably covers 6 trading days
  return useQuery({
    queryKey: ['outlook_inferences', fromDate],
    queryFn: () => fetchInferencesForRange(start, end),
    staleTime: 30 * 60 * 1000,
    enabled: !!fromDate,
  });
}

export function useActiveIndexes() {
  return useQuery({
    queryKey: ['active_indexes'],
    queryFn: async (): Promise<IndexCatalogItem[]> => {
      const { data, error } = await from('mv_index_catalog')
        .select('*')
        .eq('is_active', 1) // PostgREST booleans passed as 1/true
        .order('name', { ascending: true })
        .execute();
      if (error) throw new Error(`[mv_index_catalog] ${error.message}`);
      // Filter client-side as fallback (boolean handling varies)
      const rows = (data ?? []) as IndexCatalogItem[];
      return rows.filter(r => r.is_active && r.record_count > 0);
    },
    staleTime: 10 * 60 * 1000,
  });
}
