import { create } from 'zustand'

/**
 * chartSyncStore — workspace-wide chart synchronisation bus.
 *
 * Two sync primitives:
 *   activeBarIndex  — which bar is "current" (0 = oldest, totalBars-1 = now)
 *                     written by: TimelineSlider scrub, main chart crosshair hover
 *                     read by:    all canvas panel widgets, main chart crosshair
 *
 *   visibleRange    — which date window is visible on the main chart
 *                     written by: main chart scroll/zoom
 *                     read by:    all canvas panel widgets
 *
 * Nothing in this store is persisted. It resets on page load.
 * All workspace widgets share the same data via useWorkspaceEod() —
 * this store only controls WHICH slice of that data each widget renders.
 */

interface ChartSyncState {
  activeBarIndex: number
  visibleFrom:    string | null   // ISO date e.g. '2025-06-01'
  visibleTo:      string | null   // ISO date e.g. '2026-05-30'
  totalBars:      number

  setActiveBarIndex: (index: number) => void
  setVisibleRange:   (from: string, to: string) => void
  setTotalBars:      (total: number) => void
  resetToNow:        () => void   // called when data loads — snap to latest bar
}

export const useChartSyncStore = create<ChartSyncState>((set) => ({
  activeBarIndex: 0,
  visibleFrom:    null,
  visibleTo:      null,
  totalBars:      0,

  setActiveBarIndex: (index) => set({ activeBarIndex: index }),
  setVisibleRange:   (from, to) => set({ visibleFrom: from, visibleTo: to }),
  setTotalBars:      (total) => set({ totalBars: total, activeBarIndex: total - 1 }),
  resetToNow:        () => set((s) => ({ activeBarIndex: Math.max(0, s.totalBars - 1) })),
}))
