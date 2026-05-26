import { useQuery } from '@tanstack/react-query'
import { from } from '@/services/postgrest'
import type { CatalogItem } from '@/constants/catalogItems'
import { RANGE_RULE_TYPES } from '@/constants/frameworkConstants'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAddToFramework } from '@/hooks/useAddToFramework'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'

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
  if (s.includes('bull'))  return '#4ade80'
  if (s.includes('bear'))  return '#f87171'
  if (s === 'volatile' || s === 'turning') return '#c9a84c'
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
        stroke="rgba(255,255,255,0.08)" strokeWidth={0.75} strokeDasharray="3 3"
      />
      {[...rows].reverse().map((row, i) => {
        const x = 16 + i * (BAR_W + BAR_GAP)
        const pct = row.win_pct ?? 0
        const barH = Math.max(2, (pct / maxPct) * H)
        const color = pct >= 65 ? '#4ade80' : pct >= 50 ? '#c9a84c' : '#f87171'
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
              fill="rgba(255,255,255,0.3)"
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

function AstroRuleBody({ item }: { item: DeepDiveAstroRule }) {
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
                  background: 'rgba(255,255,255,0.04)',
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
        background: isRange ? 'rgba(124,106,247,0.06)' : 'rgba(201,168,76,0.06)',
        border: `1px solid ${isRange ? 'rgba(124,106,247,0.2)' : 'rgba(201,168,76,0.2)'}`,
        fontSize: 11,
        color: 'var(--text-secondary)',
      }}>
        <span style={{ color: isRange ? '#8b7af8' : '#c9a84c', fontFamily: 'var(--font-mono, monospace)', fontSize: 9 }}>
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
                      ? '#4ade80' : (row.win_pct ?? 0) >= 50
                      ? '#c9a84c' : '#f87171',
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

      {/* VaNi placeholder */}
      <div style={{
        background: 'rgba(124,106,247,0.06)',
        border: '1px solid rgba(124,106,247,0.18)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
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
          VaNi interpretation for this rule will appear here once the
          {' '}<em style={{ color: 'var(--gold)', fontStyle: 'normal' }}>rule insight</em> skill is wired.
        </p>
      </div>
    </>
  )
}

// ── Mode B — Catalog Item body ────────────────────────────────────────────────

function CatalogItemBody({ item }: { item: CatalogItem }) {
  return (
    <>
      {/* Description */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          {item.description}
        </p>
      </div>

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
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)',
                flexShrink: 0,
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)',
                textAlign: 'right',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VaNi placeholder */}
      <div style={{
        background: 'rgba(124,106,247,0.06)',
        border: '1px solid rgba(124,106,247,0.18)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
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
      addToFramework(item.item.id)
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
          borderLeft: '1px solid var(--border)',
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
              background: 'rgba(255,255,255,0.04)',
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
              el.style.borderColor = 'rgba(255,255,255,0.18)'
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Body — scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
        }}>
          {item?.mode === 'astro_rule' && <AstroRuleBody item={item} />}
          {item?.mode === 'catalog_item' && <CatalogItemBody item={item.item} />}
        </div>

        {/* CTA footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={!cta.active && !cta.locked ? handleAdd : undefined}
            disabled={cta.locked}
            style={{
              width: '100%',
              padding: '13px',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: cta.active || cta.locked ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              background: cta.locked
                ? 'rgba(255,255,255,0.05)'
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
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(124,106,247,0.5)'
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
    </>
  )
}
