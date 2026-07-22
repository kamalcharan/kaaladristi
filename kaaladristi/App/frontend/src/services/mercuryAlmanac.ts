// Mercury Almanac data — the owner's Excel (Motion / Combust & Rise / Journey)
// productized as three timeline lanes. POA-astro-layer §Phase B.
// Fetches whatever [since, until] range the caller asks for — the Almanac
// page's Live/Month/Year nav picks the range; history is unrestricted for
// every tier (owner-confirmed), only the FUTURE edge is clamped, and that
// clamp happens at display time via useAstroHorizon() (same client-side
// gating pattern as the chart ribbon; server enforcement is the documented
// post-launch path), not in this fetch.

import { from } from './postgrest'

export const RULE_JOURNEY = 'TRN-MER-MAN-TRN'
export const RULE_MOTION = 'TR-MER-RET'
export const RULE_COMBUST = 'TR-MER-CMB-E-BEA'

// Default "Live" view window — today-60d back through today+90d ahead.
export const PAST_DAYS = 60
export const FUTURE_DAYS = 90

export interface LaneSegment {
  ruleCode: string
  ruleId: number
  from: string          // YYYY-MM-DD
  to: string             // YYYY-MM-DD
  label: string          // "Gemini" / "Retrograde" / "Combust (ghora)"
  isPoint: boolean
}

export interface AlmanacEvent {
  date: string
  ruleCode: string
  ruleId: number
  label: string           // "enters Leo" / "stations direct" / "enters combust"
  watchDay: boolean       // sign-ingress only, per confirmed evidence
  boundary: 'start' | 'end'  // which edge of the underlying window this date is
  days: number            // total length of the window (end_date - start_date), same "TOTAL NO. OF DAYS" the owner's sheet carries
}

export interface MercuryAlmanac {
  journey: LaneSegment[]
  motion: LaneSegment[]     // retrograde windows only; direct = the gaps
  combust: LaneSegment[]
  events: AlmanacEvent[]    // sorted asc, boundary days only
}

interface TransitRow {
  rule_id: number
  start_date: string
  end_date: string
  sign: string | null
  combustion_type: string | null
  start_ts: string | null
  end_ts: string | null
}

function daysBetweenDates(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

export async function fetchMercuryAlmanac(since: string, until: string): Promise<MercuryAlmanac | null> {
  const { data: rules, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code')
    .in('rule_code', [RULE_JOURNEY, RULE_MOTION, RULE_COMBUST])
    .execute()
  if (rErr || !rules) return null
  const idToCode = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.id, r.rule_code]))
  if (idToCode.size === 0) return null

  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,sign,combustion_type,start_ts,end_ts')
    .in('rule_id', [...idToCode.keys()])
    .gte('end_date', since)
    .lte('start_date', until)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  const almanac: MercuryAlmanac = { journey: [], motion: [], combust: [], events: [] }

  for (const row of transits as TransitRow[]) {
    const code = idToCode.get(row.rule_id)
    const days = daysBetweenDates(row.start_date, row.end_date)
    if (code === RULE_JOURNEY) {
      if (!row.sign) continue
      almanac.journey.push({
        ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
        label: row.sign, isPoint: false,
      })
      almanac.events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: `enters ${row.sign}`, watchDay: true, boundary: 'start', days,
      })
    } else if (code === RULE_MOTION) {
      almanac.motion.push({
        ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
        label: 'Retrograde', isPoint: false,
      })
      almanac.events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: 'turns retrograde', watchDay: false, boundary: 'start', days,
      })
      almanac.events.push({
        date: row.end_date, ruleCode: code, ruleId: row.rule_id,
        label: 'stations direct', watchDay: false, boundary: 'end', days,
      })
    } else if (code === RULE_COMBUST) {
      const stage = row.combustion_type ? ` (${row.combustion_type})` : ''
      almanac.combust.push({
        ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
        label: `Combust${stage}`, isPoint: false,
      })
      almanac.events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: `enters combust${stage}`, watchDay: false, boundary: 'start', days,
      })
      almanac.events.push({
        date: row.end_date, ruleCode: code, ruleId: row.rule_id,
        label: `exits combust${stage}`, watchDay: false, boundary: 'end', days,
      })
    }
  }

  // De-dup + sort event list (motion end === next-day start etc. are fine as
  // separate rows; only exact same date+label+rule collapses).
  const seen = new Set<string>()
  almanac.events = almanac.events
    .filter(e => {
      const k = `${e.date}|${e.ruleCode}|${e.label}`
      if (seen.has(k)) return false
      seen.add(k); return true
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return almanac
}
