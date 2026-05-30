import { useRef, useEffect } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'

function rsiColor(value: number): string {
  if (value >= 70) return '#ef4444'   // overbought — red
  if (value <= 30) return '#10b981'   // oversold  — green
  return '#6366f1'                    // neutral   — indigo
}

function rsiZone(value: number): string {
  if (value >= 70) return 'Overbought'
  if (value <= 30) return 'Oversold'
  if (value >= 55) return 'Bullish'
  if (value <= 45) return 'Bearish'
  return 'Neutral'
}

function Sparkline({ values }: { values: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || values.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const toX = (i: number) => (i / (values.length - 1)) * W
    const toY = (v: number) => H - ((v - min) / range) * H * 0.85 - H * 0.075

    // 30 / 70 reference lines
    const y30 = toY(Math.max(30, min))
    const y70 = toY(Math.min(70, max))
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    if (min < 30) { ctx.beginPath(); ctx.moveTo(0, y30); ctx.lineTo(W, y30); ctx.stroke() }
    if (max > 70) { ctx.beginPath(); ctx.moveTo(0, y70); ctx.lineTo(W, y70); ctx.stroke() }
    ctx.setLineDash([])

    // RSI line
    const current = values[values.length - 1]
    ctx.strokeStyle = rsiColor(current)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    values.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v))
    })
    ctx.stroke()
  }, [values])

  return <canvas ref={canvasRef} width={260} height={60} style={{ width: '100%', height: 60 }} />
}

export default function RsiWidget() {
  const { data = [], isLoading } = useWorkspaceEod()

  if (isLoading || data.length === 0) {
    return <div style={{ height: 100 }} />
  }

  const rsiValues = data.map(b => b.rsi_14).filter((v): v is number => v != null)
  if (rsiValues.length === 0) return <div style={{ height: 100 }} />

  const current  = rsiValues[rsiValues.length - 1]
  const color    = rsiColor(current)
  const zone     = rsiZone(current)
  const sparkline = rsiValues.slice(-60)

  return (
    <div style={{ padding: '4px 12px 8px' }}>
      {/* Value + zone */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)',
          color, lineHeight: 1 }}>
          {current.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
          color, opacity: 0.7, letterSpacing: '0.05em' }}>
          {zone}
        </span>
      </div>

      {/* Track bar */}
      <div style={{ position: 'relative', height: 4, borderRadius: 2,
        background: 'rgba(255,255,255,0.07)', marginBottom: 10 }}>
        <div style={{ position: 'absolute', left: '30%', right: '30%', top: 0,
          height: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: -3, width: 10, height: 10,
          borderRadius: '50%', background: color, border: '2px solid rgba(0,0,0,0.5)',
          transform: 'translateX(-50%)',
          left: `${current}%` }} />
      </div>

      {/* Sparkline */}
      <Sparkline values={sparkline} />
    </div>
  )
}
