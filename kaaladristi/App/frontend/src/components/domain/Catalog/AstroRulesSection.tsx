import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { from } from '@/services/postgrest'
import { RANGE_RULE_TYPES } from '@/constants/frameworkConstants'
import type { CatalogItem } from '@/constants/catalogItems'
import { useFrameworkStore } from '@/stores/frameworkStore'
import type { DeepDiveItem } from './DeepDivePanel'

// ── DB types ──────────────────────────────────────────────────────────────────

interface AstroRuleRow {
  id: number
  rule_code: string
  rule_type: string
  display_name: string
  outcome: string | null
  base_bias: string | null
  probability_label: string | null
  data_source: string | null
  is_active: boolean
  remarks: string | null
}

interface RuleConfRow {
  rule_id: number
  confidence_score: number | null
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchActiveRules(): Promise<AstroRuleRow[]> {
  const { data, error } = await from('km_astro_rule_master')
    .select('id,rule_code,rule_type,display_name,outcome,base_bias,probability_label,data_source,is_active,remarks')
    .is('is_deleted', 'false')
    .eq('is_active', 'true')
    .order('rule_type')
    .order('rule_code')
    .execute()
  if (error) throw new Error(error.message)
  return (data as AstroRuleRow[]) ?? []
}

async function fetchConfidence(): Promise<Record<number, number>> {
  const { data, error } = await from('km_rule_confidence')
    .select('rule_id,confidence_score')
    .execute()
  if (error) return {}
  const map: Record<number, number> = {}
  for (const row of (data as RuleConfRow[]) ?? []) {
    if (row.confidence_score != null) map[row.rule_id] = row.confidence_score
  }
  return map
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RULE_TYPE_LABELS: Record<string, string> = {
  nakshatra_vara:       'Nak·Vara',
  planet_transit:       'Transit',
  planet_state:         'P·State',
  planet_conjunction:   'Conjunct',
  planet_manifestation: 'Manifest',
  compound:             'Compound',
  tithi_alone:          'Tithi',
  eclipse:              'Eclipse',
  vedh:                 'Vedh',
}

function outcomeColor(outcome: string | null): string {
  if (!outcome) return 'var(--text-muted)'
  if (outcome.includes('bull'))    return '#4ade80'
  if (outcome.includes('bear'))    return '#f87171'
  if (outcome === 'volatile')      return '#c9a84c'
  if (outcome === 'turning')       return '#c9a84c'
  return 'var(--text-secondary)'
}

function outcomeLabel(outcome: string | null, baseBias: string | null): string {
  const val = outcome || baseBias || 'neutral'
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function probColor(label: string | null): string {
  if (!label) return 'var(--text-muted)'
  if (label.includes('High') || label.includes('Very')) return '#2dd4bf'
  if (label.includes('Reasonable') || label.includes('Moderate')) return '#c9a84c'
  return 'var(--text-secondary)'
}

function confLabel(score: number | undefined): { text: string; color: string } {
  if (score == null) return { text: '—', color: 'var(--text-muted)' }
  if (score >= 70)   return { text: `${Math.round(score)}% Strong`,   color: '#4ade80' }
  if (score >= 60)   return { text: `${Math.round(score)}% Moderate`, color: '#c9a84c' }
  if (score >= 50)   return { text: `${Math.round(score)}% Weak`,     color: '#facc15' }
  return               { text: `${Math.round(score)}% Inverse?`,  color: '#f87171' }
}

function isRangeRule(ruleType: string): boolean {
  return (RANGE_RULE_TYPES as readonly string[]).includes(ruleType)
}

function ruleToCatalogItem(rule: AstroRuleRow): CatalogItem {
  const range = isRangeRule(rule.rule_type)
  return {
    id: `astro_rule:${rule.rule_code}`,
    display_name: rule.display_name,
    description: rule.remarks ?? '',
    block_type: 'astro_rule',
    placement: range ? 'chart_overlay' : 'panel_block',
    overlay_type: range ? 'astro_zone' : undefined,
    data_source: 'rule_engine',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
  }
}

// ── Section ───────────────────────────────────────────────────────────────────

interface AstroRulesSectionProps {
  onSelect?: (item: DeepDiveItem) => void
}

export default function AstroRulesSection({ onSelect }: AstroRulesSectionProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { addBlock, addOverlay, isBlockActive, isOverlayActive } = useFrameworkStore()

  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ['catalog-astro-rules'],
    queryFn: fetchActiveRules,
    staleTime: 5 * 60 * 1000,
  })

  const { data: confMap = {} } = useQuery({
    queryKey: ['catalog-rule-confidence'],
    queryFn: fetchConfidence,
    staleTime: 5 * 60 * 1000,
  })

  function isRuleActive(rule: AstroRuleRow): boolean {
    const id = `astro_rule:${rule.rule_code}`
    return isRangeRule(rule.rule_type) ? isOverlayActive(id) : isBlockActive(id)
  }

  function handleAdd(rule: AstroRuleRow) {
    const item = ruleToCatalogItem(rule)
    if (isRangeRule(rule.rule_type)) {
      addOverlay(item)
    } else {
      addBlock(item)
    }
  }

  const ruleTypes = Array.from(new Set(rules.map(r => r.rule_type))).sort()

  const filtered = rules.filter(r => {
    const matchSearch = !search ||
      r.display_name.toLowerCase().includes(search.toLowerCase()) ||
      r.rule_code.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || r.rule_type === typeFilter
    return matchSearch && matchType
  })

  return (
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
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>km_astro_rule_master</span>.
          Range rules (Transit, State, Conjunct) add as chart overlays. Point rules add as panel blocks.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search rules…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 13px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,106,247,0.4)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
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

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading rules…
        </div>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#f87171', fontSize: 13 }}>
          Could not load rules from database.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No rules match this filter.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Type', 'Rule', 'Outcome', 'Probability', 'Confidence', ''].map(col => (
                <th
                  key={col}
                  style={{
                    padding: '9px 13px',
                    textAlign: 'left',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                    fontWeight: 400,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(rule => {
              const active = isRuleActive(rule)
              const range  = isRangeRule(rule.rule_type)
              const conf   = confLabel(confMap[rule.id])

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
                  })}
                  style={{
                    background: active ? 'rgba(45,212,191,0.03)' : 'transparent',
                    transition: 'background 0.12s',
                    cursor: onSelect ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {/* Type chip */}
                  <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: range ? '#8b7af8' : '#c9a84c',
                      background: range ? 'rgba(124,106,247,0.08)' : 'rgba(201,168,76,0.08)',
                      border: `1px solid ${range ? 'rgba(124,106,247,0.25)' : 'rgba(201,168,76,0.25)'}`,
                      padding: '2px 6px',
                      borderRadius: 3,
                      whiteSpace: 'nowrap',
                    }}>
                      {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                    </span>
                  </td>

                  {/* Rule name + code */}
                  <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {rule.display_name}
                    </div>
                    <div style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      display: 'inline-block',
                    }}>
                      {rule.rule_code}
                    </div>
                  </td>

                  {/* Outcome */}
                  <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                    <span style={{
                      fontSize: 11,
                      color: outcomeColor(rule.outcome || rule.base_bias),
                      whiteSpace: 'nowrap',
                    }}>
                      {outcomeLabel(rule.outcome, rule.base_bias)}
                    </span>
                  </td>

                  {/* Probability */}
                  <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                    <span style={{
                      fontSize: 11,
                      color: probColor(rule.probability_label),
                      fontFamily: 'var(--font-mono, monospace)',
                    }}>
                      {rule.probability_label ?? '—'}
                    </span>
                  </td>

                  {/* Confidence */}
                  <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: conf.color,
                    }}>
                      {conf.text}
                    </span>
                  </td>

                  {/* Action */}
                  <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'right' }}>
                    {active ? (
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono, monospace)',
                        color: '#2dd4bf',
                      }}>
                        ✓ {range ? 'overlay' : 'added'}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(rule)}
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
      )}
    </div>
  )
}
