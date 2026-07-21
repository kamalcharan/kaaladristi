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
  watchDay: boolean // ingress days carry the transition evidence
}

export interface MercuryStory {
  sign: string | null
  motion: 'direct' | 'retrograde'
  combustUntil: string | null      // end date of the active combust window
  combustStage: string | null      // ghora / … (deepest-separation stage)
  upcoming: MercuryEvent[]         // sorted asc, full 90 days — caller clamps
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
    .gte('end_date', today)
    .lte('start_date', in90)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  const story: MercuryStory = {
    sign: null, motion: 'direct', combustUntil: null, combustStage: null, upcoming: [],
  }

  for (const row of transits as TransitRow[]) {
    const code = idToCode.get(row.rule_id)
    const active = row.start_date <= today && row.end_date >= today
    if (code === RULE_JOURNEY) {
      if (active) story.sign = row.sign
      else if (row.start_date > today && row.sign) {
        story.upcoming.push({ date: row.start_date, label: `enters ${row.sign}`, watchDay: true })
      }
    } else if (code === RULE_MOTION) {
      if (active) {
        story.motion = 'retrograde'
        if (row.end_date >= today) {
          story.upcoming.push({ date: row.end_date, label: 'stations direct', watchDay: true })
        }
      } else if (row.start_date > today) {
        story.upcoming.push({ date: row.start_date, label: 'turns retrograde', watchDay: true })
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

  story.upcoming.sort((a, b) => (a.date < b.date ? -1 : 1))
  return story
}
