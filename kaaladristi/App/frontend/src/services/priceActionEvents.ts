/**
 * priceActionEvents — the six Price Action scanners, derived on read.
 *
 * Breakout Surge, Breakdown Surge, Weekly/Monthly Movers and Weekly/Monthly
 * Decliners each qualify on ONE predicate over columns already stored on the
 * bar row. None of them needs a column, a migration or a nightly job: the
 * history is already there, and this file turns it into dated events.
 *
 * The predicates are the matview's own arms, verbatim:
 *
 *   Breakout Surge     pct_chng > 0 AND pct_from_breakout > 0
 *   Breakdown Surge    pct_chng < 0 AND pct_from_breakdown < 0
 *   Weekly Movers      pct_wtd > 0        Weekly Decliners    pct_wtd < 0
 *   Monthly Movers     pct_mtd > 0        Monthly Decliners   pct_mtd < 0
 *
 * ── Membership is not history ───────────────────────────────────────────────
 * The scanner LIST additionally requires exchange = 'NSE', close >= 50, one row
 * per ISIN and a top-500 rank. Those gates decide who appears on a page today;
 * they say nothing about what a stock did in 2019. Only the bare geometry is
 * derived here, and it reaches each stock's first bar — RELIANCE reads back to
 * 1996-01-02, TCS to 2002-08-13. (The POA guessed 2018/2020; measured, it is
 * the full price history.)
 *
 * ── The reference-reset guard is mandatory ──────────────────────────────────
 * `pct_wtd` is measured against `prev_week_close`, which changes every Monday;
 * `pct_mtd` against `prev_month_close`, which changes every month. A naive
 * sign-change test therefore fires a PHANTOM crossing on the first bar of each
 * period, where the two sides of the comparison are measured against different
 * reference prices and nothing about the stock changed at all.
 *
 * Measured on SOLARA over 123 bars (2026-03-14 →): 35 raw weekly sign changes,
 * of which 17 are phantom; 17 raw monthly, 3 phantom. Twenty fabricated events
 * out of fifty-two — the guard is not a refinement, it is the difference
 * between a signal stream and noise.
 *
 * ── One crossing per period per direction ───────────────────────────────────
 * A stock oscillating around last week's close crosses repeatedly inside one
 * week; only the first crossing in each direction is news. On SOLARA this
 * removes 6 of 14 surviving monthly events and 0 weekly (a five-day week rarely
 * crosses twice the same way) — so it earns its place on the monthly pair.
 *
 * ── Why breakout/breakdown carry NO cooldown ────────────────────────────────
 * Re-entries cluster: SOLARA cleared its 20-day high five times in the fifteen
 * days from 2026-04-02, dipping out for a bar or two between. The tempting fix
 * is to suppress a re-entry within N bars — so the gap distribution was
 * measured first, across a 1-in-37 NSE sample over the same six months
 * (566 entries): 1 bar out 12.5%, 2 bars 9.2%, 3-5 bars 20.8%, 6+ bars 40.8%.
 * There is no cliff anywhere in it, so any N would be taste wearing the
 * costume of a rule. The edge is emitted faithfully instead, and density is
 * handled where it belongs — `price_action` sits at the BOTTOM of the story
 * priority table, so it never displaces a journey milestone or a Big Money day
 * on a shared bar.
 *
 * SEBI / D39: every title states a measured relationship to a stored level.
 * No direction is predicted and no banned vocabulary appears.
 */

import type { StoryBar, StoryTone } from './storyEvents'

export interface PriceActionEvent {
  barIndex: number
  title: string
  detail: string
  tone: StoryTone
}

/** ISO week key. Two bars share a period iff they share this key. */
function weekKey(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  // Shift to the Thursday of the same ISO week, then key by that date.
  const day = (d.getUTCDay() + 6) % 7 // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3)
  return d.toISOString().slice(0, 10)
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function rupee(n?: number | null): string {
  return n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/**
 * A period-to-date sign crossing, guarded.
 *
 * `value` is pct_wtd / pct_mtd; `ref` is prev_week_close / prev_month_close.
 * Both sides must be present — a NULL is "not measured", never zero, and
 * treating it as zero manufactures a crossing on the first bar that has data.
 */
function crossings(
  bars: StoryBar[],
  value: (b: StoryBar) => number | null | undefined,
  ref: (b: StoryBar) => number | null | undefined,
  key: (iso: string) => string,
  up: { title: string; detail: (b: StoryBar, v: number) => string },
  down: { title: string; detail: (b: StoryBar, v: number) => string },
): PriceActionEvent[] {
  const out: PriceActionEvent[] = []
  const seen = new Set<string>()
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]
    const p = bars[i - 1]
    const v = value(b)
    const pv = value(p)
    if (v == null || pv == null) continue
    if (v > 0 === pv > 0) continue

    // THE GUARD. A changed reference price means the two sides were measured
    // against different baselines — the period rolled over, the stock did not
    // cross anything.
    const r = ref(b)
    const pr = ref(p)
    if (r == null || pr == null || r !== pr) continue

    const dir = v > 0 ? 'u' : 'd'
    const k = `${key(b.trade_date)}:${dir}`
    if (seen.has(k)) continue
    seen.add(k)

    const side = v > 0 ? up : down
    out.push({ barIndex: i, title: side.title, detail: side.detail(b, v), tone: v > 0 ? 'bull' : 'bear' })
  }
  return out
}

/** Entry into a two-part state, edge-triggered. Absent data is not "out". */
function stateEntries(
  bars: StoryBar[],
  holds: (b: StoryBar) => boolean | null,
  title: string,
  detail: (b: StoryBar) => string,
  tone: StoryTone,
): PriceActionEvent[] {
  const out: PriceActionEvent[] = []
  let prev: boolean | null = null
  for (let i = 0; i < bars.length; i++) {
    const now = holds(bars[i])
    // `prev === null` is "unmeasured", which must not read as false — otherwise
    // the first measured bar of a long-standing state reports as a fresh entry.
    if (now === true && prev === false) {
      out.push({ barIndex: i, title, detail: detail(bars[i]), tone })
    }
    prev = now
  }
  return out
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

export function priceActionEvents(bars: StoryBar[]): PriceActionEvent[] {
  if (bars.length < 2) return []
  const out: PriceActionEvent[] = []

  out.push(...stateEntries(
    bars,
    (b) => {
      const c = num(b.pct_chng), f = num(b.pct_from_breakout)
      return c == null || f == null ? null : c > 0 && f > 0
    },
    'Cleared the 20-day high',
    (b) => `Closed ${pct(num(b.pct_from_breakout) ?? 0)} above the 20-day high of ${rupee(b.breakout_level)}, on a ${pct(num(b.pct_chng) ?? 0)} day`,
    'bull',
  ))

  out.push(...stateEntries(
    bars,
    (b) => {
      const c = num(b.pct_chng), f = num(b.pct_from_breakdown)
      return c == null || f == null ? null : c < 0 && f < 0
    },
    'Broke the 20-day low',
    (b) => `Closed ${pct(num(b.pct_from_breakdown) ?? 0)} below the 20-day low of ${rupee(b.breakdown_level)}, on a ${pct(num(b.pct_chng) ?? 0)} day`,
    'bear',
  ))

  out.push(...crossings(
    bars, (b) => num(b.pct_wtd), (b) => num(b.prev_week_close), weekKey,
    { title: 'Above last week’s close', detail: (b, v) => `First close of the week above ${rupee(b.prev_week_close)} — now ${pct(v)} on the week` },
    { title: 'Below last week’s close', detail: (b, v) => `First close of the week below ${rupee(b.prev_week_close)} — now ${pct(v)} on the week` },
  ))

  out.push(...crossings(
    bars, (b) => num(b.pct_mtd), (b) => num(b.prev_month_close), monthKey,
    { title: 'Above last month’s close', detail: (b, v) => `First close of the month above ${rupee(b.prev_month_close)} — now ${pct(v)} on the month` },
    { title: 'Below last month’s close', detail: (b, v) => `First close of the month below ${rupee(b.prev_month_close)} — now ${pct(v)} on the month` },
  ))

  return out.sort((a, b) => a.barIndex - b.barIndex)
}
