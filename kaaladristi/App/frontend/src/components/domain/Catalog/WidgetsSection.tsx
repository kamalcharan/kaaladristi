import { getCatalogItemsByType } from '@/constants/catalogItems'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import { useAddToFramework } from '@/hooks/useAddToFramework'

// Widgets includes scanners (conviction_flow has block_type='scanner' but is in WIDGETS array)
// getCatalogItemsByType('widget') covers all widget-placement items
const WIDGETS = getCatalogItemsByType('widget')
const SCANNERS_AS_WIDGET = getCatalogItemsByType('scanner')
const ALL_WIDGETS = [...WIDGETS, ...SCANNERS_AS_WIDGET]

const ICONS: Record<string, string> = {
  magic_rs:        '◎',
  breadth_roc:     '⊛',
  smart_money:     '◉',
  conviction_flow: '⊙',
  order_flow:      '⇌',
  six_day_outlook: '☽',
}

export default function WidgetsSection() {
  const { profile } = useAuthStore()
  const { addToFramework, isBlockActive, isOverlayActive } = useAddToFramework()
  const isPaid = PAID_TIERS.includes(profile?.tier as never)

  function isActive(itemId: string, placement: string) {
    return placement === 'chart_overlay' ? isOverlayActive(itemId) : isBlockActive(itemId)
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 300,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}>
          Wid<em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>gets</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Intelligent panel blocks — proprietary KD signals, breadth oscillators, and smart-money detectors.
          Paid items are marked.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 14,
      }}>
        {ALL_WIDGETS.map(item => {
          const active  = isActive(item.id, item.placement)
          const locked  = item.tier_required === 'paid' && !isPaid
          const icon    = ICONS[item.id] ?? '◌'

          return (
            <div
              key={item.id}
              style={{
                border: `1px solid ${
                  active  ? 'rgba(45,212,191,0.28)'         :
                  locked  ? 'rgba(255,255,255,0.06)'        :
                            'rgba(124,106,247,0.18)'
                }`,
                borderRadius: 12,
                background: active
                  ? 'rgba(45,212,191,0.04)'
                  : 'rgba(255,255,255,0.02)',
                padding: '18px 20px',
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!active && !locked) {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(124,106,247,0.38)'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.28)'
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = active
                  ? 'rgba(45,212,191,0.28)'
                  : locked ? 'rgba(255,255,255,0.06)' : 'rgba(124,106,247,0.18)'
                el.style.transform = ''
                el.style.boxShadow = ''
              }}
            >
              {/* VaNi radial glow backdrop */}
              <div style={{
                position: 'absolute',
                top: 0, right: 0,
                width: 110, height: 110,
                background: 'radial-gradient(circle at top right, rgba(124,106,247,0.05), transparent 70%)',
                pointerEvents: 'none',
              }} />

              {/* Paid badge */}
              {item.tier_required === 'paid' && (
                <div style={{
                  position: 'absolute',
                  top: 14, right: 14,
                  fontSize: 8,
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '2px 6px',
                  background: locked
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(124,106,247,0.10)',
                  border: `1px solid ${locked ? 'rgba(255,255,255,0.1)' : 'rgba(124,106,247,0.28)'}`,
                  color: locked ? 'var(--text-muted)' : '#8b7af8',
                  borderRadius: 3,
                  letterSpacing: '0.06em',
                }}>
                  {locked ? 'PAID' : 'PAID ✓'}
                </div>
              )}

              {/* Icon */}
              <div style={{
                fontSize: 22,
                marginBottom: 10,
                fontFamily: 'var(--font-display)',
                color: active ? '#2dd4bf' : locked ? 'var(--text-muted)' : '#8b7af8',
                opacity: locked ? 0.4 : 1,
              }}>
                {icon}
              </div>

              {/* Name */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 300,
                color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 5,
                opacity: locked ? 0.5 : 1,
              }}>
                {item.display_name}
              </div>

              {/* Description */}
              <p style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                marginBottom: 14,
                opacity: locked ? 0.6 : 1,
              }}>
                {item.description}
              </p>

              {/* Stats row */}
              <div style={{
                display: 'flex',
                gap: 16,
                marginBottom: 14,
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 12,
                    color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    {item.placement === 'output_panel' ? 'Scanner' : 'Widget'}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono, monospace)',
                    marginTop: 2,
                  }}>
                    placement
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 12,
                    color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    {item.applicable_to.join(' + ')}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono, monospace)',
                    marginTop: 2,
                  }}>
                    applies to
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                {item.db_column ? (
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    padding: '2px 6px',
                    borderRadius: 3,
                  }}>
                    {item.db_column}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)',
                  }}>
                    api computed
                  </span>
                )}

                {active ? (
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#2dd4bf',
                  }}>
                    ✓ added
                  </span>
                ) : locked ? (
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)',
                    opacity: 0.5,
                  }}>
                    Upgrade to add
                  </span>
                ) : (
                  <button
                    onClick={() => addToFramework(item.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                      border: '1px solid rgba(124,106,247,0.38)',
                      background: 'rgba(124,106,247,0.10)',
                      color: '#8b7af8',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(124,106,247,0.18)'
                      el.style.borderColor = 'rgba(124,106,247,0.58)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(124,106,247,0.10)'
                      el.style.borderColor = 'rgba(124,106,247,0.38)'
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
