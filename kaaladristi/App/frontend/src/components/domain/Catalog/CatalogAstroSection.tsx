import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, AlertCircle, Database } from 'lucide-react'
import { fetchCatalogRules, fetchConfidence, fetchTransitDates, type AstroRule, type TransitDateInfo } from '@/pages/RuleEngine/ruleService'
import { OutcomeBadge, TypeChip, ConfidenceCell, RULE_TYPE_LABELS, PROB_STYLES, fmtTransitDate } from '@/pages/RuleEngine/RuleList'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAuthStore } from '@/stores/authStore'
import { RANGE_RULE_TYPES, PAID_TIERS } from '@/constants/frameworkConstants'
import { cn } from '@/lib/utils'
import InlineGate from '@/components/workspace/InlineGate'
import { useToast, ToastContainer } from '@/components/ui'
import type { CatalogItem } from '@/constants/catalogItems'
import { ASTRO_GROUP_OVERLAYS, LAUNCH_ACTIVE_GROUP_TAGS, type AstroGroupOverlay } from '@/constants/astroGroupOverlays'
import type { DeepDiveItem } from './DeepDivePanel'
import { TagChip, RULE_TAG_COLORS, tagHue } from '@/constants/ruleTagColors'

const ASTRO_PALETTE = [
  '#6366f1', 'var(--accent)', 'var(--bull)', 'var(--bull)',
  'var(--bear)', 'var(--caution)', '#e879f9', '#ffffff',
]

// Default overlay color per group tag
const GROUP_DEFAULT_COLORS: Record<string, string> = {
  Panchak:    '#6366f1',
  Mercury:    '#3b82f6',
  Retrograde: 'var(--caution)',
  Conjunction:'#a855f7',
  Nakshatra:  'var(--bull)',
  Eclipse:    'var(--bear)',
  Yoga:       'var(--bull)',
  Transit:    '#fb7185',
}

function getGroupDefaultColor(tag: string): string {
  return GROUP_DEFAULT_COLORS[tag] ?? '#6366f1'
}

/** Color dot + opacity popover attached to a tag chip. */
function TagColorControl({
  tag, color, opacity, onColorChange, onOpacityChange,
}: {
  tag: string
  color: string
  opacity: number
  onColorChange: (c: string) => void
  onOpacityChange: (o: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      <button
        title={`${tag} overlay color & opacity`}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          width: 10, height: 10, borderRadius: 2, flexShrink: 0,
          background: color, border: '1px solid color-mix(in srgb, var(--text-primary) 25%, transparent)',
          cursor: 'pointer', marginLeft: 5,
        }}
      />
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 18, left: 0, zIndex: 500,
            background: 'var(--card, #1a1a2e)',
            border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
            borderRadius: 8, padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            width: 150,
          }}
        >
          <div style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', marginBottom: 6,
            fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {tag} color
          </div>
          {/* Swatches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginBottom: 8 }}>
            {ASTRO_PALETTE.map(s => (
              <button
                key={s}
                onClick={() => onColorChange(s)}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: s, cursor: 'pointer', border: 'none',
                  outline: s === color ? '2px solid color-mix(in srgb, var(--text-primary) 80%, transparent)' : '2px solid transparent',
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>
          {/* Opacity slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)',
                fontFamily: 'var(--font-mono, monospace)' }}>opacity</span>
              <span style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 60%, transparent)',
                fontFamily: 'var(--font-mono, monospace)' }}>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range" min={1} max={30} step={1}
              value={Math.round(opacity * 100)}
              onChange={e => onOpacityChange(Number(e.target.value) / 100)}
              style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** Primary group tag for a rule — drives shared color/opacity. */
function getGroupTag(rule: AstroRule): string {
  const tags = rule.tags ?? []
  for (const tag of tags) {
    if (tag in GROUP_DEFAULT_COLORS || tag in RULE_TAG_COLORS) return tag
  }
  return tags[0] ?? rule.rule_code.split('-')[0]
}

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

// Base rule that must always be added first when a sub-rule is added.
// Each group's base rule covers all windows; sub-rules layer on top.
const BASE_RULE_MAP: Record<string, string> = {
  PNK: 'astro_rule:PNK-ALL5-BUL',
  // Future groups:
  // MER: 'astro_rule:MER-ALL-BASE',
  // VEN: 'astro_rule:VEN-ALL-BASE',
}
const BASE_RULE_CODES = ['PNK-ALL5-BUL', 'PNK-ALL5-BEA']

function ruleToCatalogItem(rule: AstroRule): CatalogItem {
  const range     = isRangeRule(rule)
  const isPanchak = (rule.tags ?? []).includes('Panchak')
  return {
    id:           `astro_rule:${rule.rule_code}`,
    display_name: range ? overlayLabel(rule) : rule.display_name,
    description:  rule.remarks ?? '',
    block_type:   'astro_rule',
    placement:    range ? 'chart_overlay' : 'panel_block',
    overlay_type: range ? 'astro_zone' : undefined,
    color:        range ? getGroupDefaultColor(getGroupTag(rule)) : undefined,
    data_source:  'rule_engine',
    applicable_to: ['index'],   // astro is index-only (owner 2026-07-22)
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

  const { addBlock, addOverlay, isBlockActive, isOverlayActive, updateOverlayColor, updateOverlayOpacity } = useFrameworkStore()
  const [gateOpen, setGateOpen] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  // Per-group-tag color/opacity — keyed by group tag (e.g. 'Panchak', 'Mercury')
  const [tagColors, setTagColors]       = useState<Record<string, string>>({})
  const [tagOpacities, setTagOpacities] = useState<Record<string, number>>({})
  // Group-overlay color/opacity — keyed by group id (e.g. 'astro_group:Mercury')
  const [groupColors, setGroupColors]       = useState<Record<string, string>>({})
  const [groupOpacities, setGroupOpacities] = useState<Record<string, number>>({})

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

  const { data: transitDates = [] } = useQuery({
    queryKey: ['rule-engine', 'transit-dates'],
    queryFn: fetchTransitDates,
    staleTime: 5 * 60 * 1000,
  })

  const confMap = useMemo(() => {
    const m = new Map<number, number | null>()
    for (const c of confidence) m.set(c.rule_id, c.confidence_score)
    return m
  }, [confidence])

  const transitMap = useMemo(() => {
    const m = new Map<number, TransitDateInfo>()
    for (const t of transitDates) m.set(t.rule_id, t)
    return m
  }, [transitDates])

  const framework = useFrameworkStore(s => s.framework)

  /** Effective color: framework store → group tag state → group default. */
  function getEffectiveColor(rule: AstroRule): string {
    const id = `astro_rule:${rule.rule_code}`
    const stored = framework?.chart_overlays.find(o => o.catalog_item_id === id)
    const group = getGroupTag(rule)
    return stored?.color ?? tagColors[group] ?? getGroupDefaultColor(group)
  }

  /** Effective opacity: framework store → group tag state → 0.08. */
  function getEffectiveOpacity(rule: AstroRule): number {
    const id = `astro_rule:${rule.rule_code}`
    const stored = framework?.chart_overlays.find(o => o.catalog_item_id === id)
    const group = getGroupTag(rule)
    return stored?.opacity ?? tagOpacities[group] ?? 0.08
  }

  /** Get the effective group color (for tag chip display). */
  function getTagColor(groupTag: string): string {
    // Check if any active overlay in this group has a stored color
    const activeOverlay = framework?.chart_overlays.find(o => {
      const code = o.catalog_item_id.replace('astro_rule:', '')
      const rule = rules.find(r => r.rule_code === code)
      return rule && getGroupTag(rule) === groupTag
    })
    return activeOverlay?.color ?? tagColors[groupTag] ?? getGroupDefaultColor(groupTag)
  }

  /** Get the effective group opacity (for tag chip display). */
  function getTagOpacity(groupTag: string): number {
    const activeOverlay = framework?.chart_overlays.find(o => {
      const code = o.catalog_item_id.replace('astro_rule:', '')
      const rule = rules.find(r => r.rule_code === code)
      return rule && getGroupTag(rule) === groupTag
    })
    return activeOverlay?.opacity ?? tagOpacities[groupTag] ?? 0.08
  }


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

    // Auto-add base layer silently when adding a sub-rule (yoga/vara)
    if (isRangeRule(rule) && !BASE_RULE_CODES.includes(rule.rule_code)) {
      const prefix     = rule.rule_code.split('-')[0]
      const baseItemId = BASE_RULE_MAP[prefix]
      if (baseItemId) {
        const alreadyHasBase = framework?.chart_overlays.some(
          o => o.catalog_item_id === baseItemId,
        ) ?? false
        if (!alreadyHasBase) {
          const baseRule = rules.find(
            r => r.rule_code === baseItemId.replace('astro_rule:', ''),
          )
          if (baseRule) {
            const baseGroup = getGroupTag(baseRule)
            addOverlay(ruleToCatalogItem(baseRule), tagColors[baseGroup] ?? getGroupDefaultColor(baseGroup))
          }
        }
      }
    }

    const group = getGroupTag(rule)
    const pickedColor = isRangeRule(rule) ? (tagColors[group] ?? getGroupDefaultColor(group)) : undefined
    const item = ruleToCatalogItem(rule)
    if (isRangeRule(rule)) {
      addOverlay(item, pickedColor)
    } else {
      addBlock(item)
    }
  }

  /** Update color for the entire group — all active overlays in the group get the new color. */
  function handleTagColorChange(groupTag: string, color: string) {
    setTagColors(prev => ({ ...prev, [groupTag]: color }))
    for (const r of rules) {
      if (!isRangeRule(r) || getGroupTag(r) !== groupTag) continue
      const id = `astro_rule:${r.rule_code}`
      if (isOverlayActive(id)) updateOverlayColor(id, color)
    }
  }

  /** Update opacity for the entire group. */
  function handleTagOpacityChange(groupTag: string, opacity: number) {
    setTagOpacities(prev => ({ ...prev, [groupTag]: opacity }))
    for (const r of rules) {
      if (!isRangeRule(r) || getGroupTag(r) !== groupTag) continue
      const id = `astro_rule:${r.rule_code}`
      if (isOverlayActive(id)) updateOverlayOpacity(id, opacity)
    }
  }

  /**
   * Add ONE virtual group overlay (astro_group:<Tag>). At render time the
   * overlay service expands it into every range rule carrying the tag, drawn as
   * a single merged layer — so the workspace shows one pill, not N.
   */
  function handleAddGroupOverlay(group: AstroGroupOverlay, e: React.MouseEvent) {
    e.stopPropagation()
    const tier = useAuthStore.getState().profile?.tier ?? 'free'
    if (!PAID_TIERS.includes(tier as typeof PAID_TIERS[number])) {
      setGateOpen(true)
      return
    }
    if (isOverlayActive(group.id)) return
    addOverlay(group, groupColors[group.id] ?? group.color)
    toast('success', `Added ${group.display_name} overlay to framework`)
  }

  /** Effective color for a group pill: live overlay → local pick → default. */
  function groupEffectiveColor(group: AstroGroupOverlay): string {
    const stored = framework?.chart_overlays.find(o => o.catalog_item_id === group.id)
    return stored?.color ?? groupColors[group.id] ?? group.color ?? '#6366f1'
  }

  /** Effective opacity for a group pill: live overlay → local pick → 0.10. */
  function groupEffectiveOpacity(group: AstroGroupOverlay): number {
    const stored = framework?.chart_overlays.find(o => o.catalog_item_id === group.id)
    return stored?.opacity ?? groupOpacities[group.id] ?? 0.10
  }

  /** Change a group overlay's color — updates the live overlay if already added. */
  function handleGroupColorChange(group: AstroGroupOverlay, color: string) {
    setGroupColors(prev => ({ ...prev, [group.id]: color }))
    if (isOverlayActive(group.id)) updateOverlayColor(group.id, color)
  }

  /** Change a group overlay's opacity — updates the live overlay if already added. */
  function handleGroupOpacityChange(group: AstroGroupOverlay, opacity: number) {
    setGroupOpacities(prev => ({ ...prev, [group.id]: opacity }))
    if (isOverlayActive(group.id)) updateOverlayOpacity(group.id, opacity)
  }

  const ruleTypes = useMemo(
    () => Array.from(new Set(rules.map(r => r.rule_type))).sort(),
    [rules],
  )

  const allTags = useMemo(
    () => Array.from(new Set(rules.flatMap(r => r.tags ?? []))).sort(),
    [rules],
  )

  // Total rule count per tag — drives the consistent count badge on every chip
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const rule of rules) {
      for (const tag of rule.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1
    }
    return counts
  }, [rules])

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
              background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 40%, transparent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
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

      {/* Group Overlays — one pill adds an entire tag's range rules as a single overlay layer */}
      <div style={{ marginBottom: 16 }}>
        <p style={{
          fontSize: 9, color: 'var(--text-muted)', marginBottom: 8,
          fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Group Overlays
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ASTRO_GROUP_OVERLAYS
            .filter(group => LAUNCH_ACTIVE_GROUP_TAGS.includes(group.tag) && allTags.includes(group.tag))
            .map(group => {
            const added = isOverlayActive(group.id)
            return (
              <div
                key={group.id}
                title={group.description}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px 4px 8px', borderRadius: 8,
                  border: `1px solid ${added ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)'}`,
                  background: added ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                  transition: 'all 0.15s',
                }}
              >
                {/* Color/opacity control — click the dot to recolour the group overlay */}
                <TagColorControl
                  tag={group.display_name}
                  color={groupEffectiveColor(group)}
                  opacity={groupEffectiveOpacity(group)}
                  onColorChange={c => handleGroupColorChange(group, c)}
                  onOpacityChange={o => handleGroupOpacityChange(group, o)}
                />
                <button
                  onClick={e => handleAddGroupOverlay(group, e)}
                  disabled={added}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: 'none', background: 'transparent', padding: '2px 2px 2px 4px',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    cursor: added ? 'default' : 'pointer',
                    color: added ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {group.display_name}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {added ? '✓' : '+'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{
            fontSize: 9, color: 'var(--text-muted)', marginBottom: 8,
            fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Filter by tag
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            onClick={() => setActiveTags([])}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              cursor: 'pointer',
              border: `1px solid ${activeTags.length === 0 ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)'}`,
              background: activeTags.length === 0 ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
              color: activeTags.length === 0 ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            All
          </button>
          {allTags.map(tag => {
            const active = activeTags.includes(tag)
            const hue = tagHue(tag)
            const count = tagCounts[tag] ?? 0
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border transition-all cursor-pointer"
                style={{
                  fontFamily: 'inherit',
                  background: active
                    ? `color-mix(in srgb, ${hue} 14%, transparent)`
                    : 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
                  borderColor: active
                    ? `color-mix(in srgb, ${hue} 35%, transparent)`
                    : 'var(--border)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6, height: 6, borderRadius: '50%', background: hue,
                    flexShrink: 0, display: 'inline-block', opacity: active ? 1 : 0.55,
                  }}
                />
                {tag}
                <span style={{
                  fontSize: 10, lineHeight: 1, padding: '2px 5px', borderRadius: 999,
                  background: active
                    ? `color-mix(in srgb, ${hue} 22%, transparent)`
                    : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Loading rules…
        </div>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--bear)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertCircle style={{ width: 16, height: 16 }} /> Could not load rules from database.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Database style={{ width: 16, height: 16, opacity: 0.4 }} />
          {rules.length === 0 ? 'No rules in database' : 'No rules match this filter.'}
        </div>
      ) : (
        <div style={{
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
          overflowX: compact ? 'visible' : 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
                {(compact
                  ? ['Rule', 'Type', 'Tags', '']
                  : ['Code', 'Rule', 'Type', 'Outcome', 'Probability', 'Confidence', 'Last', 'Next', 'Tags', '']
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
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
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
                      background: active ? 'color-mix(in srgb, var(--bull) 5%, transparent)' : undefined,
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--text-primary) 2.5%, transparent)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = active ? 'color-mix(in srgb, var(--bull) 5%, transparent)' : i % 2 === 0 ? '' : 'color-mix(in srgb, var(--text-primary) 1%, transparent)'
                    }}
                  >
                    {/* Code — full catalog only */}
                    {!compact && (
                      <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 11,
                          color: 'var(--accent)',
                          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
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
                            color: 'color-mix(in srgb, var(--accent) 60%, transparent)',
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

                    {/* Last transit — full catalog only */}
                    {!compact && (
                      <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                          {fmtTransitDate(transitMap.get(rule.id)?.last_end)}
                        </span>
                      </td>
                    )}

                    {/* Next transit — full catalog only */}
                    {!compact && (() => {
                      const next = transitMap.get(rule.id)?.next_start
                      const daysAway = next
                        ? Math.round((new Date(next).getTime() - Date.now()) / 86400000)
                        : null
                      const urgent = daysAway !== null && daysAway <= 14
                      return (
                        <td style={{ padding: '10px 13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-mono, monospace)',
                            color: urgent ? 'var(--risk-amber, var(--caution))' : next ? 'var(--text-secondary)' : 'var(--text-muted)',
                          }}>
                            {fmtTransitDate(next)}
                            {urgent && daysAway !== null && (
                              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({daysAway}d)</span>
                            )}
                          </span>
                        </td>
                      )
                    })()}

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
                    <td style={{ padding: '10px 13px', verticalAlign: 'middle', textAlign: 'right', minWidth: 110 }}>
                      {/* Tiny group-color indicator dot (no popover — control is on the tag chip) */}
                      {range && active && (
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                          background: getEffectiveColor(rule),
                          marginRight: 6, verticalAlign: 'middle', opacity: 0.8,
                        }} />
                      )}
                      {active ? (
                        <span style={{
                          fontSize: 11,
                          fontFamily: 'var(--font-mono, monospace)',
                          color: 'var(--bull)',
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
                            border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                            color: 'var(--accent)',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'color-mix(in srgb, var(--accent) 16%, transparent)'
                            el.style.borderColor = 'color-mix(in srgb, var(--accent) 55%, transparent)'
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'
                            el.style.borderColor = 'color-mix(in srgb, var(--accent) 35%, transparent)'
                          }}
                        >
                          + {range ? 'Overlay' : 'Add'}
                        </button>
                      )}
                      {/* Hint: sub-rules auto-add the base layer */}
                      {!active && isRangeRule(rule) &&
                        !BASE_RULE_CODES.includes(rule.rule_code) &&
                        BASE_RULE_MAP[rule.rule_code.split('-')[0]] && (
                        <p style={{
                          fontSize: 10, color: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                          margin: '2px 0 0', textAlign: 'center',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}>
                          + adds Panchak base
                        </p>
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
    <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
