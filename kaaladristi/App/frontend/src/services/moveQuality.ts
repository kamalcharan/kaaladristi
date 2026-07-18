/**
 * moveQuality — Phase 2b "move-quality" for an index (the anti-trap layer).
 *
 * A price badge reads the LEVEL and lags; it stays green through the top. An
 * index, though, is a POPULATION — so it can reveal whether a move is broad or
 * narrow, which a single stock cannot. This is a PURE derivation over data the
 * sector page already fetches (constituent details + breadth) — no new query,
 * no re-table. It summarises the constituents table into one verdict:
 * broad · mixed · narrow, with the reasons.
 *
 * Observational, never predictive. Thresholds here are first-cut and meant to
 * be owner-calibrated (see MQ_THRESHOLDS).
 */

import type { ConstituentDetail } from './sectorRotation'

const BULL_FLOWS = new Set(['FRESH_LONGS', 'SHORT_COVERING'])
const BEAR_FLOWS = new Set(['FRESH_SHORTS', 'LONG_LIQUIDATION'])

export const MQ_THRESHOLDS = {
  /** up-ratio at/below which participation reads "narrow". */
  narrowUp: 0.4,
  /** up-ratio at/above which participation reads "broad". */
  broadUp: 0.6,
  /** top-name score share at/above which the move is "carried by one name". */
  concentrated: 60,
  /** top-name share below which concentration is not a concern (for "broad"). */
  diffuse: 45,
} as const

export type MoveVerdict = 'broad' | 'mixed' | 'narrow'

export interface MoveQuality {
  total: number
  upCount: number            // pct_chng > 0
  positiveRsCount: number    // magic_rs > 0 (leading the market)
  bullFlowCount: number      // fresh longs / short covering
  bearFlowCount: number      // fresh shorts / long liquidation
  aboveTrendPct: number | null // % of constituents above their 20-EMA (from breadth)
  topName: string | null     // largest positive score_5d contributor
  topSharePct: number | null // its share of total positive score_5d
  verdict: MoveVerdict
  headline: string
  /** Short reason bullets, most-telling first. */
  flags: string[]
}

/**
 * @param details    per-constituent latest EOD (from useConstituentDetails)
 * @param aboveTrendPct  % of constituents above their 20-EMA (breadth.pct_above_20), optional
 */
export function computeMoveQuality(
  details: ConstituentDetail[] | undefined,
  aboveTrendPct?: number | null,
): MoveQuality | null {
  if (!details || details.length === 0) return null
  const total = details.length

  let upCount = 0, positiveRsCount = 0, bullFlowCount = 0, bearFlowCount = 0
  let topName: string | null = null, topScore = -Infinity, sumPosScore = 0

  for (const d of details) {
    if ((d.pct_chng ?? 0) > 0) upCount++
    if ((d.magic_rs ?? 0) > 0) positiveRsCount++
    if (d.flow_type && BULL_FLOWS.has(d.flow_type)) bullFlowCount++
    if (d.flow_type && BEAR_FLOWS.has(d.flow_type)) bearFlowCount++
    const s = d.score_5d ?? 0
    if (s > 0) {
      sumPosScore += s
      if (s > topScore) { topScore = s; topName = d.symbol }
    }
  }

  const topSharePct = sumPosScore > 0 ? Math.round((topScore / sumPosScore) * 100) : null
  const upRatio = upCount / total
  const concentrated = topSharePct != null && topSharePct >= MQ_THRESHOLDS.concentrated

  let verdict: MoveVerdict
  if (upRatio <= MQ_THRESHOLDS.narrowUp || concentrated || (bullFlowCount === 0 && bearFlowCount > 0)) {
    verdict = 'narrow'
  } else if (
    upRatio >= MQ_THRESHOLDS.broadUp &&
    bullFlowCount >= Math.ceil(total / 2) &&
    (topSharePct == null || topSharePct < MQ_THRESHOLDS.diffuse)
  ) {
    verdict = 'broad'
  } else {
    verdict = 'mixed'
  }

  const headline =
    verdict === 'broad' ? 'Broad — participation confirms'
      : verdict === 'narrow'
        ? (concentrated ? 'Narrow — carried by one name' : 'Narrow — few participating')
        : 'Mixed — watch participation'

  const flags: string[] = []
  flags.push(`${upCount}/${total} up on the day`)
  if (bullFlowCount === 0 && bearFlowCount > 0) flags.push(`0/${total} confirm the flow — ${bearFlowCount} turning bearish`)
  else flags.push(`${bullFlowCount}/${total} confirm with fresh longs`)
  if (concentrated && topName) flags.push(`${topName} is ${topSharePct}% of the score`)
  if (aboveTrendPct != null) flags.push(`${Math.round(aboveTrendPct)}% above their 20-EMA`)

  return {
    total, upCount, positiveRsCount, bullFlowCount, bearFlowCount,
    aboveTrendPct: aboveTrendPct ?? null,
    topName, topSharePct, verdict, headline, flags,
  }
}
