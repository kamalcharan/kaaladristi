import { useNavigate } from 'react-router-dom'
import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ')
}

interface Chip { label: string; type: 'caution' | 'accent' }

interface IslandState {
  text:  string
  chips: Chip[]
}

function computeIslandState(
  correlations: VaNiCorrelation[],
  astroOverlayCount: number,
): IslandState {
  const hasConf = correlations.length > 0
  const hasRules = astroOverlayCount > 0

  if (!hasConf && !hasRules) {
    return { text: 'VaNi is watching your framework', chips: [] }
  }

  const activeConf = correlations.filter(c => c.currently_active)
  const chips: Chip[] = []

  // Most significant confluence chip
  const first = activeConf[0] ?? correlations[0]
  if (first) {
    chips.push({
      label: `${fmtId(first.item_a)} ∩ ${fmtId(first.item_b)} · ${first.n_instances}×`,
      type:  'accent',
    })
  }

  // Active astro rule chip
  if (astroOverlayCount > 0) {
    chips.push({ label: `${astroOverlayCount} rule${astroOverlayCount > 1 ? 's' : ''} active`, type: 'caution' })
  }

  const totalThings = correlations.length + (astroOverlayCount > 0 ? 1 : 0)

  let text: string
  if (hasConf && hasRules) {
    text = `${totalThings} thing${totalThings !== 1 ? 's' : ''} active in your framework`
  } else if (hasConf) {
    text = `${correlations.length} confluence${correlations.length !== 1 ? 's' : ''} in your framework`
  } else {
    text = `${astroOverlayCount} rule${astroOverlayCount !== 1 ? 's' : ''} active in your framework`
  }

  return { text, chips: chips.slice(0, 2) }
}

interface Props {
  onOpen:          (pairKey: string | null) => void
  onMorningBrief?: () => void
  bottomOffset?:   number
}

export default function WorkspaceActionIsland({ onOpen, onMorningBrief, bottomOffset = 0 }: Props) {
  const navigate      = useNavigate()
  const correlations  = useFrameworkStore(s => s.vaniCorrelations)
  const framework     = useFrameworkStore(s => s.framework)

  const astroOverlayCount = (framework?.chart_overlays ?? [])
    .filter(o => o.catalog_item_id.startsWith('astro_rule:') && o.visible).length

  const hasActive    = correlations.some(c => c.currently_active)
  const firstActive  = correlations.find(c => c.currently_active) ?? correlations[0] ?? null
  const pairKey      = firstActive ? `${firstActive.item_a}:${firstActive.item_b}` : null

  const isWatching   = correlations.length === 0 && astroOverlayCount === 0
  const { text, chips } = computeIslandState(correlations, astroOverlayCount)

  function handleClick() {
    if (isWatching) { onMorningBrief?.(); return }
    if (correlations.length > 0 && pairKey) {
      onOpen(pairKey)
    } else {
      onMorningBrief?.()
    }
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: 28 + bottomOffset,
        left: '50%',
        transform: 'translateX(calc(-50% + 110px))',
        zIndex: 50,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        borderRadius: 100,
        background: 'var(--card)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${hasActive ? 'var(--caution)' : 'rgba(255,255,255,.15)'}`,
        boxShadow: hasActive
          ? '0 0 24px var(--caution-bg), 0 12px 40px rgba(0,0,0,.6)'
          : '0 12px 40px rgba(0,0,0,.5)',
        cursor: 'pointer',
        transition: 'border-color .3s, box-shadow .3s',
        userSelect: 'none',
        maxWidth: 'calc(100vw - 48px)',
      }}
    >
      {/* VaNi icon */}
      <span style={{
        fontSize: 13,
        color: hasActive ? 'var(--caution)' : isWatching ? 'rgba(167,139,250,.5)' : '#a78bfa',
        transition: 'color .3s',
        flexShrink: 0,
      }}>
        ✦
      </span>

      {/* Status dot */}
      {hasActive && (
        <span style={{
          display: 'inline-block',
          width: 7, height: 7,
          borderRadius: '50%',
          background: 'var(--caution)',
          boxShadow: '0 0 8px var(--caution)',
          flexShrink: 0,
        }} />
      )}

      {/* Text — Fraunces italic */}
      <span style={{
        fontSize: 13,
        color: isWatching
          ? 'rgba(255,255,255,.35)'
          : hasActive ? 'var(--caution)' : 'rgba(255,255,255,.75)',
        fontFamily: 'var(--font-display, serif)',
        fontStyle: 'italic',
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        transition: 'color .3s',
      }}>
        {text}
      </span>

      {/* Chips */}
      {chips.map((chip, i) => (
        <span key={i} style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)',
          padding: '2px 8px', borderRadius: 10,
          background: chip.type === 'caution' ? 'var(--caution-bg)' : 'var(--accent-glow)',
          border: `1px solid ${chip.type === 'caution' ? 'var(--caution-dim)' : 'var(--accent-dim)'}`,
          color: chip.type === 'caution' ? 'var(--caution)' : 'var(--accent)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {chip.label}
        </span>
      ))}

      {/* Chevron */}
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginLeft: 2, flexShrink: 0 }}>
        ›
      </span>
    </div>
  )
}
