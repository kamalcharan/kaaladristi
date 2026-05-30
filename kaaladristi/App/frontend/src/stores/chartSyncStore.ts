import { create } from 'zustand'

/**
 * chartSyncStore — workspace-wide chart synchronisation bus.
 *
 * activeBarIndex  — which bar is "current"
 *                   written by: player scrub, main chart crosshair hover
 *                   read by:    all canvas panel widgets
 *
 * playerBarIndex  — player-initiated seek position (null = not seeking)
 *                   written by: timeline player widget only
 *                   read by:    WorkspaceChart as highlightDate → scrolls chart
 *                   Kept separate so crosshair hover does NOT trigger chart scroll.
 *
 * visibleRange    — which date window is on screen
 *                   written by: main chart scroll/zoom
 *                   read by:    all canvas panel widgets
 */

interface ChartSyncState {
  activeBarIndex: number
  playerBarIndex: number | null   // null = player idle / not seeking
  visibleFrom:    string | null
  visibleTo:      string | null
  totalBars:      number

  setActiveBarIndex: (index: number) => void
  setPlayerBarIndex: (index: number | null) => void
  setVisibleRange:   (from: string, to: string) => void
  setTotalBars:      (total: number) => void
  resetToNow:        () => void
}

export const useChartSyncStore = create<ChartSyncState>((set) => ({
  activeBarIndex: 0,
  playerBarIndex: null,
  visibleFrom:    null,
  visibleTo:      null,
  totalBars:      0,

  setActiveBarIndex: (index) => set({ activeBarIndex: index }),
  setPlayerBarIndex: (index) => set({ playerBarIndex: index }),
  setVisibleRange:   (from, to) => set({ visibleFrom: from, visibleTo: to }),
  setTotalBars:      (total) => set({ totalBars: total, activeBarIndex: total - 1 }),
  resetToNow:        () => set((s) => ({ activeBarIndex: Math.max(0, s.totalBars - 1) })),
}))
