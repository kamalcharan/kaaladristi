// Bayer Rules Almanac — George Bayer's "Stock & Commodity Traders Hand-Book
// of Trend Determination" (1940), the 10 rules with live transit + evidence
// data today (docs/claude/rules-engine.md "Bayer Rules — Implementation
// Status"). ~35+ further rules (4B, 5, 7, 8, 10-13, 15-20, 23-26, 28-48) are
// explicitly blocked pending the original handbook — not built here.
//
// BAY-R14-VEN-LON (Venus longitude unit cycle) is deliberately excluded from
// this almanac: at 12,963 windows across the backfill it's a near-continuous
// oscillator (recurs roughly every day), not a discrete watchable event like
// the other 9 — it would render as one solid always-on bar, not a timeline.
// Its evidence also sits at the base rate (52.8% vs 53.0%), so nothing is
// lost by leaving it out of the launch view.
//
// One lane per rule (not grouped by planet) — Bayer numbered these as
// individual trading rules, and the almanac's job is to show each rule's
// own windows, same spirit as Mercury's three-lane Excel-derived view.
// None of these 10 are evidence-promoted to a WATCH day yet (see
// astro-story.md honesty framework) — only Mercury's sign-ingress cleared
// that bar so far — so every Bayer event renders watchDay: false.

import { from } from './postgrest'
import type { LaneSegment, AlmanacEvent } from './mercuryAlmanac'

export interface BayerRuleDef {
  code: string
  ruleNum: string     // Bayer's own numbering, e.g. "R1", "R4A"
  label: string        // short display name for the lane
}

export const BAYER_RULES: BayerRuleDef[] = [
  { code: 'TRN-MER-MAN-TRN', ruleNum: 'R1', label: 'Mercury Direction Change' },
  { code: 'BAY-R02-MAR-MER-SPD', ruleNum: 'R2', label: 'Mars-Mercury Speed Diff' },
  { code: 'BAY-R03-VEN-RET', ruleNum: 'R3', label: 'Venus Retrograde' },
  { code: 'TRN-MER-RIS-W-BUL', ruleNum: 'R4A', label: 'Mercury Stations Direct' },
  { code: 'BAY-R06-MAR-1635', ruleNum: 'R6', label: "Mars at 16°35'" },
  { code: 'TR-MER-CMB-E-BEA', ruleNum: 'R9', label: 'Mercury Combust East' },
  { code: 'CON-MER-VEN-CD-BEA', ruleNum: 'R21', label: 'Retro Venus + Direct Mercury' },
  { code: 'CON-SUN-MER-TRN', ruleNum: 'R22', label: 'Sun conjunct Retro Mercury' },
  { code: 'BAY-R27-MER-SPD', ruleNum: 'R27', label: 'Mercury Speed Threshold' },
]

export interface BayerLane {
  ruleCode: string
  ruleId: number
  ruleNum: string
  title: string
  segments: LaneSegment[]
}

export interface BayerAlmanac {
  lanes: BayerLane[]
  events: AlmanacEvent[]
}

interface TransitRow {
  rule_id: number
  start_date: string
  end_date: string
  sign: string | null
  combustion_type: string | null
}

function daysBetweenDates(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

export async function fetchBayerAlmanac(since: string, until: string): Promise<BayerAlmanac | null> {
  const codes = BAYER_RULES.map(r => r.code)
  const { data: rules, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code')
    .in('rule_code', codes)
    .execute()
  if (rErr || !rules) return null
  const idToCode = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.id, r.rule_code]))
  const codeToId = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.rule_code, r.id]))
  if (idToCode.size === 0) return null

  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date,sign,combustion_type')
    .in('rule_id', [...idToCode.keys()])
    .gte('end_date', since)
    .lte('start_date', until)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  const laneByCode = new Map(BAYER_RULES.map(r => [r.code, [] as LaneSegment[]]))
  const events: AlmanacEvent[] = []

  for (const row of transits as TransitRow[]) {
    const code = idToCode.get(row.rule_id)
    const def = code ? BAYER_RULES.find(r => r.code === code) : undefined
    if (!code || !def) continue
    const isPoint = row.start_date === row.end_date
    const days = daysBetweenDates(row.start_date, row.end_date)
    const label = row.sign ?? (row.combustion_type ? `${def.label} (${row.combustion_type})` : def.label)

    laneByCode.get(code)?.push({
      ruleCode: code, ruleId: row.rule_id, from: row.start_date, to: row.end_date,
      label, isPoint,
    })

    if (isPoint) {
      events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: def.label, watchDay: false, boundary: 'start', days,
      })
    } else {
      events.push({
        date: row.start_date, ruleCode: code, ruleId: row.rule_id,
        label: `${def.label} begins`, watchDay: false, boundary: 'start', days,
      })
      events.push({
        date: row.end_date, ruleCode: code, ruleId: row.rule_id,
        label: `${def.label} ends`, watchDay: false, boundary: 'end', days,
      })
    }
  }

  const lanes: BayerLane[] = BAYER_RULES
    .map(def => ({
      ruleCode: def.code,
      ruleId: codeToId.get(def.code) ?? 0,
      ruleNum: def.ruleNum,
      title: def.ruleNum,
      segments: laneByCode.get(def.code) ?? [],
    }))
    .filter(lane => lane.ruleId !== 0)

  const seen = new Set<string>()
  const dedupedEvents = events
    .filter(e => {
      const k = `${e.date}|${e.ruleCode}|${e.label}`
      if (seen.has(k)) return false
      seen.add(k); return true
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return { lanes, events: dedupedEvents }
}
