import { useQuery } from '@tanstack/react-query'
import { useEffect, useCallback, useRef, useState } from 'react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { fetchIndicatorDataById } from '@/services/indicatorData'
import { fetchEquityEodById } from '@/services/indicatorData'
import TradingChart from '@/components/charts/TradingChart'
import { useChartSyncStore } from '@/stores/chartSyncStore'
import { useAstroOverlayBands } from '@/hooks/useAstroOverlayBands'
import type { InstrumentRef } from '@/types/framework'

const HEADER_H = 36

interface Props {
  instrument: InstrumentRef
}

export default function WorkspaceChart({ instrument }: Props) {
  const overlays = useFrameworkStore(s => s.framework?.chart_overlays ?? [])
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

  const { setTotalBars, setActiveBarIndex, setVisibleRange, playerBarIndex } = useChartSyncStore()
  const astroBands = useAstroOverlayBands(overlays)

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
    if (data.length > 0) setTotalBars(data.length)
  }, [data.length, setTotalBars])

  const playerDate = playerBarIndex != null ? (data[playerBarIndex]?.trade_date ?? null) : null

  const handleCrosshairMove = useCallback(
    (idx: number) => setActiveBarIndex(idx),
    [setActiveBarIndex],
  )

  const handleVisibleRangeChange = useCallback(
    (from: string, to: string) => setVisibleRange(from, to),
    [setVisibleRange],
  )

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isLoading && (
        <div style={{
          position: 'absolute', top: HEADER_H, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'rgba(255,255,255,.2)',
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
          overlays={overlays}
          astroBands={astroBands}
          highlightDate={playerDate}
          onCrosshairMove={handleCrosshairMove}
          onVisibleRangeChange={handleVisibleRangeChange}
        />
      )}
    </div>
  )
}
