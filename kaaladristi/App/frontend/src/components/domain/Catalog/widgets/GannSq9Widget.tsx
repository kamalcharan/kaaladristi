import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'

interface Props {
  /** When provided (catalog preview), uses this price directly — no workspace needed. */
  previewPrice?: number
}

interface Sq9Level {
  angle: number
  label: string
  resistance: number
  support: number
  isCardinal: boolean
}

const ANGLES = [45, 90, 135, 180, 225, 270, 315, 360]
const CARDINALS = new Set([90, 180, 270, 360])

function sq9Levels(price: number): Sq9Level[] {
  const sqrt = Math.sqrt(price)
  return ANGLES.map((angle) => {
    const factor = (angle / 360) * 2
    return {
      angle,
      label: `${angle}°`,
      resistance: Math.round(Math.pow(sqrt + factor, 2) * 100) / 100,
      support:    Math.round(Math.pow(sqrt - factor, 2) * 100) / 100,
      isCardinal: CARDINALS.has(angle),
    }
  })
}

function fmt(n: number): string {
  return n >= 10000 ? n.toFixed(0) : n >= 1000 ? n.toFixed(1) : n.toFixed(2)
}

export default function GannSq9Widget({ previewPrice }: Props) {
  const workspace = useWorkspaceEod()

  const isPreview = previewPrice != null
  const price: number | null = isPreview
    ? previewPrice
    : (workspace.visibleData[workspace.activeBarIndex]?.close ?? null)
  const isLoading = !isPreview && workspace.isLoading

  if (isLoading) {
    return (
      <div style={{ padding: '8px 12px' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            height: 18, marginBottom: 4, borderRadius: 3,
            background: 'rgba(255,255,255,0.05)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    )
  }

  if (price == null || price <= 0) {
    return (
      <div style={{
        height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono,monospace)',
        textAlign: 'center', padding: '0 16px',
      }}>
        Select an instrument to see Gann levels
      </div>
    )
  }

  const sqrt = Math.sqrt(price)
  const levels = sq9Levels(price)

  return (
    <div style={{ padding: '6px 0 4px' }}>
      {/* Price header */}
      <div style={{
        display: 'flex', gap: 16, padding: '0 12px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)' }}>
          Price{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            ₹{fmt(price)}
          </span>
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)' }}>
          √P{' '}
          <span style={{ color: 'rgba(201,168,76,0.85)' }}>
            {sqrt.toFixed(3)}
          </span>
        </span>
      </div>

      {/* Table */}
      <div style={{ padding: '4px 12px 2px' }}>
        {/* Header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '38px 1fr 1fr',
          padding: '3px 0', marginBottom: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'var(--font-mono,monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>°</span>
          <span style={{ fontSize: 9, color: 'rgba(45,212,191,0.6)', fontFamily: 'var(--font-mono,monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resistance</span>
          <span style={{ fontSize: 9, color: 'rgba(248,113,113,0.6)', fontFamily: 'var(--font-mono,monospace)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Support</span>
        </div>

        {/* Data rows */}
        {levels.map((lvl) => {
          const angleColor  = lvl.isCardinal ? 'rgba(201,168,76,0.9)' : 'var(--text-faint)'
          const rowBg       = lvl.isCardinal ? 'rgba(201,168,76,0.04)' : 'transparent'
          const resistColor = lvl.isCardinal ? 'rgba(45,212,191,0.9)' : 'rgba(45,212,191,0.55)'
          const supportColor = lvl.isCardinal ? 'rgba(248,113,113,0.9)' : 'rgba(248,113,113,0.55)'
          const dot = lvl.isCardinal ? ' ●' : ''

          return (
            <div
              key={lvl.angle}
              style={{
                display: 'grid', gridTemplateColumns: '38px 1fr 1fr',
                padding: '3px 4px', marginLeft: -4, marginRight: -4,
                borderRadius: 3, background: rowBg,
              }}
            >
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono,monospace)',
                color: angleColor,
                fontWeight: lvl.isCardinal ? 600 : 400,
              }}>
                {lvl.label}
              </span>
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono,monospace)',
                color: resistColor,
                fontWeight: lvl.isCardinal ? 600 : 400,
              }}>
                {fmt(lvl.resistance)}{dot}
              </span>
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono,monospace)',
                color: supportColor,
                fontWeight: lvl.isCardinal ? 600 : 400,
              }}>
                {fmt(lvl.support)}{dot}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
