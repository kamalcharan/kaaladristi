// OVERLAY ARCHITECTURE:
// Each rule renders its own transit windows independently.
// Rules within the same group (e.g. PNK-*) stack as layers.
// Base rules show all occurrences (PNK-ALL5-BUL = all 549 windows).
// Refinement rules show sub-conditions on top (yoga, vara).
// NEVER redirect one rule_code to another — preserve identity.
// This pattern applies to all future rule groups (Mercury, Venus etc.)

import { from } from './postgrest'

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
}

interface RuleMeta {
  id:           number
  rule_code:    string
  display_name: string
  base_bias:    string | null
  tags:         string[] | null
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
  const ruleCodes = Array.from(overlayColors.keys())
  if (ruleCodes.length === 0) return []

  const codeToMeta = await fetchRuleMetaByCode(ruleCodes)
  const ruleIds    = Array.from(codeToMeta.values()).map(m => m.id)
  if (ruleIds.length === 0) return []

  // Invert map: id → meta
  const idToMeta = new Map<number, RuleMeta>()
  for (const meta of codeToMeta.values()) idToMeta.set(meta.id, meta)

  const { data, error } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,matched')
    .in('rule_id', ruleIds)
    .gte('end_date', since)
    .order('start_date', { ascending: true })
    .execute()

  if (error || !data) return []

  const bands: AstroBand[] = []
  for (const row of data as {
    rule_id:    number
    start_date: string
    end_date:   string
    matched:    boolean | null
  }[]) {
    const meta = idToMeta.get(row.rule_id)
    if (!meta) continue
    const isPanchak   = (meta.tags ?? []).includes('Panchak')
    const tier        = isPanchak ? getPanchakTier(row.rule_id) : undefined
    const color       = overlayColors.get(meta.rule_code)
      ?? (isPanchak ? '#6366f1' : '#c9a84c')
    const opacity     = overlayOpacities.get(meta.rule_code)
      ?? (tier != null ? PANCHAK_DEFAULT_OPACITY[tier] : 0.10)
    const displayName = isPanchak
      ? 'Panchak'
      : meta.display_name.replace(/\s+(Bullish|Bearish|Volatile)$/i, '').trim()
    bands.push({
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
    })
  }

  return bands
}
