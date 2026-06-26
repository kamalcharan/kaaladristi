/**
 * Sector Rotation hooks — TanStack Query wrappers for sectorRotation service.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchSectorIndices,
  fetchVix,
  fetchIndexSparkline,
  fetchIndexSparklines,
  fetchConstituentDetails,
  fetchIndexDetail,
  fetchLatestIndexDate,
  fetchEarliestIndexDate,
  fetchIndexFlowIntensity,
  SECTOR_TAB_CATEGORIES,
  type SectorTab,
  type SectorIndexRow,
  type VixRow,
  type SparklinePoint,
  type ConstituentDetail,
  type FlowIntensityData,
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

/** Last 22 trading days of close prices for a single index. */
export function useIndexSparkline(indexId: number | null) {
  return useQuery<SparklinePoint[], Error>({
    queryKey: ['index-sparkline', indexId],
    queryFn: () => fetchIndexSparkline(indexId!),
    enabled: indexId != null,
    staleTime: STALE,
    retry: 1,
  });
}

/** Batch sparklines for multiple indices — only fetched when chart view is active. */
export function useIndexSparklines(indexIds: number[], enabled = true) {
  return useQuery<Map<number, SparklinePoint[]>, Error>({
    queryKey: ['index-sparklines', indexIds.join(',')],
    queryFn: () => fetchIndexSparklines(indexIds),
    enabled: enabled && indexIds.length > 0,
    staleTime: STALE,
    retry: 1,
  });
}

/** Symbol + EOD signals for a set of constituent equity IDs. */
export function useConstituentDetails(equityIds: number[], tradeDate: string) {
  return useQuery<ConstituentDetail[], Error>({
    queryKey: ['constituent-details', equityIds.join(','), tradeDate],
    queryFn: () => fetchConstituentDetails(equityIds, tradeDate),
    enabled: equityIds.length > 0 && !!tradeDate,
    staleTime: STALE,
    retry: 1,
  });
}

/** Latest EOD row + symbol metadata for a single index. */
export function useIndexDetail(indexId: number | undefined) {
  return useQuery<SectorIndexRow | null, Error>({
    queryKey: ['index-detail', indexId],
    queryFn: () => fetchIndexDetail(indexId!),
    enabled: indexId != null,
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

/** Flow intensity heatmap data for an index's constituents over the last N trading days. */
export function useIndexFlowIntensity(indexId: number | undefined, days = 22) {
  return useQuery<FlowIntensityData, Error>({
    queryKey: ['index-flow-intensity', indexId, days],
    queryFn: () => fetchIndexFlowIntensity(indexId!, days),
    enabled: indexId != null,
    staleTime: STALE,
    retry: 1,
  });
}

/**
 * Returns the earliest and latest available trade_date in km_index_eod.
 * Used to set min/max/default on the SectorRotation date picker.
 */
export function useIndexDateRange() {
  const latest = useQuery<string | null, Error>({
    queryKey: ['index-date-latest'],
    queryFn: fetchLatestIndexDate,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const earliest = useQuery<string | null, Error>({
    queryKey: ['index-date-earliest'],
    queryFn: fetchEarliestIndexDate,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  return {
    latestDate:   latest.data  ?? null,
    earliestDate: earliest.data ?? null,
    isLoading:    latest.isLoading || earliest.isLoading,
  };
}
