// Golārambha Almanac data — the Sun's hemisphere story as timeline lanes.
// Two gola halves (Uttara: March→September equinox, Dakshina: September→
// March) + the ±1-day golārambha turn windows at each seam. Windows are
// generator-fed from Swiss Ephemeris (generate_golarambh_windows.py,
// migration 166) — TROPICAL crossings, deliberately independent of the
// sidereal sankranti dates in km_daily_panchang.
//
// Same fetch contract as mercuryAlmanac: whatever [since, until] the caller
// asks for; future-edge gating happens at display time via useAstroHorizon().

import { from } from './postgrest'
import type { LaneSegment } from './mercuryAlmanac'

export const RULE_UGOLA = 'TR-SUN-UGOLA-BUL'
export const RULE_DGOLA = 'TR-SUN-DGOLA-BEA'
export const RULE_UWIN = 'TRN-SUN-UGOLARM-TRN'
export const RULE_DWIN = 'TRN-SUN-DGOLARM-TRN'

const ALL_CODES = [RULE_UGOLA, RULE_DGOLA, RULE_UWIN, RULE_DWIN]

export interface GolaAlmanac {
  uttara: LaneSegment[]     // Sun-north halves
  dakshina: LaneSegment[]   // Sun-south halves
  windows: LaneSegment[]    // ±1 day turn windows, both seams, sorted asc
}

interface TransitRow {
  rule_id: number
  start_date: string
  end_date: string
  direction: string | null
}

export async function fetchGolaAlmanac(since: string, until: string): Promise<GolaAlmanac | null> {
  const { data: rules, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code')
    .in('rule_code', ALL_CODES)
    .execute()
  if (rErr || !rules) return null
  const idToCode = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.id, r.rule_code]))
  if (idToCode.size === 0) return null

  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,direction')
    .in('rule_id', [...idToCode.keys()])
    .gte('end_date', since)
    .lte('start_date', until)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  const almanac: GolaAlmanac = { uttara: [], dakshina: [], windows: [] }
  for (const row of transits as TransitRow[]) {
    const code = idToCode.get(row.rule_id)
    if (!code) continue
    const seg: LaneSegment = {
      ruleCode: code, ruleId: row.rule_id,
      from: row.start_date, to: row.end_date,
      label: '', isPoint: false,
    }
    if (code === RULE_UGOLA) {
      seg.label = 'Uttara Gola'
      almanac.uttara.push(seg)
    } else if (code === RULE_DGOLA) {
      seg.label = 'Dakshina Gola'
      almanac.dakshina.push(seg)
    } else {
      seg.label = code === RULE_UWIN ? 'Basanta Golārambha' : 'Dakshina Golārambha'
      almanac.windows.push(seg)
    }
  }
  return almanac
}
