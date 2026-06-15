import { from } from './postgrest'

export interface AstroBand {
  ruleCode:    string
  displayName: string
  from:        string   // YYYY-MM-DD
  to:          string   // YYYY-MM-DD
  matched:     boolean | null
  color:       string   // user-picked overlay color
}

interface RuleMeta { id: number; rule_code: string; display_name: string; tags: string[] | null }

/** Resolve rule codes → DB ids + display names in one request. */
async function fetchRuleMetaByCode(
  ruleCodes: string[],
): Promise<Map<string, RuleMeta>> {
  if (ruleCodes.length === 0) return new Map()

  const { data, error } = await from('km_astro_rule_master')
    .select('id,rule_code,display_name,tags')
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
 * @param overlayColors  Map of ruleCode → user-picked color
 * @param since          ISO date string — fetch transits ending on or after this date
 */
export async function fetchAstroBands(
  overlayColors: Map<string, string>,
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
    rule_id: number
    start_date: string
    end_date: string
    matched: boolean | null
  }[]) {
    const meta = idToMeta.get(row.rule_id)
    if (!meta) continue
    const isPanchak = (meta.tags ?? []).includes('Panchak')
    const color = overlayColors.get(meta.rule_code)
      ?? (isPanchak ? '#6366f1' : '#c9a84c')
    const displayName = isPanchak
      ? 'Panchak'
      : meta.display_name.replace(/\s+(Bullish|Bearish|Volatile)$/i, '').trim()
    bands.push({
      ruleCode:    meta.rule_code,
      displayName,
      from:        row.start_date,
      to:          row.end_date,
      matched:     row.matched,
      color,
    })
  }

  return bands
}
