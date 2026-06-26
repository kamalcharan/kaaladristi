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
  fetchConstituentFlowMap,
  fetchIndexFlowMap,
  fetchIndexBreadth,
  SECTOR_TAB_CATEGORIES,
  type SectorTab,
  type SectorIndexRow,
  type VixRow,
  type SparklinePoint,
  type ConstituentDetail,
  type FlowMapData,
  type IndexBreadthResult,
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

/** Per-constituent flow intensity heatmap for an index over the last 22 sessions. */
export function useConstituentFlowMap(indexId: number | null) {
  return useQuery<FlowMapData, Error>({
    queryKey: ['constituentFlowMap', indexId],
    queryFn:  () => fetchConstituentFlowMap(indexId!, 22),
    enabled:  indexId != null,
    staleTime: STALE,
    retry: 1,
  });
}

/** Per-index flow heatmap for a sector tab category over N trading days. */
export function useIndexFlowMap(tab: SectorTab, days: 5 | 22 | 66) {
  const categories = SECTOR_TAB_CATEGORIES[tab];
  return useQuery<FlowMapData, Error>({
    queryKey: ['indexFlowMap', tab, days],
    queryFn:  () => fetchIndexFlowMap(categories, days),
    enabled:  categories.length > 0,
    staleTime: STALE,
    retry: 1,
  });
}

/** Computed market breadth + ROC series for a specific index. */
export function useIndexBreadth(indexId: number | null, days = 66) {
  return useQuery<IndexBreadthResult, Error>({
    queryKey: ['indexBreadth', indexId, days],
    queryFn:  () => fetchIndexBreadth(indexId!, days),
    enabled:  indexId !== null,
    staleTime: STALE,
    retry: 1,
  });
}
