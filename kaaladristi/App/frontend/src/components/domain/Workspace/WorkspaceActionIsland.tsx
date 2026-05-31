import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ')
}

function islandText(correlations: VaNiCorrelation[]): string {
  const active = correlations.filter(c => c.currently_active)

  if (correlations.length === 0) {
    return 'VaNi is watching your framework'
  }

  if (correlations.length === 1) {
    const c = correlations[0]
    const pair = `${fmtId(c.item_a)} ∩ ${fmtId(c.item_b)}`
    const lean = c.avg_return_5d >= 0 ? 'bullish lean' : 'bearish lean'
    if (c.currently_active) {
      return `VaNi · ${pair} is active now · ${lean}`
    }
    return `VaNi · ${pair} approaching · ${c.n_instances} instances historically`
  }

  return `VaNi · ${correlations.length} confluences detected · ${active.length} active now`
}

interface Props {
  onOpen: (pairKey: string | null) => void
}

export default function WorkspaceActionIsland({ onOpen }: Props) {
  const correlations = useFrameworkStore(s => s.vaniCorrelations)

  const hasActive    = correlations.some(c => c.currently_active)
  const firstActive  = correlations.find(c => c.currently_active) ?? correlations[0] ?? null
  const pairKey      = firstActive ? `${firstActive.item_a}:${firstActive.item_b}` : null

  const isWatching   = correlations.length === 0
  const text         = islandText(correlations)

  return (
    <div
      onClick={() => { if (!isWatching) onOpen(pairKey) }}
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 18px',
        borderRadius: 100,
        background: 'rgba(11,17,32,0.92)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${hasActive ? '#f59e0b' : 'rgba(255,255,255,.08)'}`,
        boxShadow: hasActive
          ? '0 0 20px rgba(245,158,11,.2), 0 8px 32px rgba(0,0,0,.4)'
          : '0 8px 32px rgba(0,0,0,.3)',
        cursor: isWatching ? 'default' : 'pointer',
        transition: 'border-color .3s, box-shadow .3s',
        userSelect: 'none',
      }}
    >
      {/* VaNi icon */}
      <span style={{
        fontSize: 12,
        color: hasActive ? '#f59e0b' : isWatching ? 'rgba(167,139,250,.4)' : '#a78bfa',
        transition: 'color .3s',
      }}>
        ✦
      </span>

      {/* Status dot */}
      {hasActive && (
        <span style={{
          display: 'inline-block',
          width: 6, height: 6,
          borderRadius: '50%',
          background: '#f59e0b',
          boxShadow: '0 0 6px #f59e0b',
          animation: 'pulse 2s infinite',
          flexShrink: 0,
        }} />
      )}

      {/* Text */}
      <span style={{
        fontSize: 12,
        color: isWatching
          ? 'rgba(255,255,255,.25)'
          : hasActive ? '#fcd34d' : 'rgba(255,255,255,.6)',
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '.01em',
        whiteSpace: 'nowrap',
        transition: 'color .3s',
      }}>
        {text}
      </span>

      {/* Chevron — only when clickable */}
      {!isWatching && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginLeft: 2 }}>
          ›
        </span>
      )}
    </div>
  )
}
