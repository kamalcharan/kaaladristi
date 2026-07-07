import { useNavigate } from 'react-router-dom'
import { FRAMEWORK_TEMPLATES } from '@/constants/frameworkTemplates'
import type { FrameworkTemplate } from '@/constants/frameworkTemplates'
import { useFrameworkStore } from '@/stores/frameworkStore'

// ── Mini SVG preview ─────────────────────────────────────────────────────────

const SVG_W = 116
const SVG_H = 72
const COLS  = 12
const ROWS  = 10
const GAP   = 2.5

function blockToRect(pos: { col_start: number; col_end: number; row_start: number; row_end: number }) {
  const cw = SVG_W / COLS
  const rh = SVG_H / ROWS
  return {
    x: (pos.col_start - 1) * cw + GAP / 2,
    y: (pos.row_start - 1) * rh + GAP / 2,
    w: (pos.col_end - pos.col_start) * cw - GAP,
    h: (pos.row_end - pos.row_start) * rh - GAP,
  }
}

const TYPE_STROKE: Record<string, string> = {
  indicator:  'rgba(45,212,191,0.6)',
  widget:     'rgba(124,106,247,0.6)',
  astro_rule: 'rgba(201,168,76,0.6)',
  scanner:    'color-mix(in srgb, var(--text-primary) 20%, transparent)',
}
const TYPE_FILL: Record<string, string> = {
  indicator:  'rgba(45,212,191,0.08)',
  widget:     'rgba(124,106,247,0.10)',
  astro_rule: 'rgba(201,168,76,0.10)',
  scanner:    'color-mix(in srgb, var(--text-primary) 3%, transparent)',
}

// Fake candlestick polyline — purely decorative, same across all cards
const CANDLE_PATH = 'M4,54 L10,42 L16,46 L22,38 L28,44 L34,30 L40,36 L46,28 L52,32 L58,20 L64,26 L70,16'

function MiniPreview({ template }: { template: FrameworkTemplate }) {
  // Chart area: cols 1–8, rows 1–8 (the implicit price chart)
  const chartW = (8 / COLS) * SVG_W - GAP
  const chartH = (8 / ROWS) * SVG_H - GAP

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
    >
      {/* chart backdrop */}
      <rect
        x={GAP / 2} y={GAP / 2}
        width={chartW} height={chartH}
        rx={3} fill="var(--text-faint)"
        stroke="var(--text-faint)" strokeWidth={0.5}
      />
      {/* fake price line */}
      <polyline
        points={CANDLE_PATH}
        fill="none"
        stroke="rgba(201,168,76,0.35)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* MA overlay ghost line */}
      <polyline
        points="4,50 10,46 16,48 22,44 28,46 34,38 40,42 46,36 52,38 58,30 64,34 70,26"
        fill="none"
        stroke="rgba(45,212,191,0.2)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />

      {/* framework blocks */}
      {template.blocks.map((block, i) => {
        const r = blockToRect(block.grid_position)
        const fill   = TYPE_FILL[block.type]   ?? TYPE_FILL.widget
        const stroke = TYPE_STROKE[block.type] ?? TYPE_STROKE.widget
        return (
          <rect
            key={i}
            x={r.x} y={r.y} width={r.w} height={r.h}
            rx={2}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.75}
          />
        )
      })}
    </svg>
  )
}

// ── Pill helpers ──────────────────────────────────────────────────────────────

type PillKind = 'astro' | 'tech' | 'widget' | 'scanner' | 'overlay'

const PILL_STYLE: Record<PillKind, React.CSSProperties> = {
  astro:   { borderColor: 'rgba(201,168,76,0.35)',  color: '#c9a84c', background: 'rgba(201,168,76,0.06)' },
  tech:    { borderColor: 'rgba(45,212,191,0.35)',  color: '#2dd4bf', background: 'rgba(45,212,191,0.06)' },
  widget:  { borderColor: 'rgba(124,106,247,0.35)', color: '#8b7af8', background: 'rgba(124,106,247,0.08)' },
  scanner: { borderColor: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', color: '#6b7280', background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)' },
  overlay: { borderColor: 'rgba(45,212,191,0.2)',   color: '#5dd8c8', background: 'rgba(45,212,191,0.04)' },
}

function blockKind(type: string): PillKind {
  if (type === 'astro_rule') return 'astro'
  if (type === 'indicator')  return 'tech'
  if (type === 'scanner')    return 'scanner'
  return 'widget'
}

function formatId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ')
}

// ── Template metadata ─────────────────────────────────────────────────────────

const DESCRIPTIONS: Record<string, string> = {
  vani_investor:
    'Designed for long-term positioning. MagicRS, Panchak window, and Six-Day Outlook give a weekly view grounded in Vedic cycles.',
  vani_trader:
    'Technical-first. EMA 20/50 on-chart, RSI 14 panel, Breadth ROC, and Conviction Flow scanner for active decision-making.',
  vani_hybrid_weighted:
    'Investor-leaning blend. Astro Panchak overlay paired with EMA momentum and breadth oscillator for medium-term positioning.',
  vani_hybrid_balanced:
    'Equal-weight hybrid — MagicRS, RSI 14, Breadth ROC, and Six-Day Outlook. Both Vedic intelligence and technical structure.',
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function MasterFrameworksSection() {
  const navigate = useNavigate()
  const { framework, applyTemplate, saveFramework } = useFrameworkStore()

  async function handleApply(template: FrameworkTemplate) {
    applyTemplate(template)
    await saveFramework()
    navigate('/workspace')
  }

  const activeTemplateId = framework?.template_id ?? null

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
          Master Frame<em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>works</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          VaNi-curated starting configurations. Choose one and it becomes your Workspace — you can customise it from there.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
      }}>
        {FRAMEWORK_TEMPLATES.map(template => {
          const isActive = activeTemplateId === template.id
          return (
            <div
              key={template.id}
              style={{
                border: `1px solid ${isActive ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`,
                borderRadius: 14,
                background: 'var(--bg-card, color-mix(in srgb, var(--text-primary) 3%, transparent))',
                overflow: 'hidden',
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'color-mix(in srgb, var(--text-primary) 14%, transparent)'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)'
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = isActive ? 'rgba(201,168,76,0.35)' : 'var(--border)'
                el.style.transform = ''
                el.style.boxShadow = ''
              }}
            >
              {/* Mini preview */}
              <div style={{
                height: 120,
                background: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
                padding: 10,
                position: 'relative',
              }}>
                <MiniPreview template={template} />
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    padding: '3px 9px',
                    borderRadius: 100,
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    letterSpacing: '0.06em',
                    background: 'rgba(201,168,76,0.12)',
                    border: '1px solid rgba(201,168,76,0.3)',
                    color: 'var(--gold)',
                  }}>
                    ACTIVE
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '16px 18px' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  marginBottom: 5,
                }}>
                  {template.display_name}
                </div>
                <p style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                  marginBottom: 12,
                }}>
                  {DESCRIPTIONS[template.id]}
                </p>

                {/* Block pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {template.blocks.map((block, i) => {
                    const kind = blockKind(block.type)
                    return (
                      <span
                        key={i}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontFamily: 'var(--font-mono, monospace)',
                          border: '1px solid',
                          ...PILL_STYLE[kind],
                        }}
                      >
                        {formatId(block.catalog_item_id)}
                      </span>
                    )
                  })}
                  {template.chart_overlays.map((ov, i) => (
                    <span
                      key={`ov-${i}`}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: 'var(--font-mono, monospace)',
                        border: '1px solid',
                        ...PILL_STYLE.overlay,
                      }}
                    >
                      {formatId(ov.catalog_item_id)} ↗
                    </span>
                  ))}
                </div>

                {/* Stats row */}
                <div style={{
                  display: 'flex',
                  gap: 16,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-muted)',
                }}>
                  <span>
                    <span style={{ color: 'var(--text-secondary)' }}>{template.blocks.length}</span>
                    {' '}blocks
                  </span>
                  <span>
                    <span style={{ color: 'var(--text-secondary)' }}>{template.chart_overlays.length}</span>
                    {' '}overlays
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-muted)',
                }}>
                  VaNi ✦ curated
                </span>

                {isActive ? (
                  <span style={{
                    fontSize: 12,
                    color: 'var(--gold)',
                    fontFamily: 'var(--font-mono, monospace)',
                    opacity: 0.7,
                  }}>
                    In workspace
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(template)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 7,
                      fontSize: 12,
                      cursor: 'pointer',
                      border: '1px solid rgba(124,106,247,0.4)',
                      background: 'rgba(124,106,247,0.10)',
                      color: '#8b7af8',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(124,106,247,0.18)'
                      el.style.borderColor = 'rgba(124,106,247,0.6)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(124,106,247,0.10)'
                      el.style.borderColor = 'rgba(124,106,247,0.4)'
                    }}
                  >
                    Apply Framework
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
