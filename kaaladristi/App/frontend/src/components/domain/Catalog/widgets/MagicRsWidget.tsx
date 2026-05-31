import { useRef, useEffect } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'

function zoneColor(zone: string | null): string {
  if (!zone) return 'var(--accent)'
  if (zone.includes('Strong Bull')) return 'var(--bull)'
  if (zone.includes('Bull'))        return 'var(--bull)'
  if (zone.includes('Strong Bear')) return 'var(--bear)'
  if (zone.includes('Bear'))        return 'var(--bear)'
  return 'var(--accent)'
}

function MagicSparkline({
  rsValues, maValues, activeIdx,
}: {
  rsValues: (number | null)[]
  maValues: (number | null)[]
  activeIdx: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const allVals = [...rsValues, ...maValues].filter((v): v is number => v != null)
    if (allVals.length < 2) return

    const n     = rsValues.length
    const min   = Math.min(...allVals, 0)
    const max   = Math.max(...allVals, 0)
    const range = max - min || 1

    const toX = (i: number) => (i / (n - 1)) * W
    const toY = (v: number) => H - ((v - min) / range) * H * 0.85 - H * 0.075

    // Zero reference line
    if (min < 0 && max > 0) {
      const zy = toY(0)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(0, zy); ctx.lineTo(W, zy); ctx.stroke()
      ctx.setLineDash([])
    }

    // MagicMA (gold, thin)
    ctx.strokeStyle = 'rgba(201,168,76,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    let started = false
    maValues.forEach((v, i) => {
      if (v == null) return
      started ? ctx.lineTo(toX(i), toY(v)) : (ctx.moveTo(toX(i), toY(v)), (started = true))
    })
    ctx.stroke()

    // MagicRS (indigo, primary)
    const currentRs = rsValues[activeIdx] ?? rsValues.filter(v => v != null).at(-1) ?? 0
    ctx.strokeStyle = zoneColor(currentRs > 0 ? 'Bull' : 'Bear')
    ctx.lineWidth = 1.5
    ctx.beginPath()
    started = false
    rsValues.forEach((v, i) => {
      if (v == null) return
      started ? ctx.lineTo(toX(i), toY(v)) : (ctx.moveTo(toX(i), toY(v)), (started = true))
    })
    ctx.stroke()

    // Crosshair
    if (activeIdx >= 0 && activeIdx < n) {
      const ax = toX(activeIdx)
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke()
      ctx.setLineDash([])
    }
  }, [rsValues, maValues, activeIdx])

  return <canvas ref={canvasRef} width={260} height={64} style={{ width: '100%', height: 64 }} />
}

export default function MagicRsWidget() {
  const { visibleData, activeBarIndex, isLoading } = useWorkspaceEod()

  if (isLoading || visibleData.length === 0) {
    return <div style={{ height: 100 }} />
  }

  const activeBar  = visibleData[activeBarIndex] ?? visibleData[visibleData.length - 1]
  const currentRs  = activeBar?.magic_rs ?? null
  const currentZone = activeBar?.magic_rs_zone ?? null
  const color      = zoneColor(currentZone)

  const rsValues = visibleData.map(b => b.magic_rs ?? null)
  const maValues = visibleData.map(b => b.magic_ma ?? null)

  return (
    <div style={{ padding: '4px 12px 8px' }}>
      {/* Value + zone */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)',
          color, lineHeight: 1 }}>
          {currentRs != null ? currentRs.toFixed(2) : '—'}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
          color, opacity: 0.7, letterSpacing: '0.05em' }}>
          {currentZone ?? 'Neutral'}
        </span>
      </div>

      <MagicSparkline rsValues={rsValues} maValues={maValues} activeIdx={activeBarIndex} />
    </div>
  )
}
