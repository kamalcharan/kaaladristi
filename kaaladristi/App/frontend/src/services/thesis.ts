/**
 * thesis — the reversal/thesis engine behind ChartView's "Thesis" tab (Phase 2a).
 *
 * Reads a stock's daily bars (already fetched by the cockpit) and derives the
 * "is this thesis holding?" picture: current pillar alignment + its trend, a
 * per-bar risk↔reward POSTURE trajectory, and the recent DETERIORATION events
 * (bearish story events). When the user holds the stock, it also scores the
 * ENTRY setup and the P&L. Pure + deterministic; observational, never advice.
 *
 * Reuses the two things already built: buildPillars (VerdictHero) and
 * buildStoryEvents (the visual replay's event stream) — one substrate, so the
 * words, the chart and this tab never disagree.
 */

import { buildStoryEvents, type StoryEvent, type StoryBar } from './storyEvents'
import { buildPillars, type Pillar, type LatestRow } from '@/components/domain/StockCockpit/VerdictHero'

export type Relationship = 'position' | 'watchlist' | 'none'

export interface PositionInput {
  entryPrice: number
  entryDate: string
  qty?: number | null
}

export interface PosturePoint {
  date: string
  /** −100 (all risk) … +100 (all reward). */
  posture: number
}

export interface ThesisRead {
  relationship: Relationship
  pillars: Pillar[]
  alignedNow: number
  total: number
  alignedTrend: 'improving' | 'steady' | 'deteriorating'
  postureTrajectory: PosturePoint[]
  /** Bearish story events, most recent last (since entry when a position). */
  deterioration: StoryEvent[]
  verdict: { label: string; tone: 'bull' | 'bear' | 'neutral'; line: string }
  // Position-only —
  entry?: { date: string; price: number; qty: number | null; pillars: Pillar[]; aligned: number; label: string }
  pnlPct?: number | null
}

const BULL_FLOWS = new Set(['FRESH_LONGS', 'SHORT_COVERING'])
const BEAR_FLOWS = new Set(['FRESH_SHORTS', 'LONG_LIQUIDATION'])

/** A loose per-bar shape — the equity IndicatorRow already satisfies it. */
export interface ThesisBar extends StoryBar {
  rsi_14?: number | null
  ema_20?: number | null
  delivery_pct?: number | null
  delivery_surge_x?: number | null
  ret_66d?: number | null
}

/** −100..+100 posture for one bar: reward-vs-risk across 5 cheap reads. */
function barPosture(b: ThesisBar): number {
  let s = 0, n = 0
  if (b.score_5d != null && b.score_22d != null) { s += b.score_5d > b.score_22d ? 1 : -1; n++ }
  if (b.magic_rs != null) { s += b.magic_rs > 0 ? 1 : -1; n++ }
  if (b.rsi_14 != null) { s += b.rsi_14 >= 50 ? 1 : -1; n++ }
  if (b.flow_type) { if (BULL_FLOWS.has(b.flow_type)) { s += 1; n++ } else if (BEAR_FLOWS.has(b.flow_type)) { s -= 1; n++ } }
  if (b.close != null && b.ema_20 != null && b.ema_20 > 0) { s += b.close > b.ema_20 ? 1 : -1; n++ }
  return n ? Math.round((s / n) * 100) : 0
}

function alignedCount(bar: ThesisBar): number {
  return buildPillars(bar as LatestRow).filter((p) => p.aligned).length
}

export function computeThesis(
  bars: ThesisBar[] | undefined,
  relationship: Relationship,
  position?: PositionInput | null,
): ThesisRead | null {
  if (!bars || bars.length === 0) return null
  const latest = bars[bars.length - 1]
  const pillars = buildPillars(latest as LatestRow)
  const alignedNow = pillars.filter((p) => p.aligned).length
  const total = pillars.length

  // Trend — aligned now vs ~5 bars ago.
  const refIdx = Math.max(0, bars.length - 6)
  const alignedThen = alignedCount(bars[refIdx])
  const alignedTrend: ThesisRead['alignedTrend'] =
    alignedNow > alignedThen ? 'improving' : alignedNow < alignedThen ? 'deteriorating' : 'steady'

  // Posture trajectory — last 30 bars.
  const start = Math.max(0, bars.length - 30)
  const postureTrajectory = bars.slice(start).map((b) => ({ date: b.trade_date, posture: barPosture(b) }))

  // Deterioration — bearish story events, since entry when held.
  const events = buildStoryEvents(bars)
  let deterioration = events.filter((e) => e.tone === 'bear')
  if (relationship === 'position' && position?.entryDate) {
    deterioration = deterioration.filter((e) => e.date >= position.entryDate)
  }
  deterioration = deterioration.slice(-6)

  // Verdict — from alignment + latest posture.
  const nowPosture = postureTrajectory[postureTrajectory.length - 1]?.posture ?? 0
  let verdict: ThesisRead['verdict']
  if (alignedNow <= 1 || nowPosture <= -40) {
    verdict = { label: relationship === 'position' ? 'Thesis deteriorating' : 'Setup weak', tone: 'bear',
      line: alignedTrend === 'deteriorating' ? 'risk has risen recently' : 'few pillars holding' }
  } else if (alignedNow >= 3 && nowPosture >= 30) {
    verdict = { label: relationship === 'position' ? 'Thesis intact' : 'Setup building', tone: 'bull',
      line: alignedTrend === 'improving' ? 'strength is broadening' : 'pillars aligned' }
  } else {
    verdict = { label: 'Mixed', tone: 'neutral', line: 'watch the turn — pillars split' }
  }

  const read: ThesisRead = {
    relationship, pillars, alignedNow, total, alignedTrend, postureTrajectory, deterioration, verdict,
  }

  // Position layer — entry scorecard + P&L.
  if (relationship === 'position' && position) {
    const entryBar = bars.find((b) => b.trade_date >= position.entryDate) ?? bars[bars.length - 1]
    const entryPillars = buildPillars(entryBar as LatestRow)
    const entryAligned = entryPillars.filter((p) => p.aligned).length
    read.entry = {
      date: position.entryDate,
      price: position.entryPrice,
      qty: position.qty ?? null,
      pillars: entryPillars,
      aligned: entryAligned,
      label: entryAligned >= 3 ? 'Strong setup' : entryAligned === 2 ? 'Moderate setup' : 'Weak setup',
    }
    const cur = latest.close
    read.pnlPct = cur != null && position.entryPrice > 0
      ? ((cur - position.entryPrice) / position.entryPrice) * 100
      : null
  }

  return read
}
