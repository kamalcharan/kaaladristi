import { useRef, useEffect } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'

function rsiColor(value: number): string {
  if (value >= 70) return '#ef4444'
  if (value <= 30) return '#10b981'
  return '#6366f1'
}

function rsiZone(value: number): string {
  if (value >= 70) return 'Overbought'
  if (value <= 30) return 'Oversold'
  if (value >= 55) return 'Bullish'
  if (value <= 45) return 'Bearish'
  return 'Neutral'
}

// Both RSI and MFI are 0-100 so we use a fixed scale
const SCALE_MIN = 0
const SCALE_MAX = 100

function Sparkline({
  rsiValues, mfiValues, activeIdx, rsiColor: lineColor,
}: {
  rsiValues: (number | null)[]
  mfiValues: (number | null)[]
  activeIdx: number
  rsiColor: string
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

    const n = rsiValues.length
    if (n < 2) return

    const toX = (i: number) => (i / (n - 1)) * W
    const toY = (v: number) => H - ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * H * 0.85 - H * 0.075

    // 30 / 70 reference lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(0, toY(30)); ctx.lineTo(W, toY(30)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, toY(70)); ctx.lineTo(W, toY(70)); ctx.stroke()
    ctx.setLineDash([])

    // MFI overlay — teal dashed, drawn first (behind RSI)
    const hasMfi = mfiValues.some(v => v != null)
    if (hasMfi) {
      ctx.strokeStyle = '#2dd4bf'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 2])
      ctx.globalAlpha = 0.55
      let started = false
      mfiValues.forEach((v, i) => {
        if (v == null) { started = false; return }
        if (!started) { ctx.beginPath(); ctx.moveTo(toX(i), toY(v)); started = true }
        else ctx.lineTo(toX(i), toY(v))
      })
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // RSI line — primary, solid
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.5
    let started = false
    rsiValues.forEach((v, i) => {
      if (v == null) { started = false; return }
      if (!started) { ctx.beginPath(); ctx.moveTo(toX(i), toY(v)); started = true }
      else ctx.lineTo(toX(i), toY(v))
    })
    ctx.stroke()

    // Crosshair vertical
    if (activeIdx >= 0 && activeIdx < n) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(toX(activeIdx), 0)
      ctx.lineTo(toX(activeIdx), H)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [rsiValues, mfiValues, activeIdx, lineColor])

  return <canvas ref={canvasRef} width={260} height={60} style={{ width: '100%', height: 60 }} />
}

export default function RsiWidget() {
  const { visibleData, activeBarIndex, isLoading } = useWorkspaceEod()

  if (isLoading || visibleData.length === 0) {
    return <div style={{ height: 100 }} />
  }

  const rsiValues = visibleData.map(b => b.rsi_14)
  const mfiValues = visibleData.map(b => b.mfi_14)

  const currentRsi = visibleData[activeBarIndex]?.rsi_14
    ?? rsiValues.filter((v): v is number => v != null).at(-1)
    ?? 50

  const currentMfi = visibleData[activeBarIndex]?.mfi_14

  const color = rsiColor(currentRsi)
  const zone  = rsiZone(currentRsi)

  return (
    <div style={{ padding: '4px 12px 8px' }}>
      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)',
            color, lineHeight: 1 }}>
            {currentRsi.toFixed(1)}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color, opacity: 0.7, letterSpacing: '0.05em' }}>
            {zone}
          </span>
        </div>
        {currentMfi != null && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: '#2dd4bf', opacity: 0.8 }}>
            MFI {currentMfi.toFixed(1)}
          </span>
        )}
      </div>

      {/* Track bar — RSI position */}
      <div style={{ position: 'relative', height: 4, borderRadius: 2,
        background: 'rgba(255,255,255,0.07)', marginBottom: 10 }}>
        <div style={{ position: 'absolute', left: '30%', right: '30%', top: 0,
          height: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: -3, width: 10, height: 10,
          borderRadius: '50%', background: color, border: '2px solid rgba(0,0,0,0.5)',
          transform: 'translateX(-50%)', left: `${currentRsi}%` }} />
      </div>

      {/* Sparkline — RSI solid + MFI teal dashed overlay */}
      <Sparkline
        rsiValues={rsiValues}
        mfiValues={mfiValues}
        activeIdx={activeBarIndex}
        rsiColor={color}
      />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2,
            background: color, borderRadius: 1 }} />
          RSI 14
        </span>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2,
            background: '#2dd4bf', opacity: 0.7, borderRadius: 1,
            backgroundImage: 'repeating-linear-gradient(to right, #2dd4bf 0, #2dd4bf 3px, transparent 3px, transparent 5px)' }} />
          MFI 14
        </span>
      </div>
    </div>
  )
}
