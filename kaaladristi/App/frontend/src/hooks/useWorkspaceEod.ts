import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useChartSyncStore } from '@/stores/chartSyncStore'
import { fetchInstrumentEod } from '@/services/indicatorData'

/**
 * Reads the workspace EOD dataset from the React Query cache.
 * Uses the same key as WorkspaceChart — no extra network call.
 *
 * Also derives the sync-aware slice from chartSyncStore so that
 * every canvas panel widget stays in sync with the main chart's
 * scroll position and crosshair without any extra wiring.
 */
export function useWorkspaceEod() {
  const symbol = useFrameworkStore(s => s.framework?.instruments?.[0] ?? null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['workspace-chart', symbol, '1Y'],
    queryFn:  () => fetchInstrumentEod(symbol!, '1Y'),
    staleTime: 120_000,
    enabled:  !!symbol,
  })

  const { activeBarIndex, visibleFrom, visibleTo } = useChartSyncStore()

  // Compute the visible slice — bars that fall within the chart's visible range.
  // Falls back to the full dataset when the chart hasn't emitted a range yet.
  const visibleData = useMemo(() => {
    if (!visibleFrom || !visibleTo || data.length === 0) return data
    const from = visibleFrom
    const to   = visibleTo
    return data.filter(b => b.trade_date >= from && b.trade_date <= to)
  }, [data, visibleFrom, visibleTo])

  // Resolve active bar index relative to visibleData for crosshair highlighting.
  // Clamp to visibleData bounds so widgets never get an out-of-range index.
  const activeVisibleIndex = useMemo(() => {
    if (visibleData.length === 0) return 0
    if (!visibleFrom) return visibleData.length - 1
    // activeBarIndex is relative to the full data array
    const activeDate = data[activeBarIndex]?.trade_date
    if (!activeDate) return visibleData.length - 1
    const idx = visibleData.findIndex(b => b.trade_date === activeDate)
    return idx >= 0 ? idx : visibleData.length - 1
  }, [visibleData, activeBarIndex, data, visibleFrom])

  return {
    data,           // full dataset (1Y) — for widgets that manage their own window
    visibleData,    // chart-synced slice — use this for rendering
    activeBarIndex: activeVisibleIndex,  // crosshair position within visibleData
    isLoading,
  }
}
