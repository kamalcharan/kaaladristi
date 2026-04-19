import { useQuery } from '@tanstack/react-query';
import { fetchPanchang, fetchMarketBreadth, fetchBreadthRoc } from '@/services/panchang';
import { fetchAstroSignal, fetchAstroWeek } from '@/services/astro';
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

export function useMarketBreadth(days = 66) {
  return useQuery({
    queryKey: ['market_breadth', days],
    queryFn: () => fetchMarketBreadth(days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBreadthRoc(days = 66) {
  return useQuery({
    queryKey: ['breadth_roc', days],
    queryFn: () => fetchBreadthRoc(days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBreadthRocInsight() {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['breadth_roc_insight'],
    queryFn: async (): Promise<{ date: string; insight: string | null; ai: boolean }> => {
      const res = await fetch(`${pipelineUrl}/api/ai/breadth-roc-insight`);
      if (!res.ok) return { date: '', insight: null, ai: false };
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useBreadthInsight() {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['breadth_insight'],
    queryFn: async (): Promise<{ date: string; insight: string | null; ai: boolean }> => {
      const res = await fetch(`${pipelineUrl}/api/ai/breadth-insight`);
      if (!res.ok) return { date: '', insight: null, ai: false };
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1h — breadth insight is stable during the trading day
    retry: false,
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

export function useInstrumentInsight(id: number, type: string = 'index', date?: string) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['instrument_insight', type, id, date],
    queryFn: async (): Promise<{
      id: number; type: string; date: string;
      insight: string | null; ai: boolean; alignment: string;
    }> => {
      const params = new URLSearchParams({ id: String(id), type });
      if (date) params.set('date', date);
      const res = await fetch(`${pipelineUrl}/api/ai/instrument-insight?${params}`);
      if (!res.ok) return { id, type, date: date ?? '', insight: null, ai: false, alignment: '' };
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    enabled: !!id,
    retry: false,
  });
}

export function useMarketPulseInsight(date?: string) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['market_pulse_insight', date],
    queryFn: async (): Promise<{
      date: string; insight: string | null; ai: boolean; astro_direction: string;
    }> => {
      const params = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await fetch(`${pipelineUrl}/api/ai/market-pulse-insight${params}`);
      if (!res.ok) return { date: date ?? '', insight: null, ai: false, astro_direction: '' };
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
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

export function useAstroSignal(date: string) {
  return useQuery({
    queryKey: ['astro_signal', date],
    queryFn: () => fetchAstroSignal(date),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!date,
  });
}

export function useAstroWeek(fromDate: string) {
  const toDate = (() => {
    if (!fromDate) return '';
    const [y, m, d] = fromDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  })();
  return useQuery({
    queryKey: ['astro_week', fromDate],
    queryFn: () => fetchAstroWeek(fromDate, toDate),
    staleTime: 24 * 60 * 60 * 1000,
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
