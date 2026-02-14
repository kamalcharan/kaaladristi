import { useQuery } from '@tanstack/react-query';
import {
  fetchPlanets,
  fetchNakshatras,
  fetchNakshatraLords,
  fetchZodiacSigns,
  fetchZodiacLords,
  fetchSectors,
  fetchSectorLords,
  fetchIndices,
  fetchIndexComposition,
  fetchIndexSectorBreakdown,
} from '@/services/masterData';

// Master data is static — cache aggressively (1 hour stale, never garbage collected)
const MASTER_OPTS = { staleTime: 60 * 60 * 1000, gcTime: Infinity } as const;

export function usePlanets() {
  return useQuery({ queryKey: ['km', 'planets'], queryFn: fetchPlanets, ...MASTER_OPTS });
}

export function useNakshatras() {
  return useQuery({ queryKey: ['km', 'nakshatras'], queryFn: fetchNakshatras, ...MASTER_OPTS });
}

export function useNakshatraLords() {
  return useQuery({ queryKey: ['km', 'nakshatra_lords'], queryFn: fetchNakshatraLords, ...MASTER_OPTS });
}

export function useZodiacSigns() {
  return useQuery({ queryKey: ['km', 'zodiac_signs'], queryFn: fetchZodiacSigns, ...MASTER_OPTS });
}

export function useZodiacLords() {
  return useQuery({ queryKey: ['km', 'zodiac_lords'], queryFn: fetchZodiacLords, ...MASTER_OPTS });
}

export function useSectors() {
  return useQuery({ queryKey: ['km', 'sectors'], queryFn: fetchSectors, ...MASTER_OPTS });
}

export function useSectorLords() {
  return useQuery({ queryKey: ['km', 'sector_lords'], queryFn: fetchSectorLords, ...MASTER_OPTS });
}

export function useIndices() {
  return useQuery({ queryKey: ['km', 'indices'], queryFn: fetchIndices, ...MASTER_OPTS });
}

export function useIndexComposition(indexId: number | undefined) {
  return useQuery({
    queryKey: ['km', 'index_composition', indexId],
    queryFn: () => fetchIndexComposition(indexId!),
    enabled: !!indexId,
    ...MASTER_OPTS,
  });
}

export function useIndexSectorBreakdown(indexId: number | undefined) {
  return useQuery({
    queryKey: ['km', 'index_sector_breakdown', indexId],
    queryFn: () => fetchIndexSectorBreakdown(indexId!),
    enabled: !!indexId,
    ...MASTER_OPTS,
  });
}
