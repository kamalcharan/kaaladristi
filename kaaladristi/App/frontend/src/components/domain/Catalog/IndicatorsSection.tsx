import { useState, useRef, useEffect } from 'react'
import { getCatalogItemsByType, type CatalogItem } from '@/constants/catalogItems'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import InlineGate from '@/components/workspace/InlineGate'
import type { DeepDiveItem } from './DeepDivePanel'

// Only chart overlay indicators belong here — panel_block indicators (RSI 14, ATR 14) live in WidgetsSection
const INDICATORS = getCatalogItemsByType('indicator').filter(i => i.placement === 'chart_overlay')

// Default colors per indicator
const INDICATOR_DEFAULTS: Record<string, string> = {
  ema_20:       '#7c6af7',
  ema_60:       '#4ade80',
  sma_50:       '#fb923c',
  sma_150:      '#f59e0b',
  sma_200:      '#f43f5e',
  supertrend:   '#2dd4bf',
  pivot_levels: '#94a3b8',
  atr_14:       '#c084fc',
  rsi_14:       '#60a5fa',
}

const SWATCH_PALETTE = [
  '#7c6af7', '#a78bfa', '#c084fc', '#e879f9',
  '#4ade80', '#2dd4bf', '#38bdf8', '#60a5fa',
  '#fb923c', '#f59e0b', '#facc15', '#a3e635',
  '#f43f5e', '#fb7185', '#94a3b8', '#e2e8f0',
]

// Mini SVG preview paths per indicator (viewBox 0 0 160 36)
function IndicatorPreview({ id, color }: { id: string; color: string }) {
  const isSupertrend = id === 'supertrend'
  const isBand = id === 'pivot_levels'

  if (isSupertrend) {
    return (
      <svg viewBox="0 0 160 36" width="100%" height={36} style={{ display: 'block' }}>
        {/* Price bars (faint) */}
        {[10,22,34,46,58,70,82,94,106,118,130,142,154].map((x, i) => (
          <line key={x} x1={x} y1={36 - (i < 6 ? 14 + i * 2 : 26 - (i-6) * 2)} x2={x}
            y2={36 - (i < 6 ? 8 + i * 2 : 20 - (i-6) * 2)}
            stroke="rgba(255,255,255,0.1)" strokeWidth={4} strokeLinecap="round" />
        ))}
        {/* SuperTrend — bull phase then bear flip */}
        <path d="M6,26 L70,18" stroke="#2dd4bf" strokeWidth={1.5} fill="none" strokeDasharray="none" />
        <path d="M70,18 L154,10" stroke="#f43f5e" strokeWidth={1.5} fill="none" />
        <text x={70} y={8} fill="rgba(255,255,255,0.25)" fontSize={7} textAnchor="middle"
          fontFamily="monospace">flip</text>
      </svg>
    )
  }

  if (isBand) {
    return (
      <svg viewBox="0 0 160 36" width="100%" height={36} style={{ display: 'block' }}>
        {/* R2 */ }
        <line x1={0} y1={4} x2={160} y2={4} stroke={color} strokeWidth={0.5} strokeDasharray="4 4" opacity={0.4} />
        {/* R1 */}
        <line x1={0} y1={10} x2={160} y2={10} stroke={color} strokeWidth={0.5} strokeDasharray="4 4" opacity={0.55} />
        {/* PP */}
        <line x1={0} y1={18} x2={160} y2={18} stroke={color} strokeWidth={1} />
        {/* S1 */}
        <line x1={0} y1={26} x2={160} y2={26} stroke={color} strokeWidth={0.5} strokeDasharray="4 4" opacity={0.55} />
        {/* S2 */}
        <line x1={0} y1={32} x2={160} y2={32} stroke={color} strokeWidth={0.5} strokeDasharray="4 4" opacity={0.4} />
        {/* PP label */}
        <text x={4} y={16} fill={color} fontSize={6} fontFamily="monospace" opacity={0.7}>PP</text>
        {/* Price candle */}
        <path d="M100,8 L140,28" stroke="rgba(255,255,255,0.1)" strokeWidth={6} strokeLinecap="round" />
      </svg>
    )
  }

  // Moving average / oscillator line
  const paths: Record<string, string> = {
    ema_20:  'M0,28 C20,26 40,22 60,18 S100,12 120,14 S145,18 160,16',
    ema_60:  'M0,24 C30,22 60,20 90,18 S130,16 160,15',
    sma_50:  'M0,22 C40,21 80,19 120,18 S150,17 160,17',
    sma_150: 'M0,20 C50,20 100,19 150,18 S158,18 160,18',
    sma_200: 'M0,19 C60,19 110,18 150,18 S158,18 160,18',
    atr_14:  'M0,30 C10,10 20,28 30,14 S50,28 60,12 S80,28 90,14 S110,28 120,14 S140,28 150,14 S158,28 160,18',
    rsi_14:  'M0,14 C10,8 20,24 35,28 S50,20 65,12 S80,6 95,14 S110,24 125,18 S145,12 160,16',
  }

  return (
    <svg viewBox="0 0 160 36" width="100%" height={36} style={{ display: 'block' }}>
      {/* Faint price line */}
      <path d="M0,26 C20,24 40,20 60,16 S100,10 120,13 S145,16 160,14"
        stroke="rgba(255,255,255,0.08)" strokeWidth={2} fill="none" />
      {/* Indicator line */}
      {paths[id] && (
        <path d={paths[id]} stroke={color} strokeWidth={1.5} fill="none" />
      )}
      {/* Chart label */}
      <text x={4} y={34} fill="rgba(255,255,255,0.18)" fontSize={6} fontFamily="monospace">
        NIFTY 50 · 1Y
      </text>
    </svg>
  )
}

function ColorSwatch({
  color, itemId, onChange,
}: {
  color: string
  itemId: string
  onChange: (c: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isSupertrend = itemId === 'supertrend'

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        title={isSupertrend ? 'SuperTrend uses bull/bear theme colors — not configurable' : 'Change color'}
        onClick={e => {
          e.stopPropagation()
          if (!isSupertrend) setOpen(o => !o)
        }}
        style={{
          width: 16, height: 16, borderRadius: 3,
          background: isSupertrend ? 'linear-gradient(135deg, #2dd4bf 50%, #f43f5e 50%)' : color,
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: isSupertrend ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          opacity: isSupertrend ? 0.6 : 1,
        }}
      />
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 22, left: 0, zIndex: 400,
            background: 'var(--card, #1a1a2e)',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: 8,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {SWATCH_PALETTE.map(s => (
            <button
              key={s}
              title={s}
              onClick={() => { onChange(s); setOpen(false) }}
              style={{
                width: 20, height: 20, borderRadius: 4,
                background: s,
                border: s === color ? '2px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface IndicatorsSectionProps {
  onSelect?: (item: DeepDiveItem) => void
}

export default function IndicatorsSection({ onSelect }: IndicatorsSectionProps) {
  const { profile } = useAuthStore()
  const { addBlock, addOverlay, isBlockActive, isOverlayActive } = useFrameworkStore()
  const isPaid = PAID_TIERS.includes(profile?.tier as never)
  const [gateOpen, setGateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(INDICATORS.map(i => [i.id, INDICATOR_DEFAULTS[i.id] ?? '#7c6af7']))
  )

  function handleSelect(item: CatalogItem) {
    setSelectedId(item.id)
    onSelect?.({ mode: 'catalog_item', item })
  }

  function isActive(item: CatalogItem) {
    return item.placement === 'chart_overlay' ? isOverlayActive(item.id) : isBlockActive(item.id)
  }

  function handleAdd(item: CatalogItem, e: React.MouseEvent) {
    e.stopPropagation()
    if (item.tier_required === 'paid' && !isPaid) { setGateOpen(true); return }
    const color = colors[item.id]
    if (item.placement === 'chart_overlay') {
      addOverlay(item, color)
    } else {
      addBlock(item)
    }
  }

  function setColor(itemId: string, color: string) {
    setColors(prev => ({ ...prev, [itemId]: color }))
  }

  return (
    <>
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 300,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}>
          Chart <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Indicators</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
          Technical indicators drawn directly on the price chart as lines, bands, or zones.
          Pick a color before adding — you can change it anytime from the overlay strip.
        </p>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--bull)', display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bull)', display: 'inline-block' }} />
          All free tier
        </span>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        {INDICATORS.map(item => {
          const active   = isActive(item)
          const selected = selectedId === item.id
          const color    = colors[item.id] ?? '#7c6af7'
          const isChart  = item.placement === 'chart_overlay'

          return (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              style={{
                border: `1px solid ${
                  active   ? 'rgba(45,212,191,0.28)' :
                  selected ? 'rgba(201,168,76,0.45)' :
                             'var(--border)'
                }`,
                borderRadius: 10,
                background: active
                  ? 'rgba(45,212,191,0.04)'
                  : selected
                    ? 'rgba(201,168,76,0.04)'
                    : 'rgba(255,255,255,0.02)',
                boxShadow: selected ? '0 0 0 1px rgba(201,168,76,0.15), inset 3px 0 0 rgba(201,168,76,0.5)' : 'none',
                overflow: 'hidden',
                transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                position: 'relative',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!active && !selected) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={e => {
                if (!active && !selected) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                }
              }}
            >
              {/* Color strip — gold when selected */}
              <div style={{ height: 3, background: selected ? 'var(--gold)' : color, opacity: active ? 1 : 0.7 }} />

              <div style={{ padding: '12px 14px' }}>
                {/* Type chips */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                  {isChart && (
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-muted)', letterSpacing: '0.08em',
                      textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3,
                    }}>
                      Chart Overlay
                    </span>
                  )}
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)', letterSpacing: '0.08em',
                    textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3,
                  }}>
                    Indicator
                  </span>
                </div>

                {/* Name */}
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 300,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  marginBottom: 6,
                }}>
                  {item.display_name}
                </div>

                {/* VaNi one-liner */}
                {item.vani_explanation && (
                  <p style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginBottom: 10,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    <span style={{ color: 'var(--accent)', marginRight: 4 }}>✦</span>
                    {item.vani_explanation.split('—')[0].trim()}
                  </p>
                )}

                {/* Mini preview SVG */}
                <div style={{
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.2)',
                  marginBottom: 10,
                }}>
                  <IndicatorPreview id={item.id} color={color} />
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  {/* DB column badge */}
                  {item.db_column && (
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-faint)', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3,
                      flexShrink: 0,
                    }}>
                      {item.db_column}
                    </span>
                  )}

                  {/* Color swatch */}
                  {isChart && (
                    <ColorSwatch
                      color={color}
                      itemId={item.id}
                      onChange={c => setColor(item.id, c)}
                    />
                  )}

                  {/* Add / Added */}
                  {active ? (
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                      color: '#2dd4bf', marginLeft: 'auto',
                    }}>
                      ✓ added
                    </span>
                  ) : (
                    <button
                      onClick={e => handleAdd(item, e)}
                      style={{
                        marginLeft: 'auto',
                        padding: '4px 12px', borderRadius: 5, fontSize: 11,
                        cursor: 'pointer',
                        border: '1px solid rgba(124,106,247,0.35)',
                        background: 'rgba(124,106,247,0.08)',
                        color: '#8b7af8', fontFamily: 'inherit',
                        transition: 'all 0.15s', flexShrink: 0,
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
                      + {isChart ? 'Overlay' : 'Add'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>

    <InlineGate
      context="add_indicator"
      isOpen={gateOpen}
      onDismiss={() => setGateOpen(false)}
    />
    </>
  )
}
