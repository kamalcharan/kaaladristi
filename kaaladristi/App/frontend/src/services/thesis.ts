/**
 * thesis — the reversal/thesis engine behind ChartView's "Thesis" tab (Phase 2a).
 *
 * Reads a stock's daily bars (already fetched by the cockpit) and derives the
 * "is this thesis holding?" picture: current pillar alignment + its trend, a
 * per-bar risk↔reward POSTURE trajectory, and the recent SIGNAL events (both
 * bullish and bearish story events, unfiltered — the timeline must show what
 * actually happened, not a one-sided subset of it). When the user holds the
 * stock, it also scores the ENTRY setup and the P&L. Pure + deterministic;
 * observational, never advice.
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

/** Entry-anchored position risk — the risk of YOUR position, not the stock. */
export interface PositionRisk {
  /** % from entry, per session since entry. */
  pnlPath: number[]
  currentPct: number
  peakPct: number
  /** currentPct − peakPct (≤ 0): how much you've given back from the best. */
  drawdownFromPeak: number
  /** worst % below entry seen since entry. */
  maxAdversePct: number
  riskTrend: 'rising' | 'easing' | 'flat'
  line: string
}

export interface ThesisRead {
  relationship: Relationship
  pillars: Pillar[]
  alignedNow: number
  total: number
  alignedTrend: 'improving' | 'steady' | 'deteriorating'
  postureTrajectory: PosturePoint[]
  /** Story events, both directions, most recent last (since entry when a position). */
  signals: StoryEvent[]
  verdict: { label: string; tone: 'bull' | 'bear' | 'neutral'; line: string }
  /** VaNi's grounded one-line narration of the read (deterministic — spoken
   *  from the computed facts, not a raw LLM guess). */
  vaniLine: string
  // Position-only —
  entry?: { date: string; price: number; qty: number | null; pillars: Pillar[]; aligned: number; total: number; label: string }
  pnlPct?: number | null
  positionRisk?: PositionRisk
}

const BULL_FLOWS = new Set(['FRESH_LONGS', 'SHORT_COVERING'])
const BEAR_FLOWS = new Set(['FRESH_SHORTS', 'LONG_LIQUIDATION'])
/** Recent window (~2 months of sessions) for a watchlist/cold stock's signal feed. */
const RECENT_SIGNAL_BARS = 44

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

/** Aligned/total over only the pillars that actually have data — a no-data
 *  pillar (value === '—') must never count toward either side, or the
 *  numerator can exceed the denominator (seen live as "4/3"). */
function alignedRatio(pillars: Pillar[]): { aligned: number; total: number } {
  const withData = pillars.filter((p) => p.value !== '—')
  const total = withData.length || pillars.length
  const aligned = withData.filter((p) => p.aligned).length
  return { aligned, total }
}

function alignedCount(bar: ThesisBar): number {
  return alignedRatio(buildPillars(bar as LatestRow)).aligned
}

export function computeThesis(
  bars: ThesisBar[] | undefined,
  relationship: Relationship,
  position?: PositionInput | null,
): ThesisRead | null {
  if (!bars || bars.length === 0) return null
  const latest = bars[bars.length - 1]
  const pillars = buildPillars(latest as LatestRow)
  // A pillar with no data ("—", e.g. delivery/Liquidity absent for many BSE/thin
  // names) must NOT count toward either side of the ratio — not as a failure
  // (that wrongly drags 3/3 down to "2/4") and not as a pass either (a pillar
  // can be flagged aligned off a fallback field — e.g. Liquidity's `aligned`
  // reads delivery_surge_x even when its displayed value, delivery_pct, is
  // null — which produced an impossible "4/3" when only the denominator
  // excluded it). Same no-fallback hygiene breadth uses.
  const withData = pillars.filter((p) => p.value !== '—')
  const { aligned: alignedNow, total } = alignedRatio(pillars)
  const ratio = alignedNow / total

  // Trend — aligned now vs ~5 bars ago.
  const refIdx = Math.max(0, bars.length - 6)
  const alignedThen = alignedCount(bars[refIdx])
  const alignedTrend: ThesisRead['alignedTrend'] =
    alignedNow > alignedThen ? 'improving' : alignedNow < alignedThen ? 'deteriorating' : 'steady'

  // Posture trajectory — last 30 bars.
  const start = Math.max(0, bars.length - 30)
  const postureTrajectory = bars.slice(start).map((b) => ({ date: b.trade_date, posture: barPosture(b) }))

  // Signals — the full story, both directions, NEWEST FIRST. No tone filter:
  // showing only the bearish half (the old behaviour) misrepresents what
  // actually happened whenever the stock is also confirming higher. For a
  // position, since entry; otherwise only the recent window (so the feed is
  // actually recent, not 2-month-old events).
  const events = buildStoryEvents(bars)
  let signals = events
  if (relationship === 'position' && position?.entryDate) {
    signals = signals.filter((e) => e.date >= position.entryDate)
  } else {
    signals = signals.filter((e) => e.barIndex >= bars.length - RECENT_SIGNAL_BARS)
  }
  signals = signals.slice(-8).reverse()

  // Verdict — ratio of aligned pillars (data-present) + latest posture. The line
  // NAMES what's strong vs weak, so a "Mixed" reads as an insight — "leading on
  // strength, weak on conviction" — not a contradiction of the RS lens.
  const nowPosture = postureTrajectory[postureTrajectory.length - 1]?.posture ?? 0
  const strong = pillars.filter((p) => p.aligned).map((p) => p.label)
  const weak = withData.filter((p) => !p.aligned).map((p) => p.label)
  const split = strong.length && weak.length ? `strong on ${strong.join(' & ')}, weak on ${weak.join(' & ')}` : ''
  let verdict: ThesisRead['verdict']
  if (ratio <= 0.34 || nowPosture <= -40) {
    verdict = { label: relationship === 'position' ? 'Thesis deteriorating' : 'Setup weak', tone: 'bear',
      line: alignedTrend === 'deteriorating' ? 'risk has risen recently' : (split || 'few pillars holding') }
  } else if (ratio >= 0.75 && nowPosture >= 25) {
    verdict = { label: relationship === 'position' ? 'Thesis intact' : 'Setup building', tone: 'bull',
      line: alignedTrend === 'improving' ? 'strength is broadening' : (split || 'pillars aligned') }
  } else {
    verdict = { label: 'Mixed', tone: 'neutral', line: split || 'watch the turn — pillars split' }
  }

  const read: ThesisRead = {
    relationship, pillars, alignedNow, total, alignedTrend, postureTrajectory, signals, verdict, vaniLine: '',
  }

  // Position layer — entry scorecard + P&L + entry-anchored risk.
  if (relationship === 'position' && position) {
    const entryBar = bars.find((b) => b.trade_date >= position.entryDate) ?? bars[bars.length - 1]
    const entryPillars = buildPillars(entryBar as LatestRow)
    const { aligned: entryAligned, total: entryTotal } = alignedRatio(entryPillars)
    read.entry = {
      date: position.entryDate,
      price: position.entryPrice,
      qty: position.qty ?? null,
      pillars: entryPillars,
      aligned: entryAligned,
      total: entryTotal,
      label: entryAligned / entryTotal >= 0.66 ? 'Strong setup' : entryAligned / entryTotal >= 0.5 ? 'Moderate setup' : 'Weak setup',
    }
    const cur = latest.close
    read.pnlPct = cur != null && position.entryPrice > 0 ? ((cur - position.entryPrice) / position.entryPrice) * 100 : null

    // Position risk — anchored to YOUR entry, over the bars since you entered.
    const sinceEntry = bars.filter((b) => b.trade_date >= position.entryDate)
    const pnlPath = sinceEntry.map((b) => (b.close != null && position.entryPrice > 0 ? ((b.close - position.entryPrice) / position.entryPrice) * 100 : 0))
    if (pnlPath.length > 0) {
      const currentPct = pnlPath[pnlPath.length - 1]
      const peakPct = Math.max(...pnlPath)
      const maxAdversePct = Math.min(...pnlPath)
      const drawdownFromPeak = currentPct - peakPct
      const postureEntry = barPosture(entryBar)
      const riskTrend: PositionRisk['riskTrend'] =
        nowPosture < postureEntry - 15 ? 'rising' : nowPosture > postureEntry + 15 ? 'easing' : 'flat'
      const line =
        `${currentPct < 0 ? 'Down' : 'Up'} ${Math.abs(currentPct).toFixed(1)}% since entry` +
        (drawdownFromPeak < -0.5 ? ` · ${Math.abs(drawdownFromPeak).toFixed(1)}% off the peak` : '') +
        ` · risk ${riskTrend}`
      read.positionRisk = { pnlPath, currentPct, peakPct, drawdownFromPeak, maxAdversePct, riskTrend, line }
    }
  }

  // VaNi's grounded narration — spoken from the computed facts above (the
  // Phase-3 principle: narrate the deterministic stream, never invent numbers).
  if (relationship === 'position' && read.positionRisk) {
    const r = read.positionRisk
    read.vaniLine =
      `You're ${r.currentPct < 0 ? 'down' : 'up'} ${Math.abs(r.currentPct).toFixed(1)}% since entry. ` +
      `${r.drawdownFromPeak < -1 ? `You've given back ${Math.abs(r.drawdownFromPeak).toFixed(1)}% from the peak and ` : ''}` +
      `${read.alignedNow}/${read.total} pillars hold — ${verdict.line}. Risk is ${r.riskTrend}.`
  } else if (relationship === 'watchlist') {
    read.vaniLine = `On your watchlist — ${verdict.label.toLowerCase()}: ${verdict.line}.` +
      (signals.length ? ` Latest signal: ${signals[0].title.toLowerCase()} on ${signals[0].date}.` : '')
  } else {
    read.vaniLine = `${verdict.label} — ${verdict.line}.` +
      (signals.length ? ` Latest signal: ${signals[0].title.toLowerCase()}.` : '')
  }

  return read
}
