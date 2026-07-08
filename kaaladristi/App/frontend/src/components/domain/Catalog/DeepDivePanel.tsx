import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { from } from '@/services/postgrest'
import type { CatalogItem } from '@/constants/catalogItems'
import { RANGE_RULE_TYPES } from '@/constants/frameworkConstants'
import { TagChip } from '@/constants/ruleTagColors'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAddToFramework } from '@/hooks/useAddToFramework'
import RuleInsightCard from '@/components/domain/VaNi/RuleInsightCard'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import InlineGate from '@/components/workspace/InlineGate'

// ── Shared types (exported for section components) ────────────────────────────

export interface DeepDiveAstroRule {
  mode: 'astro_rule'
  id: number
  rule_code: string
  rule_type: string
  display_name: string
  outcome: string | null
  base_bias: string | null
  probability_label: string | null
  remarks: string | null
  conditions: Record<string, unknown> | null
  tags?: string[]
  catalog_visible?: boolean
}

export interface DeepDiveCatalogItem {
  mode: 'catalog_item'
  item: CatalogItem
}

export type DeepDiveItem = DeepDiveAstroRule | DeepDiveCatalogItem

// ── DB types ──────────────────────────────────────────────────────────────────

interface RuleConf {
  rule_id: number
  total_occurrences: number | null
  matched_count: number | null
  confidence_score: number | null
  avg_return_matched: number | null
  avg_duration_days: number | null
  best_return: number | null
  worst_return: number | null
}

interface RuleConfYearly {
  year: number
  transits: number
  matched: number
  win_pct: number | null
  avg_return: number | null
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchConf(ruleId: number): Promise<RuleConf | null> {
  const { data, error } = await from('km_rule_confidence')
    .select('rule_id,total_occurrences,matched_count,confidence_score,avg_return_matched,avg_duration_days,best_return,worst_return')
    .eq('rule_id', ruleId)
    .maybeSingle()
    .execute()
  if (error) return null
  return (data as unknown as RuleConf) ?? null
}

async function fetchYearly(ruleId: number): Promise<RuleConfYearly[]> {
  const { data, error } = await from('km_rule_confidence_yearly')
    .select('year,transits,matched,win_pct,avg_return')
    .eq('rule_id', ruleId)
    .order('year', { ascending: false })
    .execute()
  if (error) return []
  return (data as RuleConfYearly[]) ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 1, suffix = ''): string {
  if (n == null) return '—'
  return `${n.toFixed(digits)}${suffix}`
}

function outcomeColor(s: string | null): string {
  if (!s) return 'var(--text-muted)'
  if (s.includes('bull'))  return 'var(--bull)'
  if (s.includes('bear'))  return 'var(--bear)'
  if (s === 'volatile' || s === 'turning') return 'var(--gold)'
  return 'var(--text-secondary)'
}

const RULE_TYPE_LABELS: Record<string, string> = {
  nakshatra_vara:       'Nakshatra · Vara',
  planet_transit:       'Planet Transit',
  planet_state:         'Planet State',
  planet_conjunction:   'Conjunction',
  planet_manifestation: 'Manifestation',
  compound:             'Compound',
  tithi_alone:          'Tithi',
  eclipse:              'Eclipse',
  vedh:                 'Vedh',
}

// ── Mini yearly bar chart ────────────────────────────────────────────────────

function YearlyBars({ rows }: { rows: RuleConfYearly[] }) {
  if (rows.length === 0) return null
  const maxPct = 100
  const BAR_W  = 18
  const BAR_GAP = 4
  const H = 56
  const total_w = rows.length * (BAR_W + BAR_GAP) - BAR_GAP + 32

  return (
    <svg viewBox={`0 0 ${total_w} ${H + 18}`} width="100%" height={H + 18} style={{ display: 'block' }}>
      {/* 50% reference line */}
      <line
        x1={16} y1={H - (50 / maxPct) * H}
        x2={total_w - 16} y2={H - (50 / maxPct) * H}
        stroke="color-mix(in srgb, var(--text-primary) 8%, transparent)" strokeWidth={0.75} strokeDasharray="3 3"
      />
      {[...rows].reverse().map((row, i) => {
        const x = 16 + i * (BAR_W + BAR_GAP)
        const pct = row.win_pct ?? 0
        const barH = Math.max(2, (pct / maxPct) * H)
        const color = pct >= 65 ? 'var(--bull)' : pct >= 50 ? 'var(--gold)' : 'var(--bear)'
        return (
          <g key={row.year}>
            <rect
              x={x} y={H - barH}
              width={BAR_W} height={barH}
              rx={2}
              fill={color}
              opacity={0.7}
            />
            <text
              x={x + BAR_W / 2} y={H + 12}
              textAnchor="middle"
              fontSize={7}
              fill="color-mix(in srgb, var(--text-primary) 30%, transparent)"
              fontFamily="monospace"
            >
              {String(row.year).slice(2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Mode A — Astro Rule body ──────────────────────────────────────────────────

function AstroRuleBody({ item, onClose }: { item: DeepDiveAstroRule; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: conf = null, isLoading: confLoading } = useQuery({
    queryKey: ['dp-conf', item.id],
    queryFn: () => fetchConf(item.id),
    staleTime: 5 * 60 * 1000,
  })

  const { data: yearly = [] } = useQuery({
    queryKey: ['dp-yearly', item.id],
    queryFn: () => fetchYearly(item.id),
    staleTime: 5 * 60 * 1000,
  })

  const isRange = (RANGE_RULE_TYPES as readonly string[]).includes(item.rule_type)

  return (
    <>
      {/* VaNi interpretation — lead with it, right under the heading (hidden when none) */}
      <RuleInsightCard ruleId={item.id ?? null} className="mt-0 mb-5" />

      {/* Remarks */}
      {item.remarks && (
        <div style={{ marginBottom: 18 }}>
          <div style={SEC_LABEL}>Description</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {item.remarks}
          </p>
        </div>
      )}

      {/* Conditions tags */}
      {item.conditions && Object.keys(item.conditions).length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={SEC_LABEL}>Conditions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.entries(item.conditions).map(([k, v]) => (
              <span
                key={k}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono, monospace)',
                  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Placement note */}
      <div style={{
        marginBottom: 18,
        padding: '8px 12px',
        borderRadius: 6,
        background: isRange ? 'var(--accent-glow)' : 'var(--gold-bg)',
        border: `1px solid ${isRange ? 'var(--accent-dim)' : 'var(--gold-bg)'}`,
        fontSize: 11,
        color: 'var(--text-secondary)',
      }}>
        <span style={{ color: isRange ? 'var(--accent)' : 'var(--gold)', fontFamily: 'var(--font-mono, monospace)', fontSize: 9 }}>
          {isRange ? 'CHART OVERLAY' : 'PANEL BLOCK'}
        </span>
        {' — '}
        {isRange
          ? 'Adds as an astro zone shaded on the price chart'
          : 'Adds as a panel block on the workspace canvas'}
      </div>

      {/* Backtesting stats */}
      <div style={{ marginBottom: 18 }}>
        <div style={SEC_LABEL}>Backtesting</div>
        {confLoading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
        ) : !conf ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not yet scored.</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}>
            {[
              { label: 'Total Signals',  value: fmt(conf.total_occurrences, 0) },
              { label: 'Win Rate',       value: fmt(conf.confidence_score, 1, '%') },
              { label: 'Avg Return',     value: fmt(conf.avg_return_matched, 2, '%') },
              { label: 'Avg Duration',   value: fmt(conf.avg_duration_days, 1, 'd') },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: 'var(--bg, rgba(0,0,0,0.4))',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: 3,
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-muted)',
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yearly bar chart */}
      {yearly.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={SEC_LABEL}>Win Rate by Year</div>
          <div style={{
            background: 'var(--bg, rgba(0,0,0,0.4))',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 10px 8px',
          }}>
            <YearlyBars rows={yearly} />
            {/* Micro table */}
            <div style={{
              marginTop: 8,
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}>
              {yearly.slice(0, 5).map(row => (
                <div key={row.year} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono, monospace)',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.year}</span>
                  <span style={{
                    color: (row.win_pct ?? 0) >= 65
                      ? 'var(--bull)' : (row.win_pct ?? 0) >= 50
                      ? 'var(--gold)' : 'var(--bear)',
                  }}>
                    {fmt(row.win_pct, 0, '%')} win
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {fmt(row.avg_return, 2, '%')} avg ret
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {row.transits} signals
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Analysis secondary CTA */}
      <button
        onClick={() => { navigate(`/rules/${item.id}`); onClose() }}
        style={{
          display: 'block',
          width: '100%',
          padding: '9px 14px',
          marginBottom: 18,
          borderRadius: 8,
          border: '1px solid var(--accent-dim)',
          background: 'var(--accent-glow)',
          color: 'var(--accent)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'color-mix(in srgb, var(--accent) 50%, transparent)'
          el.style.background = 'var(--accent-dim)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--accent-dim)'
          el.style.background = 'var(--accent-glow)'
        }}
      >
        Full Analysis →
      </button>
    </>
  )
}

const SWATCH_PALETTE_DP = [
  '#7c6af7', '#a78bfa', '#c084fc', '#e879f9',
  '#4ade80', '#2dd4bf', '#38bdf8', '#60a5fa',
  '#fb923c', '#f59e0b', '#facc15', '#a3e635',
  '#f43f5e', '#fb7185', '#94a3b8', '#e2e8f0',
]

const INDICATOR_DEFAULTS_DP: Record<string, string> = {
  ema_20: '#7c6af7', ema_60: '#4ade80', sma_50: '#fb923c',
  sma_150: '#f59e0b', sma_200: '#f43f5e', supertrend: '#2dd4bf',
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
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
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
                fontSize: 11, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)', flexShrink: 0,
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 11, color: 'var(--text-secondary)',
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
                fontSize: 9, fontWeight: 700, color: '#fff',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                Vᴺ
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>VaNi explains</span>
            </div>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
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
                    padding: '3px 8px', borderRadius: 4, fontSize: 10,
                    fontFamily: 'var(--font-mono, monospace)',
                    background: tag.type === 'works'
                      ? 'rgba(45,212,191,0.07)' : 'rgba(239,68,68,0.07)',
                    border: `1px solid ${tag.type === 'works' ? 'rgba(45,212,191,0.18)' : 'rgba(239,68,68,0.18)'}`,
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
            fontSize: 9, fontWeight: 700, color: '#fff',
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
  fontSize: 9,
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
  const { addBlock, addOverlay, isBlockActive, isOverlayActive } = useFrameworkStore()
  const { addToFramework } = useAddToFramework()
  const [gateOpen, setGateOpen] = useState(false)

  const isOpen = item !== null

  // Determine active/locked state + add handler for the CTA
  function ctaState(): { active: boolean; locked: boolean; label: string; activeLabel: string } {
    if (!item) return { active: false, locked: false, label: 'Add to Framework', activeLabel: 'Added' }

    if (item.mode === 'astro_rule') {
      const id = `astro_rule:${item.rule_code}`
      const isRange = (RANGE_RULE_TYPES as readonly string[]).includes(item.rule_type)
      const active = isRange ? isOverlayActive(id) : isBlockActive(id)
      return {
        active,
        locked: false,
        label: isRange ? '+ Add Overlay' : '+ Add to Framework',
        activeLabel: isRange ? '✓ Overlay Added' : '✓ In Framework',
      }
    } else {
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

    if (item.mode === 'astro_rule') {
      const isRange = (RANGE_RULE_TYPES as readonly string[]).includes(item.rule_type)
      const syntheticItem: CatalogItem = {
        id: `astro_rule:${item.rule_code}`,
        display_name: item.display_name,
        description: item.remarks ?? '',
        block_type: 'astro_rule',
        placement: isRange ? 'chart_overlay' : 'panel_block',
        overlay_type: isRange ? 'astro_zone' : undefined,
        data_source: 'rule_engine',
        applicable_to: ['equity', 'index'],
        tier_required: 'free',
      }
      if (isRange) addOverlay(syntheticItem)
      else addBlock(syntheticItem)
    } else {
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
          background: 'var(--bg-card, #0d1117)',
          borderLeft: '2px solid rgba(201,168,76,0.35)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5), -2px 0 0 rgba(201,168,76,0.12)',
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
                fontSize: 9,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                {item.mode === 'astro_rule'
                  ? (RULE_TYPE_LABELS[item.rule_type] ?? item.rule_type)
                  : item.item.block_type.replace(/_/g, ' ')}
              </div>

              {/* Name */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 19,
                fontWeight: 300,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: item.mode === 'astro_rule' ? 8 : 0,
                clear: 'both',
              }}>
                {item.mode === 'astro_rule' ? item.display_name : item.item.display_name}
              </div>

              {/* Outcome badge (astro only) */}
              {item.mode === 'astro_rule' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11,
                    color: outcomeColor(item.outcome || item.base_bias),
                  }}>
                    {(item.outcome || item.base_bias || 'neutral')
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  {item.probability_label && (
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-muted)',
                    }}>
                      · {item.probability_label}
                    </span>
                  )}
                  {/* Catalog status badge */}
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: item.catalog_visible ? 'rgba(45,212,191,0.1)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                    border: `1px solid ${item.catalog_visible ? 'rgba(45,212,191,0.25)' : 'var(--border)'}`,
                    color: item.catalog_visible ? '#2dd4bf' : 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                  }}>
                    {item.catalog_visible ? 'In Catalog' : 'Admin Only'}
                  </span>
                </div>
              )}

              {/* Tags row (astro only) */}
              {item.mode === 'astro_rule' && (item.tags ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {(item.tags ?? []).map(tag => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                </div>
              )}
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
          {item?.mode === 'astro_rule' && <AstroRuleBody item={item} onClose={onClose} />}
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
