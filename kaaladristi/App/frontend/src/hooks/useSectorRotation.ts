/**
 * Sector Rotation hooks — TanStack Query wrappers for sectorRotation service.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchSectorIndices,
  fetchVix,
  SECTOR_TAB_CATEGORIES,
  type SectorTab,
  type SectorIndexRow,
  type VixRow,
} from '@/services/sectorRotation';

const STALE = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches all active sector indices for a given tab, at the latest trade date
 * (or an optional historical date).
 */
export function useSectorIndices(tab: SectorTab, forDate?: string) {
  const categories = SECTOR_TAB_CATEGORIES[tab];
  return useQuery<SectorIndexRow[], Error>({
    queryKey: ['sector-indices', tab, forDate ?? 'latest'],
    queryFn: () => fetchSectorIndices(categories, forDate),
    staleTime: STALE,
    retry: 1,
  });
}

/**
 * Fetches the latest India VIX OHLC + returns (km_index_eod index_id = 94).
 */
export function useVix() {
  return useQuery<VixRow | null, Error>({
    queryKey: ['vix'],
    queryFn: fetchVix,
    staleTime: STALE,
    retry: 1,
  });
}
