import { useQuery } from '@tanstack/react-query'
import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { fetchIndicatorDataById } from '@/services/indicatorData'
import { fetchEquityEodById } from '@/services/indicatorData'
import TradingChart from '@/components/charts/TradingChart'
import { useChartSyncStore } from '@/stores/chartSyncStore'
import { useAstroOverlayBands } from '@/hooks/useAstroOverlayBands'
import OverlayExplainPopover from '@/components/domain/VaNi/OverlayExplainPopover'
import MercuryStoryRibbon from '@/components/domain/MercuryStoryRibbon'
import type { AstroBand } from '@/services/astroOverlayService'
import type { InstrumentRef, ChartOverlay } from '@/types/framework'

const HEADER_H = 36
const NO_OVERLAYS: ChartOverlay[] = []

interface ZoneExplain {
  tag: string; ruleId: number; ruleLabel: string; x: number; y: number
  /** Other rules under the same click point (Overlap Visibility Phase 5). */
  coincident?: { ruleId: number; label: string }[]
}

interface Props {
  instrument: InstrumentRef
  overlays?: ChartOverlay[]
  standalone?: boolean
}

export default function WorkspaceChart({ instrument, overlays: overlaysProp, standalone = false }: Props) {
  const frameworkOverlays = useFrameworkStore(s => s.framework?.chart_overlays ?? NO_OVERLAYS)
  const effectiveOverlays = useMemo(
    () => overlaysProp !== undefined ? overlaysProp : frameworkOverlays,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlaysProp, frameworkOverlays],
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(400)

  const { data = [], isLoading } = useQuery({
    queryKey: ['workspace-chart', instrument.id, instrument.type],
    queryFn: () =>
      instrument.type === 'equity'
        ? fetchEquityEodById(instrument.id, '1Y')
        : fetchIndicatorDataById(instrument.id, '1Y'),
    staleTime: 120_000,
  })

  const playerBarIndex = useChartSyncStore(s => s.playerBarIndex)
  const { setTotalBars, setActiveBarIndex, setVisibleRange } = useChartSyncStore.getState()
  // Astro is INDEX-ONLY (owner 2026-07-22) — equity blocks get no bands/ribbon.
  const isIndexChart = instrument.type === 'index'
  const astroBands = useAstroOverlayBands(isIndexChart ? effectiveOverlays : NO_OVERLAYS)
  const [zoneExplain, setZoneExplain] = useState<ZoneExplain | null>(null)

  const handleZoneClick = useCallback((band: AstroBand, clientX: number, clientY: number, coincident?: AstroBand[]) => {
    // Dedupe by ruleId — a rule with several windows under the cursor is one entry
    const others = new Map<number, string>()
    for (const b of coincident ?? []) {
      if (b.ruleId !== band.ruleId) others.set(b.ruleId, b.displayName)
    }
    setZoneExplain({
      tag: band.groupTag, ruleId: band.ruleId, ruleLabel: band.displayName, x: clientX, y: clientY,
      coincident: [...others.entries()].map(([ruleId, label]) => ({ ruleId, label })),
    })
  }, [])

  // Measure container height via ResizeObserver — drives TradingChart height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const h = entries[0].contentRect.height
      if (h > HEADER_H) setChartHeight(h - HEADER_H)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (data.length > 0 && !standalone) setTotalBars(data.length)
  }, [data.length, setTotalBars, standalone])

  const playerDate = playerBarIndex != null ? (data[playerBarIndex]?.trade_date ?? null) : null

  const handleCrosshairMove = useCallback(
    (idx: number) => { if (!standalone) setActiveBarIndex(idx) },
    [setActiveBarIndex, standalone],
  )

  const handleVisibleRangeChange = useCallback(
    (from: string, to: string) => { if (!standalone) setVisibleRange(from, to) },
    [setVisibleRange, standalone],
  )

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Mercury story chip — floats over the chart top (Study's ribbon,
          overlay-styled: the workspace block has no spare layout row).
          Index charts only — astro is index-only (owner 2026-07-22). */}
      {!isLoading && isIndexChart && <MercuryStoryRibbon overlay />}
      {isLoading && (
        <div style={{
          position: 'absolute', top: HEADER_H, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)',
          fontFamily: 'var(--font-mono, monospace)', padding: 16,
        }}>
          loading…
        </div>
      )}
      {!isLoading && (
        <TradingChart
          data={data}
          height={chartHeight}
          workspaceMode
          overlays={effectiveOverlays}
          astroBands={astroBands}
          highlightDate={playerDate}
          onCrosshairMove={handleCrosshairMove}
          onVisibleRangeChange={handleVisibleRangeChange}
          onZoneClick={handleZoneClick}
          benchmarkIndexId={instrument.type === 'index' ? instrument.id : null}
          benchmarkName={instrument.type === 'index' ? instrument.symbol : null}
        />
      )}
      {zoneExplain && (
        <OverlayExplainPopover
          tag={zoneExplain.tag}
          focusRuleId={zoneExplain.ruleId}
          focusRuleLabel={zoneExplain.ruleLabel}
          coincident={zoneExplain.coincident}
          anchorX={zoneExplain.x}
          anchorY={zoneExplain.y}
          onClose={() => setZoneExplain(null)}
        />
      )}
    </div>
  )
}
