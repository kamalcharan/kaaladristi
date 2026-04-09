import { useQuery } from '@tanstack/react-query';
import { fetchPanchang, fetchMarketBreadth } from '@/services/panchang';
import { from } from '@/services/postgrest';
import type { IndexCatalogItem } from '@/types';

export function usePanchang(date: string) {
  return useQuery({
    queryKey: ['panchang', date],
    queryFn: () => fetchPanchang(date),
    staleTime: 60 * 60 * 1000, // panchang is daily — cache 1h
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
