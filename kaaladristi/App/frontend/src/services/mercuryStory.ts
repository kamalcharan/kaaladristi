// Mercury story state for the chart ribbon (POA-astro-layer §Phase A).
// One fetch answers: where is Mercury NOW (sign / motion / combust), and what
// happens NEXT. Always fetches the full 90-day forward window — the CALLER
// clamps display through useAstroHorizon() (client-side gating, consistent
// with every existing tier gate; server enforcement is the post-launch path).

import { from } from './postgrest'

const RULE_JOURNEY = 'TRN-MER-MAN-TRN'
const RULE_MOTION = 'TR-MER-RET'
const RULE_COMBUST = 'TR-MER-CMB-E-BEA'
const STORY_RULES = [RULE_JOURNEY, RULE_MOTION, RULE_COMBUST]

export interface MercuryEvent {
  date: string      // YYYY-MM-DD
  label: string     // "enters Leo" / "turns retrograde" / "exits combust"
  /** True ONLY for sign-ingress days — the sole family confirmed against
   *  km_rule_evidence (56.1% flip vs 48.9% base, clears the +/-5pt honesty
   *  threshold). Motion (retrograde/station) and combust boundaries measure
   *  within that threshold — ordinary days — so they render as orientation,
   *  never the WATCH framing, matching ruleInterpretation.ts's per-boundary
   *  gate. Checked live 2026-07-22; revisit only on an evidence refresh. */
  watchDay: boolean
}

export interface MercuryStory {
  sign: string | null
  motion: 'direct' | 'retrograde'
  combustUntil: string | null      // end date of the active combust window
  combustStage: string | null      // ghora / … (deepest-separation stage)
  upcoming: MercuryEvent[]         // sorted asc, full 90 days — caller clamps
  /** The READINESS state (owner's core use case: "signal tells me in advance
   *  — event is coming, be ready; it's not bull or bear, it's readiness").
   *  Set when a watch-day event (ingress/station) falls within its ±2-day
   *  orb of today — the zone where the prev-day H/L break is the reference. */
  watchZone: { label: string; date: string; until: string } | null
}

interface TransitRow {
  rule_id: number
  start_date: string
  end_date: string
  sign: string | null
  combustion_type: string | null
}

export async function fetchMercuryStory(): Promise<MercuryStory | null> {
  const today = new Date().toISOString().slice(0, 10)
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
  // Fetch back 2 extra days so a watch-day that just happened still opens
  // its ±2-day readiness zone (e.g. yesterday's ingress).
  const back2 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)

  const { data: rules, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code')
    .in('rule_code', STORY_RULES)
    .execute()
  if (rErr || !rules) return null
  const idToCode = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.id, r.rule_code]))
  if (idToCode.size === 0) return null

  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,sign,combustion_type')
    .in('rule_id', [...idToCode.keys()])
    .gte('end_date', back2)
    .lte('start_date', in90)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  const story: MercuryStory = {
    sign: null, motion: 'direct', combustUntil: null, combustStage: null,
    upcoming: [], watchZone: null,
  }
  // Every watch-day event (past-2d through +90d) — the readiness zone picks
  // the nearest one inside its ±2-day orb.
  const watchEvents: { date: string; label: string }[] = []

  for (const row of transits as TransitRow[]) {
    const code = idToCode.get(row.rule_id)
    const active = row.start_date <= today && row.end_date >= today
    if (code === RULE_JOURNEY) {
      if (active) {
        story.sign = row.sign
        if (row.sign) watchEvents.push({ date: row.start_date, label: `enters ${row.sign}` })
      } else if (row.start_date > today && row.sign) {
        story.upcoming.push({ date: row.start_date, label: `enters ${row.sign}`, watchDay: true })
        watchEvents.push({ date: row.start_date, label: `enters ${row.sign}` })
      }
    } else if (code === RULE_MOTION) {
      // Motion boundaries are orientation only — not a confirmed watch day
      // (TR-MER-RET start/end sit at 50.9%/47.1% vs a 48.9% base, inside
      // the honesty threshold). Never added to watchEvents.
      if (active) {
        story.motion = 'retrograde'
        if (row.end_date >= today) {
          story.upcoming.push({ date: row.end_date, label: 'stations direct', watchDay: false })
        }
      } else if (row.start_date > today) {
        story.upcoming.push({ date: row.start_date, label: 'turns retrograde', watchDay: false })
      }
    } else if (code === RULE_COMBUST) {
      if (active) {
        story.combustUntil = row.end_date
        story.combustStage = row.combustion_type
        story.upcoming.push({ date: row.end_date, label: 'exits combust', watchDay: false })
      } else if (row.start_date > today) {
        story.upcoming.push({ date: row.start_date, label: 'enters combust', watchDay: false })
      }
    }
  }

  // Readiness zone: nearest watch-day whose ±2-day orb contains today.
  const todayMs = new Date(`${today}T00:00:00Z`).getTime()
  let best: { label: string; date: string; until: string } | null = null
  let bestDist = Infinity
  for (const ev of watchEvents) {
    const dist = Math.round((new Date(`${ev.date}T00:00:00Z`).getTime() - todayMs) / 86400000)
    if (Math.abs(dist) <= 2 && Math.abs(dist) < bestDist) {
      const until = new Date(new Date(`${ev.date}T00:00:00Z`).getTime() + 2 * 86400000)
        .toISOString().slice(0, 10)
      best = { label: ev.label, date: ev.date, until }
      bestDist = Math.abs(dist)
    }
  }
  story.watchZone = best

  story.upcoming.sort((a, b) => (a.date < b.date ? -1 : 1))
  return story
}
