// Mercury Almanac data — the owner's Excel (Motion / Combust & Rise / Journey)
// productized as three timeline lanes. POA-astro-layer §Phase B.
// Fetches PAST_DAYS back through FUTURE_DAYS ahead — the CALLER clamps
// display through useAstroHorizon() (same client-side gating pattern as the
// chart ribbon; server enforcement is the documented post-launch path).

import { from } from './postgrest'

export const RULE_JOURNEY = 'TRN-MER-MAN-TRN'
export const RULE_MOTION = 'TR-MER-RET'
export const RULE_COMBUST = 'TR-MER-CMB-E-BEA'

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

export async function fetchMercuryAlmanac(): Promise<MercuryAlmanac | null> {
  const today = new Date()
  const since = new Date(today.getTime() - PAST_DAYS * 86400000).toISOString().slice(0, 10)
  const until = new Date(today.getTime() + FUTURE_DAYS * 86400000).toISOString().slice(0, 10)

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
    if (code === RULE_JOURNEY) {
      if (!row.sign) continue
      almanac.journey.push({
        ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
        label: row.sign, isPoint: false,
      })
      almanac.events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: `enters ${row.sign}`, watchDay: true,
      })
    } else if (code === RULE_MOTION) {
      almanac.motion.push({
        ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
        label: 'Retrograde', isPoint: false,
      })
      almanac.events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: 'turns retrograde', watchDay: false,
      })
      almanac.events.push({
        date: row.end_date, ruleCode: code, ruleId: row.rule_id,
        label: 'stations direct', watchDay: false,
      })
    } else if (code === RULE_COMBUST) {
      const stage = row.combustion_type ? ` (${row.combustion_type})` : ''
      almanac.combust.push({
        ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
        label: `Combust${stage}`, isPoint: false,
      })
      almanac.events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: 'enters combust', watchDay: false,
      })
      almanac.events.push({
        date: row.end_date, ruleCode: code, ruleId: row.rule_id,
        label: 'exits combust', watchDay: false,
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
