import { useState } from 'react'
import type { CatalogItem } from '@/constants/catalogItems'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAddToFramework } from '@/hooks/useAddToFramework'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import InlineGate from '@/components/workspace/InlineGate'

// ── Shared types (exported for section components) ────────────────────────────

export interface DeepDiveCatalogItem {
  mode: 'catalog_item'
  item: CatalogItem
}

export type DeepDiveItem = DeepDiveCatalogItem

const SWATCH_PALETTE_DP = [
  '#7c6af7', '#a78bfa', '#c084fc', '#e879f9',
  'var(--bull)', '#2dd4bf', '#38bdf8', '#60a5fa',
  '#fb923c', 'var(--caution)', '#facc15', '#a3e635',
  '#f43f5e', '#fb7185', '#94a3b8', '#e2e8f0',
]

const INDICATOR_DEFAULTS_DP: Record<string, string> = {
  ema_20: '#7c6af7', ema_60: 'var(--bull)', sma_50: '#fb923c',
  sma_150: 'var(--caution)', sma_200: '#f43f5e', supertrend: '#2dd4bf',
  pivot_levels: '#94a3b8', atr_14: '#c084fc', rsi_14: '#60a5fa',
}

// ── Mode B — Catalog Item body ────────────────────────────────────────────────

function CatalogItemBody({ item }: { item: CatalogItem }) {
  const [color, setColor] = useState(INDICATOR_DEFAULTS_DP[item.id] ?? '#7c6af7')
  const isChartOverlay = item.placement === 'chart_overlay'
  const isSupertrend   = item.id === 'supertrend'

  return (
    <>
      {/* Color section — chart overlays only */}
      {isChartOverlay && (
        <div style={{ marginBottom: 20 }}>
          <div style={SEC_LABEL}>Chart Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {/* Color preview */}
            <div style={{
              width: 36, height: 36, borderRadius: 6, flexShrink: 0,
              background: isSupertrend
                ? 'linear-gradient(135deg, #2dd4bf 50%, #f43f5e 50%)'
                : color,
              border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
            }} />
            {/* Swatches */}
            {!isSupertrend && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5 }}>
                {SWATCH_PALETTE_DP.map(s => (
                  <button
                    key={s}
                    title={s}
                    onClick={() => setColor(s)}
                    style={{
                      width: 20, height: 20, borderRadius: 4,
                      background: s,
                      border: s === color
                        ? '2px solid color-mix(in srgb, var(--text-primary) 80%, transparent)'
                        : '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {isSupertrend
              ? 'SuperTrend uses bull/bear colors from your theme — not configurable.'
              : 'This color appears on your chart. You can change it anytime from the overlay pill strip.'}
          </p>
        </div>
      )}

      {/* Metadata grid */}
      <div style={{ marginBottom: 18 }}>
        <div style={SEC_LABEL}>Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Type',        value: item.block_type },
            { label: 'Placement',   value: item.placement.replace(/_/g, ' ') },
            { label: 'Applies to',  value: item.applicable_to.join(', ') },
            { label: 'Tier',        value: item.tier_required },
            ...(item.db_column ? [{ label: 'DB Column', value: item.db_column }] : []),
            ...(item.db_table   ? [{ label: 'DB Table',  value: item.db_table.join(', ') }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{
                fontSize: 12, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)', flexShrink: 0,
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 12, color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)', textAlign: 'right',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VaNi explanation — populated items */}
      {item.vani_explanation ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                Vᴺ
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>VaNi explains</span>
            </div>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-faint)', letterSpacing: '0.04em',
            }}>
              cached · updated rarely
            </span>
          </div>

          <div style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-glow)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <p style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
              margin: 0, marginBottom: item.vani_tags?.length ? 12 : 0,
              fontStyle: 'italic',
            }}>
              {item.vani_explanation}
            </p>

            {/* Works / Limits tags */}
            {item.vani_tags && item.vani_tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {item.vani_tags.map((tag, i) => (
                  <span key={i} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 12,
                    fontFamily: 'var(--font-mono, monospace)',
                    background: tag.type === 'works' ? 'var(--bull-bg)' : 'var(--bear-bg)',
                    border: `1px solid ${tag.type === 'works' ? 'var(--bull-dim)' : 'var(--bear-dim)'}`,
                    color: tag.type === 'works' ? 'var(--bull)' : 'var(--bear)',
                  }}>
                    {tag.type === 'works' ? '✓' : '✗'} {tag.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VaNi placeholder for items without explanation yet */
        <div style={{
          background: 'var(--accent-glow)',
          border: '1px solid var(--accent-glow)',
          borderRadius: 8, padding: '12px 14px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
          marginBottom: 18,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            Vᴺ
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            VaNi will explain <em style={{ color: 'var(--gold)', fontStyle: 'normal' }}>when and why</em> to
            use this indicator in the context of current market astro conditions.
          </p>
        </div>
      )}
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SEC_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono, monospace)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 10,
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface DeepDivePanelProps {
  item: DeepDiveItem | null
  onClose: () => void
}

export default function DeepDivePanel({ item, onClose }: DeepDivePanelProps) {
  const { profile } = useAuthStore()
  const isPaid = PAID_TIERS.includes(profile?.tier as never)
  const { isBlockActive, isOverlayActive } = useFrameworkStore()
  const { addToFramework } = useAddToFramework()
  const [gateOpen, setGateOpen] = useState(false)

  const isOpen = item !== null

  // Determine active/locked state + add handler for the CTA
  function ctaState(): { active: boolean; locked: boolean; label: string; activeLabel: string } {
    if (!item) return { active: false, locked: false, label: 'Add to Framework', activeLabel: 'Added' }

    {
      const { item: cat } = item
      const active = cat.placement === 'chart_overlay' ? isOverlayActive(cat.id) : isBlockActive(cat.id)
      const locked = cat.tier_required === 'paid' && !isPaid
      return {
        active,
        locked,
        label: '+ Add to Framework',
        activeLabel: '✓ In Framework',
      }
    }
  }

  function handleAdd() {
    if (!item) return

    {
      const r = addToFramework(item.item.id)
      if (r.reason === 'tier_gate') setGateOpen(true)
    }
  }

  const cta = ctaState()

  return (
    <>
      {/* Backdrop — only rendered when open */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 290,
            background: 'transparent',
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          right: isOpen ? 0 : -400,
          top: 0,
          bottom: 0,
          width: 380,
          background: 'var(--card)',
          borderLeft: '2px solid color-mix(in srgb, var(--gold) 35%, transparent)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5), -2px 0 0 color-mix(in srgb, var(--gold) 12%, transparent)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 300,
          transition: 'right 0.32s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              float: 'right',
              width: 26, height: 26,
              borderRadius: 5,
              border: '1px solid var(--border)',
              background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 10,
              lineHeight: 1,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'color-mix(in srgb, var(--text-primary) 18%, transparent)'
              el.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--border)'
              el.style.color = 'var(--text-secondary)'
            }}
          >
            ×
          </button>

          {item && (
            <>
              {/* Type label */}
              <div style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                {item.item.block_type.replace(/_/g, ' ')}
              </div>

              {/* Name */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 19,
                fontWeight: 300,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 0,
                clear: 'both',
              }}>
                {item.item.display_name}
              </div>

            </>
          )}
        </div>

        {/* Body — scrollable */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '18px 20px 32px',
        }}>
          {item?.mode === 'catalog_item' && <CatalogItemBody item={item.item} />}
        </div>

        {/* CTA footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
        }}>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 40,
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
              color: 'var(--text-secondary)',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'color-mix(in srgb, var(--text-primary) 7%, transparent)'
              el.style.borderColor = 'color-mix(in srgb, var(--text-primary) 18%, transparent)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'color-mix(in srgb, var(--text-primary) 3%, transparent)'
              el.style.borderColor = 'var(--border)'
            }}
            title="Close panel"
          >
            ✕
          </button>
          <button
            onClick={!cta.active && !cta.locked ? handleAdd : undefined}
            disabled={cta.locked}
            style={{
              flex: 1,
              padding: '13px',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: cta.active || cta.locked ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              background: cta.locked
                ? 'color-mix(in srgb, var(--text-primary) 5%, transparent)'
                : cta.active
                  ? 'linear-gradient(135deg,#2dd4bf,#059669)'
                  : 'linear-gradient(135deg,#7c6af7,#5b4fd4)',
              color: cta.locked ? 'var(--text-muted)' : '#fff',
              boxShadow: cta.locked || cta.active
                ? cta.active ? '0 4px 20px rgba(45,212,191,0.3)' : 'none'
                : '0 4px 20px rgba(124,106,247,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={e => {
              if (!cta.active && !cta.locked) {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px color-mix(in srgb, var(--accent) 50%, transparent)'
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = ''
              ;(e.currentTarget as HTMLElement).style.boxShadow = cta.locked || cta.active
                ? cta.active ? '0 4px 20px rgba(45,212,191,0.3)' : 'none'
                : '0 4px 20px rgba(124,106,247,0.4)'
            }}
          >
            {cta.locked ? '🔒 Paid tier required' : cta.active ? cta.activeLabel : cta.label}
          </button>
        </div>
      </div>

      <InlineGate
        context="add_rule"
        isOpen={gateOpen}
        onDismiss={() => setGateOpen(false)}
      />
    </>
  )
}
