/**
 * Sector Rotation hooks — TanStack Query wrappers for sectorRotation service.
 */

import { useQuery } from '@tanstack/react-query';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';
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
  fetchSectorPulse,
  fetchStockMembership,
  SECTOR_TAB_CATEGORIES,
  type SectorPulseRow,
  type StockMembership,
  type SectorTab,
  type SectorIndexRow,
  type VixRow,
  type SparklinePoint,
  type ConstituentDetail,
  type FlowMapData,
  type IndexBreadthResult,
} from '@/services/sectorRotation';

const STALE = 5 * 60 * 1000; // 5 minutes

// ⚠ History: every hook below used to key purely on staleTime (5 min), with
// no date/freshness dimension in the queryKey. React Query only refetches
// stale data on a TRIGGER (mount, window focus, reconnect) — never purely
// because time passed while a tab sat open and in focus. Sector Rotation /
// Index Detail pages are commonly left open through market hours, so this
// was the same "stale cache key" bug fixed in hooks/useScan.ts, applied
// here. useDateKey() returns the pipeline-confirmed latest data date
// (polled every 60s) so a day change produces a genuinely new query key and
// refetches on the next poll tick — no dependency on focus/mount timing.
function useDateKey(): string {
  const { latestDataDate } = usePipelineStatus();
  return latestDataDate ?? 'unknown';
}

/**
 * Fetches all active sector indices for a given tab, at the latest trade date
 * (or an optional historical date).
 */
export function useSectorIndices(tab: SectorTab, forDate?: string) {
  const categories = SECTOR_TAB_CATEGORIES[tab];
  // A pinned historical forDate is a deliberate snapshot — no freshness
  // dimension needed. Only "latest" (forDate omitted) needs to track the
  // pipeline-confirmed date.
  const dateKey = useDateKey();
  return useQuery<SectorIndexRow[], Error>({
    queryKey: ['sector-indices', tab, forDate ?? `latest:${dateKey}`],
    queryFn: () => fetchSectorIndices(categories, forDate),
    staleTime: STALE,
    retry: 1,
  });
}

/** Sector Pulse (Workspace Discovery) — sectoral + curated indices with score cells. */
export function useSectorPulse() {
  const dateKey = useDateKey();
  return useQuery<SectorPulseRow[], Error>({
    queryKey: ['sector-pulse', dateKey],
    queryFn: () => fetchSectorPulse(),
    staleTime: STALE,
    retry: 1,
  });
}

/** Index/theme membership for one stock (Study cockpit membership card). */
export function useStockMembership(equityId: number | null) {
  return useQuery<StockMembership[], Error>({
    queryKey: ['stock-membership', equityId],
    queryFn: () => fetchStockMembership(equityId!),
    enabled: equityId != null,
    staleTime: STALE,
    retry: 1,
  });
}

/** Last 22 trading days of close prices for a single index. */
export function useIndexSparkline(indexId: number | null) {
  const dateKey = useDateKey();
  return useQuery<SparklinePoint[], Error>({
    queryKey: ['index-sparkline', indexId, dateKey],
    queryFn: () => fetchIndexSparkline(indexId!),
    enabled: indexId != null,
    staleTime: STALE,
    retry: 1,
  });
}

/** Batch sparklines for multiple indices — only fetched when chart view is active. */
export function useIndexSparklines(indexIds: number[], enabled = true) {
  const dateKey = useDateKey();
  return useQuery<Map<number, SparklinePoint[]>, Error>({
    queryKey: ['index-sparklines', indexIds.join(','), dateKey],
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
  const dateKey = useDateKey();
  return useQuery<SectorIndexRow | null, Error>({
    queryKey: ['index-detail', indexId, dateKey],
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
  const dateKey = useDateKey();
  return useQuery<VixRow | null, Error>({
    queryKey: ['vix', dateKey],
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
  // usePipelineStatus() (km_industry_eod, the LAST pipeline step) as the
  // refetch trigger for fetchLatestIndexDate() (km_index_eod, ema_20-gated,
  // an EARLIER step) — two independent freshness probes converging on the
  // same "did a new trading day land" signal; using one to bust the other's
  // cache is safe and avoids this picker silently freezing on old bounds.
  const dateKey = useDateKey();
  const latest = useQuery<string | null, Error>({
    queryKey: ['index-date-latest', dateKey],
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
  const dateKey = useDateKey();
  return useQuery<FlowMapData, Error>({
    queryKey: ['constituentFlowMap', indexId, dateKey],
    queryFn:  () => fetchConstituentFlowMap(indexId!, 22),
    enabled:  indexId != null,
    staleTime: STALE,
    retry: 1,
  });
}

/** Per-index flow heatmap for a sector tab category over N trading days. */
export function useIndexFlowMap(tab: SectorTab, days: 5 | 22 | 66) {
  const categories = SECTOR_TAB_CATEGORIES[tab];
  const dateKey = useDateKey();
  return useQuery<FlowMapData, Error>({
    queryKey: ['indexFlowMap', tab, days, dateKey],
    queryFn:  () => fetchIndexFlowMap(categories, days),
    enabled:  categories.length > 0,
    staleTime: STALE,
    retry: 1,
  });
}

/** Computed market breadth + ROC series for a specific index. */
export function useIndexBreadth(indexId: number | null, days = 66) {
  const dateKey = useDateKey();
  return useQuery<IndexBreadthResult, Error>({
    queryKey: ['indexBreadth', indexId, days, dateKey],
    queryFn:  () => fetchIndexBreadth(indexId!, days),
    enabled:  indexId !== null,
    staleTime: STALE,
    retry: 1,
  });
}
