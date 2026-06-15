import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, AlertCircle, Database } from 'lucide-react'
import { fetchCatalogRules, fetchConfidence, type AstroRule } from '@/pages/RuleEngine/ruleService'
import { OutcomeBadge, TypeChip, ConfidenceCell, RULE_TYPE_LABELS, PROB_STYLES } from '@/pages/RuleEngine/RuleList'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAuthStore } from '@/stores/authStore'
import { RANGE_RULE_TYPES, PAID_TIERS } from '@/constants/frameworkConstants'
import { cn } from '@/lib/utils'
import InlineGate from '@/components/workspace/InlineGate'
import type { CatalogItem } from '@/constants/catalogItems'
import type { DeepDiveItem } from './DeepDivePanel'
import { TagChip, RULE_TAG_COLORS, DEFAULT_TAG_COLOR } from '@/constants/ruleTagColors'

function isRangeRule(rule: AstroRule): boolean {
  if ((RANGE_RULE_TYPES as readonly string[]).includes(rule.rule_type)) return true
  // Panchak compound rules are date-range windows → chart overlay
  // Other compound rules (SEA-, HEM-, VOL-) remain panel blocks
  if (rule.rule_type === 'compound' && rule.rule_code.startsWith('PNK')) return true
  return false
}

/** Clean display name for chart overlay label. */
function overlayLabel(rule: AstroRule): string {
  if ((rule.tags ?? []).includes('Panchak')) return 'Panchak'
  return rule.display_name
    .replace(/\s+(Bullish|Bearish|Volatile)$/i, '')
    .trim()
}

function ruleToCatalogItem(rule: AstroRule): CatalogItem {
  const range    = isRangeRule(rule)
  const isPanchak = (rule.tags ?? []).includes('Panchak')

  // All Panchak overlays share the same catalog_item_id so the chart always
  // fetches from PNK-ALL5-BUL/BEA which has all 549 windows. Individual
  // PNK sub-rules (PNK-IND-BUL etc.) have far fewer transit rows.
  const overlayId = isPanchak && range
    ? `astro_rule:${rule.base_bias === 'bearish' ? 'PNK-ALL5-BEA' : 'PNK-ALL5-BUL'}`
    : `astro_rule:${rule.rule_code}`

  return {
    id: overlayId,
    display_name: range ? overlayLabel(rule) : rule.display_name,
    description: rule.remarks ?? '',
    block_type: 'astro_rule',
    placement: range ? 'chart_overlay' : 'panel_block',
    overlay_type: range ? 'astro_zone' : undefined,
    color: isPanchak ? '#6366f1' : undefined,
    data_source: 'rule_engine',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
  }
}

function effectiveOutcome(rule: AstroRule): string {
  return rule.outcome || rule.base_bias || 'neutral'
}

interface CatalogAstroSectionProps {
  onSelect?: (item: DeepDiveItem) => void
  compact?: boolean
}

export default function CatalogAstroSection({ onSelect, compact = false }: CatalogAstroSectionProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])

  const { addBlock, addOverlay, isBlockActive, isOverlayActive } = useFrameworkStore()
  const [gateOpen, setGateOpen] = useState(false)

  // Shared query keys with RuleList — no duplicate network calls when both are mounted
  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ['rule-engine', 'catalog-rules'],
    queryFn: fetchCatalogRules,
    staleTime: 5 * 60 * 1000,
  })

  const { data: confidence = [] } = useQuery({
    queryKey: ['rule-engine', 'confidence'],
    queryFn: fetchConfidence,
    staleTime: 10 * 60 * 1000,
  })

  const confMap = useMemo(() => {
    const m = new Map<number, number | null>()
    for (const c of confidence) m.set(c.rule_id, c.confidence_score)
    return m
  }, [confidence])

  function isRuleActive(rule: AstroRule): boolean {
    const id = `astro_rule:${rule.rule_code}`
    return isRangeRule(rule) ? isOverlayActive(id) : isBlockActive(id)
  }

  function handleAdd(rule: AstroRule, e: React.MouseEvent) {
    e.stopPropagation()
    const tier = useAuthStore.getState().profile?.tier ?? 'free'
    if (!PAID_TIERS.includes(tier as typeof PAID_TIERS[number])) {
      setGateOpen(true)
      return
    }
    const item = ruleToCatalogItem(rule)
    if (isRangeRule(rule)) {
      addOverlay(item, item.color)
    } else {
      addBlock(item)
    }
  }

  const ruleTypes = useMemo(
    () => Array.from(new Set(rules.map(r => r.rule_type))).sort(),
    [rules],
  )

  const allTags = useMemo(
    () => Array.from(new Set(rules.flatMap(r => r.tags ?? []))).sort(),
    [rules],
  )

  function toggleTag(tag: string) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const filtered = useMemo(() => {
    let list = rules
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.display_name.toLowerCase().includes(q) || r.rule_code.toLowerCase().includes(q)
      )
    }
    if (typeFilter) list = list.filter(r => r.rule_type === typeFilter)
    if (activeTags.length > 0) {
      list = list.filter(r => activeTags.some(t => (r.tags ?? []).includes(t)))
    }
    return list
  }, [rules, search, typeFilter, activeTags])

  return (
    <>
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 300,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}>
          Astro <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Rules</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Live from{' '}
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>km_astro_rule_master</span>.{' '}
          Range rules (Transit, State, Conjunct) add as chart overlays. Point rules add as panel blocks.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search rules…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 30,
              paddingRight: 12,
              paddingTop: 7,
              paddingBottom: 7,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,106,247,0.4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 11px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono, monospace)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">All Types</option>
          {ruleTypes.map(t => (
            <option key={t} value={t}>{RULE_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <span style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}>
          {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setActiveTags([])}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              cursor: 'pointer',
              border: `1px solid ${activeTags.length === 0 ? 'rgba(124,106,247,0.5)' : 'var(--border)'}`,
              background: activeTags.length === 0 ? 'rgba(124,106,247,0.15)' : 'rgba(255,255,255,0.03)',
              color: activeTags.length === 0 ? '#8b7af8' : 'var(--text-muted)',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            All
          </button>
          {allTags.map(tag => {
            const active = activeTags.includes(tag)
            const colorCls = RULE_TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[11px] border transition-all cursor-pointer',
                  active ? colorCls : 'bg-transparent text-muted border-kd-border hover:border-kd-border-active',
                )}
                style={{ fontFamily: 'inherit' }}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Loading rules…
        </div>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertCircle style={{ width: 16, height: 16 }} /> Could not load rules from database.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Database style={{ width: 16, height: 16, opacity: 0.4 }} />
          {rules.length === 0 ? 'No rules in database' : 'No rules match this filter.'}
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflowX: compact ? 'visible' : 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                {(compact
                  ? ['Rule', 'Type', 'Tags', '']
                  : ['Code', 'Rule', 'Type', 'Outcome', 'Probability', 'Confidence', 'Tags', '']
                ).map(col => (
                  <th
                    key={col}
                    style={{
                      padding: '9px 13px',
                      textAlign: col === '' ? 'right' : 'left',
                      fontSize: 9,
                      fontFamily: 'var(--font-mono, monospace)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rule, i) => {
                const active  = isRuleActive(rule)
                const outcome = effectiveOutcome(rule)
                const conf    = confMap.get(rule.id)
                const range   = isRangeRule(rule)

                return (
                  <tr
                    key={rule.id}
                    onClick={() => onSelect?.({
                      mode: 'astro_rule',
                      id: rule.id,
                      rule_code: rule.rule_code,
                      rule_type: rule.rule_type,
                      display_name: rule.display_name,
                      outcome: rule.outcome,
                      base_bias: rule.base_bias,
                      probability_label: rule.probability_label,
                      remarks: rule.remarks,
                      conditions: null,
                      tags: rule.tags ?? [],
                      catalog_visible: rule.catalog_visible,
                    })}
                    className={cn(
                      'transition-colors cursor-pointer',
                      i % 2 === 0 ? '' : 'bg-white/[0.01]',
                    )}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: active ? 'rgba(45,212,191,0.03)' : undefined,
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = active ? 'rgba(45,212,191,0.03)' : i % 2 === 0 ? '' : 'rgba(255,255,255,0.01)'
                    }}
                  >
                    {/* Code — full catalog only */}
                    {!compact && (
                      <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 11,
                          color: '#8b7af8',
                          background: 'rgba(124,106,247,0.10)',
                          border: '1px solid rgba(124,106,247,0.20)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}>
                          {rule.rule_code}
                        </span>
                      </td>
                    )}

                    {/* Rule name */}
                    <td style={{ padding: '10px 13px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {rule.display_name}
                        </span>
                        {compact && (
                          <span style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: 10,
                            color: 'rgba(139,122,248,0.6)',
                          }}>
                            {rule.rule_code}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <TypeChip ruleType={rule.rule_type} />
                    </td>

                    {/* Outcome — full catalog only */}
                    {!compact && (
                      <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <OutcomeBadge outcome={outcome} />
                      </td>
                    )}

                    {/* Probability — full catalog only */}
                    {!compact && (
                      <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {rule.probability_label ? (
                          <span className={cn('text-xs', PROB_STYLES[rule.probability_label] ?? 'text-muted')}>
                            {rule.probability_label}
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    )}

                    {/* Confidence — full catalog only */}
                    {!compact && (
                      <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <ConfidenceCell score={conf} />
                      </td>
                    )}

                    {/* Tags */}
                    <td style={{ padding: '10px 13px', verticalAlign: 'middle' }}>
                      {(rule.tags ?? []).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {rule.tags.slice(0, 3).map(tag => (
                            <TagChip key={tag} tag={tag} />
                          ))}
                          {rule.tags.length > 3 && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                              +{rule.tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Add / Active */}
                    <td style={{ padding: '10px 13px', verticalAlign: 'middle', textAlign: 'right' }}>
                      {active ? (
                        <span style={{
                          fontSize: 11,
                          fontFamily: 'var(--font-mono, monospace)',
                          color: '#2dd4bf',
                          whiteSpace: 'nowrap',
                        }}>
                          ✓ {range ? 'overlay' : 'added'}
                        </span>
                      ) : (
                        <button
                          onClick={e => handleAdd(rule, e)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 5,
                            fontSize: 11,
                            cursor: 'pointer',
                            border: '1px solid rgba(124,106,247,0.35)',
                            background: 'rgba(124,106,247,0.08)',
                            color: '#8b7af8',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
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
                          + {range ? 'Overlay' : 'Add'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    <InlineGate
      context="add_rule"
      isOpen={gateOpen}
      onDismiss={() => setGateOpen(false)}
    />
    </>
  )
}
