// Bayer Rules — George Bayer's "Stock & Commodity Traders Hand-Book of Trend
// Determination" (1940), the 10 rules with live transit + evidence data
// today (docs/claude/rules-engine.md "Bayer Rules — Implementation Status").
// ~35+ further rules (4B, 5, 7, 8, 10-13, 15-20, 23-26, 28-48) are explicitly
// blocked pending the original handbook — not built here.
//
// BAY-R14-VEN-LON (Venus longitude unit cycle) is deliberately excluded:
// at 12,963 windows across the backfill it's a near-continuous oscillator
// (recurs roughly every day), not a discrete watchable event like the other
// 9. Its evidence also sits at the base rate (52.8% vs 53.0%).
//
// UNLIKE Mercury (owner's Excel maps 1:1 to three complementary lanes of ONE
// continuous story — always in some sign, always direct/retrograde, always
// combust or not), Bayer's 9 rules are independent trading claims about
// different planets, mostly sparse/rare events with no shared narrative.
// A timeline lane per rule forces a fit that doesn't hold (2026-07-23 owner
// correction) — this is a RULE-STATUS view instead: is each rule active
// today, when's its next occurrence, what does the evidence actually say.
//
// None of these 9 are evidence-promoted to a WATCH day (see astro-story.md
// honesty framework) — only Mercury's sign-ingress cleared that bar — so
// `base_bias` below is Bayer's own 1940 claim, shown as a hypothesis to
// weigh against the evidence, never as a verified fact.

import { from } from './postgrest'
import type { LaneSegment } from './mercuryAlmanac'

export interface BayerRuleDef {
  code: string
  ruleNum: string       // Bayer's own numbering, e.g. "R1", "R4A"
  label: string          // short display name
  baseBias: 'bullish' | 'bearish' | 'turning'  // Bayer's 1940 claim — unverified
}

export const BAYER_RULES: BayerRuleDef[] = [
  { code: 'TRN-MER-MAN-TRN', ruleNum: 'R1', label: 'Mercury Direction Change', baseBias: 'turning' },
  { code: 'BAY-R02-MAR-MER-SPD', ruleNum: 'R2', label: 'Mars-Mercury Speed Diff', baseBias: 'turning' },
  { code: 'BAY-R03-VEN-RET', ruleNum: 'R3', label: 'Venus Retrograde', baseBias: 'bearish' },
  { code: 'TRN-MER-RIS-W-BUL', ruleNum: 'R4A', label: 'Mercury Stations Direct', baseBias: 'bullish' },
  { code: 'BAY-R06-MAR-1635', ruleNum: 'R6', label: "Mars at 16°35'", baseBias: 'bullish' },
  { code: 'TR-MER-CMB-E-BEA', ruleNum: 'R9', label: 'Mercury Combust East', baseBias: 'bearish' },
  { code: 'CON-MER-VEN-CD-BEA', ruleNum: 'R21', label: 'Retro Venus + Direct Mercury', baseBias: 'bearish' },
  { code: 'CON-SUN-MER-TRN', ruleNum: 'R22', label: 'Sun conjunct Retro Mercury', baseBias: 'turning' },
  { code: 'BAY-R27-MER-SPD', ruleNum: 'R27', label: 'Mercury Speed Threshold', baseBias: 'turning' },
]

export interface BayerWindow {
  from: string      // YYYY-MM-DD
  to: string         // YYYY-MM-DD
  isPoint: boolean
}

export interface BayerRuleStatus {
  ruleCode: string
  ruleId: number
  def: BayerRuleDef
  active: BayerWindow | null      // the window covering today, if any
  next: BayerWindow | null        // earliest window starting after today, if any
}

interface TransitRow {
  rule_id: number
  start_date: string
  end_date: string
}

/** Fetches every Bayer rule's windows in [since, until] and reduces each to
 * its active-today / next-upcoming window — the two facts a status card needs.
 * `today` must be a YYYY-MM-DD string within [since, until]. */
export async function fetchBayerStatus(since: string, until: string, today: string): Promise<BayerRuleStatus[] | null> {
  const codes = BAYER_RULES.map(r => r.code)
  const { data: rules, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code')
    .in('rule_code', codes)
    .execute()
  if (rErr || !rules) return null
  const codeToId = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.rule_code, r.id]))
  const idToCode = new Map((rules as { id: number; rule_code: string }[])
    .map(r => [r.id, r.rule_code]))
  if (codeToId.size === 0) return null

  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('rule_id,start_date,end_date')
    .in('rule_id', [...idToCode.keys()])
    .gte('end_date', since)
    .lte('start_date', until)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  const windowsByCode = new Map<string, BayerWindow[]>(BAYER_RULES.map(r => [r.code, []]))
  for (const row of transits as TransitRow[]) {
    const code = idToCode.get(row.rule_id)
    if (!code) continue
    windowsByCode.get(code)?.push({
      from: row.start_date, to: row.end_date, isPoint: row.start_date === row.end_date,
    })
  }

  return BAYER_RULES.map(def => {
    const windows = windowsByCode.get(def.code) ?? []
    const active = windows.find(w => w.from <= today && w.to >= today) ?? null
    const next = windows.find(w => w.from > today) ?? null
    return {
      ruleCode: def.code, ruleId: codeToId.get(def.code) ?? 0, def, active, next,
    }
  }).filter(s => s.ruleId !== 0)
}

/** One rule's own windows in [since, until] — the timeline drill-down from
 * a status card. A single rule's history over time IS a coherent story
 * (unlike merging all 9 rules into one shared timeline), so this reuses
 * the exact same LaneSegment shape/TimelineLane component Mercury uses. */
export async function fetchBayerRuleWindows(ruleCode: string, since: string, until: string): Promise<LaneSegment[] | null> {
  const def = BAYER_RULES.find(r => r.code === ruleCode)
  if (!def) return null

  const { data: rules, error: rErr } = await from('km_astro_rule_master')
    .select('id,rule_code')
    .eq('rule_code', ruleCode)
    .execute()
  if (rErr || !rules || rules.length === 0) return null
  const ruleId = (rules as { id: number }[])[0].id

  const { data: transits, error: tErr } = await from('km_rule_transits')
    .select('start_date,end_date,sign,combustion_type')
    .eq('rule_id', ruleId)
    .gte('end_date', since)
    .lte('start_date', until)
    .order('start_date', { ascending: true })
    .execute()
  if (tErr || !transits) return null

  return (transits as { start_date: string; end_date: string; sign: string | null; combustion_type: string | null }[])
    .map(row => ({
      ruleCode, ruleId, from: row.start_date, to: row.end_date,
      label: row.sign ?? (row.combustion_type ? `${def.label} (${row.combustion_type})` : def.label),
      isPoint: row.start_date === row.end_date,
    }))
}
