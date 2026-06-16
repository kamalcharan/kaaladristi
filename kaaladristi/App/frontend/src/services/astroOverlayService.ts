// OVERLAY ARCHITECTURE:
// Each rule renders its own transit windows independently.
// Rules within the same group (e.g. PNK-*) stack as layers.
// Base rules show all occurrences (PNK-ALL5-BUL = all 549 windows).
// Refinement rules show sub-conditions on top (yoga, vara).
// NEVER redirect one rule_code to another — preserve identity.
// This pattern applies to all future rule groups (Mercury, Venus etc.)

import { from } from './postgrest'
import { RANGE_RULE_TYPES } from '@/constants/frameworkConstants'
import { ASTRO_GROUP_PREFIX } from '@/constants/astroGroupOverlays'

// Panchak tier classification by rule_id
const PANCHAK_BASE_IDS  = [66, 67]
const PANCHAK_YOGA_IDS  = [78, 79, 80]
const PANCHAK_VARA_IDS  = [71, 72, 73, 74, 75, 76, 77]

export type PanchakTier = 'base' | 'yoga' | 'vara'

export function getPanchakTier(ruleId: number): PanchakTier {
  if (PANCHAK_BASE_IDS.includes(ruleId)) return 'base'
  if (PANCHAK_YOGA_IDS.includes(ruleId)) return 'yoga'
  if (PANCHAK_VARA_IDS.includes(ruleId)) return 'vara'
  return 'base'
}

// Default opacities per tier — used when user hasn't set a custom value
export const PANCHAK_DEFAULT_OPACITY: Record<PanchakTier, number> = {
  base: 0.08,
  yoga: 0.12,
  vara: 0.06,
}

export interface AstroBand {
  ruleCode:     string
  ruleId:       number
  displayName:  string
  from:         string         // YYYY-MM-DD
  to:           string         // YYYY-MM-DD
  matched:      boolean | null
  baseBias:     string | null  // 'bullish' | 'bearish' | null
  color:        string         // user-picked or default color
  opacity:      number         // user-picked or tier default (0–1)
  isPanchak:    boolean
  panchakTier?: PanchakTier   // only set when isPanchak = true
  groupTag:     string         // primary tag group — used to merge co-group bands visually
}

interface RuleMeta {
  id:           number
  rule_code:    string
  display_name: string
  base_bias:    string | null
  tags:         string[] | null
  rule_type?:   string | null
}

interface TransitRow {
  rule_id:    number
  start_date: string
  end_date:   string
  matched:    boolean | null
}

/** Mirrors CatalogAstroSection.isRangeRule — only range rules become chart overlays. */
function isRangeRuleRow(r: { rule_type?: string | null; rule_code: string }): boolean {
  const t = r.rule_type ?? ''
  if ((RANGE_RULE_TYPES as readonly string[]).includes(t)) return true
  // Only PNK compound rules are date-range windows; other compounds are panel blocks
  if (t === 'compound' && r.rule_code.startsWith('PNK')) return true
  return false
}

/** Build one AstroBand from a transit row + its rule meta + resolved color/opacity. */
function buildBand(
  row: TransitRow,
  meta: RuleMeta,
  resolvedColor?: string,
  resolvedOpacity?: number,
  groupTagOverride?: string,
): AstroBand {
  const isPanchak = (meta.tags ?? []).includes('Panchak')
  const tier      = isPanchak ? getPanchakTier(row.rule_id) : undefined
  const color     = resolvedColor ?? (isPanchak ? '#6366f1' : '#c9a84c')
  const opacity   = resolvedOpacity ?? (tier != null ? PANCHAK_DEFAULT_OPACITY[tier] : 0.10)
  const displayName = isPanchak
    ? 'Panchak'
    : meta.display_name.replace(/\s+(Bullish|Bearish|Volatile)$/i, '').trim()
  // Group overlays force every band under one tag so they merge into one visual layer
  const groupTag = groupTagOverride ?? (meta.tags ?? [])[0] ?? meta.rule_code.split('-')[0]
  return {
    ruleCode:    meta.rule_code,
    ruleId:      row.rule_id,
    displayName,
    from:        row.start_date,
    to:          row.end_date,
    matched:     row.matched,
    baseBias:    meta.base_bias ?? null,
    color,
    opacity,
    isPanchak,
    panchakTier: tier,
    groupTag,
  }
}

/** Resolve rule codes → DB ids + meta in one request. */
async function fetchRuleMetaByCode(
  ruleCodes: string[],
): Promise<Map<string, RuleMeta>> {
  if (ruleCodes.length === 0) return new Map()

  const { data, error } = await from('km_astro_rule_master')
    .select('id,rule_code,display_name,base_bias,tags')
    .in('rule_code', ruleCodes)
    .execute()

  if (error || !data) return new Map()

  const map = new Map<string, RuleMeta>()
  for (const row of data as RuleMeta[]) {
    map.set(row.rule_code, row)
  }
  return map
}

/**
 * Fetch all transit windows for the given rules that overlap the chart's
 * 1Y window. Returns AstroBand[] ready to pass to TradingChart.
 *
 * @param overlayColors    Map of ruleCode → user-picked hex color
 * @param overlayOpacities Map of ruleCode → user-picked opacity (0–1)
 * @param since            ISO date string — fetch transits ending on or after this date
 */
export async function fetchAstroBands(
  overlayColors:    Map<string, string>,
  overlayOpacities: Map<string, number>,
  since: string,
): Promise<AstroBand[]> {
  const allKeys = Array.from(overlayColors.keys())
  if (allKeys.length === 0) return []

  // Group overlays (astro_group:<Tag>) expand to all range rules carrying the tag.
  // Individual rule overlays (astro_rule:<CODE> → stored as <CODE>) resolve directly.
  const groupKeys = allKeys.filter(k => k.startsWith(ASTRO_GROUP_PREFIX))
  const ruleCodes = allKeys.filter(k => !k.startsWith(ASTRO_GROUP_PREFIX))

  const bands: AstroBand[] = []

  if (ruleCodes.length > 0) {
    bands.push(...await fetchRuleBands(ruleCodes, overlayColors, overlayOpacities, since))
  }
  for (const groupKey of groupKeys) {
    bands.push(...await fetchGroupBands(groupKey, overlayColors, overlayOpacities, since))
  }

  return bands
}

/** Resolve individual rule_code overlays → bands (one band per transit window). */
async function fetchRuleBands(
  ruleCodes:        string[],
  overlayColors:    Map<string, string>,
  overlayOpacities: Map<string, number>,
  since: string,
): Promise<AstroBand[]> {
  const codeToMeta = await fetchRuleMetaByCode(ruleCodes)
  const ruleIds    = Array.from(codeToMeta.values()).map(m => m.id)

  if (import.meta.env.DEV) {
    const unresolved = ruleCodes.filter(c => !codeToMeta.has(c))
    console.groupCollapsed(`[astroBands] resolving ${ruleCodes.length} overlay rule(s)`)
    console.log('requested rule_codes:', ruleCodes)
    console.log('resolved code → rule_id:', Object.fromEntries(
      Array.from(codeToMeta.entries()).map(([c, m]) => [c, m.id]),
    ))
    if (unresolved.length > 0) {
      console.warn('UNRESOLVED rule_codes (not in km_astro_rule_master, or not catalog_visible):', unresolved)
    }
    console.log('km_rule_transits filter: end_date >=', since)
    console.groupEnd()
  }

  if (ruleIds.length === 0) return []

  const idToMeta = new Map<number, RuleMeta>()
  for (const meta of codeToMeta.values()) idToMeta.set(meta.id, meta)

  const { data, error } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,matched')
    .in('rule_id', ruleIds)
    .gte('end_date', since)
    .order('start_date', { ascending: true })
    .execute()

  if (error || !data) {
    if (import.meta.env.DEV) console.warn('[astroBands] km_rule_transits query failed:', error)
    return []
  }

  if (import.meta.env.DEV) {
    const rows = data as { rule_id: number }[]
    const perRule: Record<number, number> = {}
    for (const r of rows) perRule[r.rule_id] = (perRule[r.rule_id] ?? 0) + 1
    console.log(
      `[astroBands] km_rule_transits → ${rows.length} row(s) for ${ruleIds.length} rule(s); per rule_id:`,
      perRule,
    )
    const empty = ruleIds.filter(id => !(id in perRule))
    if (empty.length > 0) {
      console.warn(
        '[astroBands] rule_ids with ZERO transit rows in window (run generate_*_windows.py, ' +
        'or no window falls after end_date filter):', empty,
      )
    }
  }

  const bands: AstroBand[] = []
  for (const row of data as TransitRow[]) {
    const meta = idToMeta.get(row.rule_id)
    if (!meta) continue
    bands.push(buildBand(
      row, meta,
      overlayColors.get(meta.rule_code),
      overlayOpacities.get(meta.rule_code),
    ))
  }
  return bands
}

/**
 * Expand a single group overlay (astro_group:<Tag>) into bands for EVERY range
 * rule carrying that tag. All bands share the group's color and merge under the
 * tag, so the chart shows one cohesive overlay layer.
 */
async function fetchGroupBands(
  groupKey:         string,
  overlayColors:    Map<string, string>,
  overlayOpacities: Map<string, number>,
  since: string,
): Promise<AstroBand[]> {
  const tag          = groupKey.slice(ASTRO_GROUP_PREFIX.length)
  const groupColor   = overlayColors.get(groupKey)
  const groupOpacity = overlayOpacities.get(groupKey)

  // Step 1 — all catalog-visible rules carrying this tag
  const { data: ruleRows, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code,display_name,base_bias,rule_type,tags')
    .contains('tags', [tag])
    .eq('catalog_visible', 'true')
    .is('is_deleted', 'false')
    .execute()

  if (rErr || !ruleRows) {
    if (import.meta.env.DEV) console.warn(`[astroBands] group "${tag}" rule query failed:`, rErr)
    return []
  }

  // Keep only range rules — point/panel-block rules are not overlays
  const rangeRules = (ruleRows as RuleMeta[]).filter(isRangeRuleRow)

  if (import.meta.env.DEV) {
    console.log(
      `[astroBands] group "${tag}": ${(ruleRows as unknown[]).length} tagged rule(s) → ` +
      `${rangeRules.length} range overlay rule(s)`,
    )
  }
  if (rangeRules.length === 0) return []

  const idToMeta = new Map<number, RuleMeta>()
  for (const r of rangeRules) idToMeta.set(r.id, r)
  const ruleIds = rangeRules.map(r => r.id)

  // Step 2 — transit windows for those rules
  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,matched')
    .in('rule_id', ruleIds)
    .gte('end_date', since)
    .order('start_date', { ascending: true })
    .execute()

  if (tErr || !transits) {
    if (import.meta.env.DEV) console.warn(`[astroBands] group "${tag}" transit query failed:`, tErr)
    return []
  }

  if (import.meta.env.DEV) {
    console.log(`[astroBands] group "${tag}": ${(transits as unknown[]).length} transit window(s) since ${since}`)
  }

  // Step 3 — bands, all sharing the group color + merging under the tag
  const bands: AstroBand[] = []
  for (const row of transits as TransitRow[]) {
    const meta = idToMeta.get(row.rule_id)
    if (!meta) continue
    bands.push(buildBand(row, meta, groupColor, groupOpacity, tag))
  }
  return bands
}
