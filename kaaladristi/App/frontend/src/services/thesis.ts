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

import { buildStoryEvents, type StoryEvent, type StoryBar, type StoryJourney } from './storyEvents'
import { readBigMoneyDays, type BigMoneyDirection, type BigMoneyEvent } from './bigMoney'
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

/** Where the last Big Money day sits relative to the Golden Line, and whether
 *  price still holds it. The two structural facts the platform already stores,
 *  read together — neither is new data, and neither is re-derived here.
 *
 *  SEBI: every string this produces is observational. It says where large money
 *  changed hands and where price is now relative to that; it never says what to
 *  do about it. */
export interface StructureRead {
  /** Golden Line (sma_150) on the latest bar. */
  gl: number | null
  pctFromGl: number | null
  aboveGl: boolean | null
  /** Consecutive sessions closed above the Golden Line, this bar included. */
  daysAboveGl: number | null
  bigMoney: {
    date: string
    direction: BigMoneyDirection
    ratio: number
    delivCr: number
    low: number
    high: number
    heldAbove: number
    sessionsSince: number
    /** Was the event's own zone above the Golden Line at the time? */
    aboveGlAtEvent: boolean | null
  } | null
  /** Does the latest close sit at or above the last Big Money zone's low? */
  aboveZone: boolean | null
  label: string
  tone: 'bull' | 'bear' | 'neutral'
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
  /** Big Money × Golden Line. Null only when the bars carry neither. */
  structure: StructureRead | null
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
  deliv_value_cr?: number | null
  bm_event?: string | null
  bm_ratio?: number | null
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

/**
 * Big Money × Golden Line.
 *
 * The owner's question this answers: "if a Big Money day is above the Golden
 * Line or below it, and price holds the zone or doesn't — what does that
 * read as?" Both inputs are already stored (bm_event from migration 200,
 * sma_150/pct_from_gl/gl_days_above from migration 194), so this composes
 * them; it derives neither.
 *
 * The reading is a closed set of seven, chosen so that each names a genuinely
 * different configuration rather than grading one axis. Every string states an
 * observation and the arithmetic behind it — no directive verb, no target, no
 * bull/bear label on the price itself.
 */
function buildStructure(bars: ThesisBar[], events: BigMoneyEvent[]): StructureRead | null {
  const latest = bars[bars.length - 1]
  const gl = latest.sma_150 ?? null
  const close = latest.close
  const aboveGl = gl != null && gl > 0 && close != null ? close > gl : null
  const pctFromGl = latest.pct_from_gl ?? (gl != null && gl > 0 && close != null
    ? ((close - gl) / gl) * 100
    : null)
  const daysAboveGl = latest.gl_days_above ?? null

  const last = events.length ? events[events.length - 1] : null

  // Nothing structural to say at all — no Golden Line yet (young listing) and
  // no footprint on record. Better to return null than to render an empty card.
  if (gl == null && last == null) return null

  let bigMoney: StructureRead['bigMoney'] = null
  let aboveZone: boolean | null = null
  if (last) {
    const evBar = bars.find((b) => b.trade_date === last.trade_date)
    const evGl = evBar?.sma_150 ?? null
    bigMoney = {
      date: last.trade_date,
      direction: last.direction,
      ratio: last.ratio,
      delivCr: last.delivCr,
      low: last.low,
      high: last.high,
      heldAbove: last.heldAbove,
      sessionsSince: last.sessionsSince,
      // The zone counts as above the line when its LOW clears it — the whole
      // handover happened above the 150-day mean, not merely its top wick.
      aboveGlAtEvent: evGl != null && evGl > 0 ? last.low > evGl : null,
    }
    aboveZone = close != null ? close >= last.low : null
  }

  const glPhrase = gl != null && pctFromGl != null
    ? `Price is ${pctFromGl >= 0 ? 'above' : 'below'} the Golden Line (₹${gl.toFixed(0)}) by ${Math.abs(pctFromGl).toFixed(1)}%`
      + (aboveGl && daysAboveGl ? `, held for ${daysAboveGl} session${daysAboveGl === 1 ? '' : 's'}` : '')
    : 'No Golden Line yet — this listing has under 150 sessions of history'

  if (!bigMoney) {
    return {
      gl, pctFromGl, aboveGl, daysAboveGl, bigMoney: null, aboveZone: null,
      label: 'No footprint on record',
      tone: 'neutral',
      line: `${glPhrase}. No session in this window has delivered ≥5× this stock's own 66-day norm, `
          + `so there is no Big Money zone to read it against. Delivery data begins June 2024.`,
    }
  }

  const zone = `₹${bigMoney.low.toFixed(0)}–${bigMoney.high.toFixed(0)}`
  const held = bigMoney.sessionsSince > 0
    ? `closed above that zone in ${bigMoney.heldAbove} of ${bigMoney.sessionsSince} sessions since`
    : 'too recent to have an aftermath yet'
  const moved = `₹${bigMoney.delivCr >= 100 ? bigMoney.delivCr.toFixed(0) : bigMoney.delivCr.toFixed(1)} Cr `
              + `(${bigMoney.ratio.toFixed(1)}× its norm) changed hands at ${zone} on ${bigMoney.date}`

  let label: string
  let tone: StructureRead['tone']
  let detail: string

  if (bigMoney.direction === 'exit') {
    if (aboveZone) {
      label = 'Exit footprint reclaimed'
      tone = 'neutral'
      detail = `An exit footprint — a down session closing near its low — but price has since ${held}.`
    } else {
      label = 'Under the exit footprint'
      tone = 'bear'
      detail = `An exit footprint, and price has not regained the zone: ${held}.`
    }
  } else if (bigMoney.direction === 'mixed') {
    label = 'Handover, no price verdict'
    tone = 'neutral'
    detail = `Price gave no clear verdict on the day — it closed mid-range — so the footprint reads as `
           + `ownership changing hands rather than one side paying up. Price has ${held}.`
  } else if (bigMoney.aboveGlAtEvent === false) {
    // Entry footprint made while the stock was still under its long mean.
    label = aboveGl ? 'Entry footprint below, line since reclaimed' : 'Entry footprint below the line'
    tone = aboveGl ? 'bull' : 'neutral'
    detail = aboveGl
      ? `The buying happened while the stock was still under its Golden Line, and price has since `
        + `crossed it${daysAboveGl ? ` and held for ${daysAboveGl} sessions` : ''}. Price has ${held}.`
      : `The buying happened while the stock was still under its Golden Line, and it has not crossed `
        + `since. Price has ${held}.`
  } else if (aboveZone && aboveGl) {
    label = 'Entry footprint holding above the line'
    tone = 'bull'
    detail = `The buying happened with price already above its Golden Line, and price has ${held}.`
  } else if (!aboveZone) {
    label = 'Back under the entry zone'
    tone = 'bear'
    detail = `The buying happened above the Golden Line, but price has since traded back under the `
           + `zone: ${held}.`
  } else {
    label = 'Entry zone held, line lost'
    tone = 'neutral'
    detail = `Price still sits above the zone where the buying happened, but no longer above its `
           + `Golden Line. Price has ${held}.`
  }

  return {
    gl, pctFromGl, aboveGl, daysAboveGl, bigMoney, aboveZone,
    label, tone,
    line: `${glPhrase}. ${moved} — ${detail}`,
  }
}

export function computeThesis(
  bars: ThesisBar[] | undefined,
  relationship: Relationship,
  position?: PositionInput | null,
  journey?: StoryJourney | null,
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
  // Big-money dates are now available on the bars themselves, so the thesis
  // signal feed can carry them too — it previously passed `undefined` and
  // silently dropped every big-money event from this tab's timeline while
  // the chart's own timeline showed them.
  const bigMoneyEvents = readBigMoneyDays(bars)
  const bigMoneyDates = new Set(bigMoneyEvents.map((e) => e.trade_date))
  const events = buildStoryEvents(bars, bigMoneyDates, undefined, journey)
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
    relationship, pillars, alignedNow, total, alignedTrend, postureTrajectory, signals, verdict,
    vaniLine: '', structure: buildStructure(bars, bigMoneyEvents),
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

  // The structural half, appended rather than merged: the pillars answer "is
  // the thesis holding", the structure answers "against what level". Keeping
  // them as separate clauses is what stops the line reading as one blended
  // score the user cannot take apart.
  if (read.structure?.bigMoney) {
    const st = read.structure
    read.vaniLine += ` ${st.label}: last big-money zone ₹${st.bigMoney!.low.toFixed(0)}–`
      + `${st.bigMoney!.high.toFixed(0)}, price ${st.aboveZone ? 'above' : 'below'} it`
      + (st.aboveGl != null ? ` and ${st.aboveGl ? 'above' : 'below'} the Golden Line` : '') + '.'
  }

  return read
}
