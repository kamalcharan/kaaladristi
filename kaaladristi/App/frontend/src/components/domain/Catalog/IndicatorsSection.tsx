import { getCatalogItemsByType } from '@/constants/catalogItems'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import { useAddToFramework } from '@/hooks/useAddToFramework'
import type { DeepDiveItem } from './DeepDivePanel'

const INDICATORS = getCatalogItemsByType('indicator')

interface IndicatorsSectionProps {
  onSelect?: (item: DeepDiveItem) => void
}

export default function IndicatorsSection({ onSelect }: IndicatorsSectionProps) {
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
          Indica<em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>tors</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Technical indicators drawn on the price chart or surfaced as panel blocks. All free-tier.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        {INDICATORS.map(item => {
          const active = isActive(item.id, item.placement)
          const isChart = item.placement === 'chart_overlay'

          return (
            <div
              key={item.id}
              onClick={() => onSelect?.({ mode: 'catalog_item', item })}
              style={{
                border: `1px solid ${active ? 'rgba(45,212,191,0.28)' : 'var(--border)'}`,
                borderRadius: 10,
                background: active ? 'rgba(45,212,191,0.04)' : 'rgba(255,255,255,0.02)',
                padding: '14px 16px',
                transition: 'border-color 0.2s, background 0.2s',
                position: 'relative',
                cursor: onSelect ? 'pointer' : 'default',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                }
              }}
            >
              {/* Type tag */}
              <div style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                {isChart ? 'chart overlay' : 'panel block'} · indicator
              </div>

              {/* Name */}
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}>
                {item.display_name}
              </div>

              {/* Description */}
              <p style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 12,
              }}>
                {item.description}
              </p>

              {/* Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                {/* DB column tag */}
                {item.db_column && (
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    flexShrink: 0,
                  }}>
                    {item.db_column}
                  </span>
                )}

                {active ? (
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#2dd4bf',
                    marginLeft: 'auto',
                  }}>
                    ✓ added
                  </span>
                ) : (
                  <button
                    onClick={() => addToFramework(item.id)}
                    style={{
                      marginLeft: 'auto',
                      padding: '4px 12px',
                      borderRadius: 5,
                      fontSize: 11,
                      cursor: 'pointer',
                      border: '1px solid rgba(124,106,247,0.35)',
                      background: 'rgba(124,106,247,0.08)',
                      color: '#8b7af8',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(124,106,247,0.16)'
                      el.style.borderColor = 'rgba(124,106,247,0.55)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(124,106,247,0.08)'
                      el.style.borderColor = 'rgba(124,106,247,0.35)'
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

      {/* Combine teaser — future feature */}
      <div style={{
        border: '1px dashed rgba(201,168,76,0.22)',
        borderRadius: 12,
        background: 'rgba(201,168,76,0.02)',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>⊗</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 300,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 3,
          }}>
            Combine <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>indicators</em>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Stack multiple MA ribbons or create custom confluences. Coming in a future sprint.
          </p>
        </div>
        <span style={{
          padding: '5px 11px',
          borderRadius: 6,
          background: 'rgba(201,168,76,0.07)',
          border: '1px solid rgba(201,168,76,0.18)',
          fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--gold)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Phase 3
        </span>
      </div>
    </div>
  )
}
