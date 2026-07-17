/**
 * storyEvents — the data layer for the Chart & Replay "story mode".
 *
 * Scans an equity's daily bars once and emits a timed list of price-vs-signal
 * events (Conviction 5D↔22D · Magic RS flip · Flow flip · Stage change · Scan
 * entries · Big money). Each event carries a one-line caption and the forward
 * PRICE REACTION (close change over the next few bars) — so the replay can tell
 * a signal→outcome story on the candle it happened. Pure + deterministic;
 * observational, never predictive.
 *
 * All fields are recomputed/read per-bar from the loaded candles — no stored
 * historical scan membership needed (the is_vani_* flags are per-bar columns).
 */

export type StoryTone = 'bull' | 'bear' | 'neutral'

/** The per-bar shape the extractor needs (a loose subset of the equity row). */
export interface StoryBar {
  trade_date: string
  close: number
  score_5d?: number | null
  score_22d?: number | null
  magic_rs_zone?: string | null
  flow_type?: string | null
  stage?: string | null
  is_vani_smart?: boolean | null
  is_vani_breakout?: boolean | null
  is_vani_surge?: boolean | null
  is_vani_distrib?: boolean | null
  is_vani_weakness?: boolean | null
}

export type StoryKind =
  | 'big_money'
  | 'magic_rs'
  | 'stage'
  | 'scan'
  | 'conviction'
  | 'flow'

export interface StoryEvent {
  barIndex: number
  date: string
  kind: StoryKind
  title: string
  detail: string
  tone: StoryTone
  /** Where the bubble anchors relative to the candle. */
  position: 'above' | 'below'
  /** Close change over the next REACTION_BARS bars, in %. Null near the end. */
  reactionPct: number | null
  /** Higher wins when several events land on the same bar. */
  priority: number
}

const REACTION_BARS = 5

// Kind priority — when multiple events share a bar, the replay surfaces the top.
const PRIORITY: Record<StoryKind, number> = {
  big_money: 6,
  magic_rs: 5,
  stage: 4,
  scan: 3,
  conviction: 2,
  flow: 1,
}

function zoneBucket(z?: string | null): StoryTone | null {
  if (!z) return null
  if (z === 'Strong Bull' || z === 'Mild Bull') return 'bull'
  if (z === 'Strong Bear' || z === 'Mild Bear') return 'bear'
  return 'neutral' // Neutral / Neutral Bull / Neutral Bear
}

const FLOW_LABEL: Record<string, { title: string; tone: StoryTone }> = {
  FRESH_LONGS: { title: 'Fresh longs', tone: 'bull' },
  SHORT_COVERING: { title: 'Short covering', tone: 'bull' },
  FRESH_SHORTS: { title: 'Fresh shorts', tone: 'bear' },
  LONG_LIQUIDATION: { title: 'Long liquidation', tone: 'bear' },
}

// Stage-2 (advancing) is covered by the Stage event, so is_vani_s2 is omitted
// here to avoid a duplicate bubble on the same bar.
const SCAN_FLAGS: { flag: keyof StoryBar; title: string; tone: StoryTone }[] = [
  { flag: 'is_vani_smart', title: 'Smart Money loading', tone: 'bull' },
  { flag: 'is_vani_breakout', title: 'Fresh breakout', tone: 'bull' },
  { flag: 'is_vani_surge', title: 'Breakout surge', tone: 'bull' },
  { flag: 'is_vani_distrib', title: 'Distribution warning', tone: 'bear' },
  { flag: 'is_vani_weakness', title: 'Weakness confluence', tone: 'bear' },
]

function reactionPct(bars: StoryBar[], i: number): number | null {
  const j = Math.min(i + REACTION_BARS, bars.length - 1)
  if (j <= i) return null
  const a = bars[i].close
  const b = bars[j].close
  if (!a || !b) return null
  return ((b - a) / a) * 100
}

/**
 * Build the ordered story for a stock's bars (ascending by date).
 * @param bigMoneyDates set of trade_date strings flagged as big-money days.
 */
export function buildStoryEvents(bars: StoryBar[], bigMoneyDates?: Set<string>): StoryEvent[] {
  const out: StoryEvent[] = []
  const add = (i: number, kind: StoryKind, title: string, detail: string, tone: StoryTone) =>
    out.push({
      barIndex: i,
      date: bars[i].trade_date,
      kind,
      title,
      detail,
      tone,
      position: tone === 'bear' ? 'above' : 'below',
      reactionPct: reactionPct(bars, i),
      priority: PRIORITY[kind],
    })

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]
    const p = bars[i - 1]

    // 1) Conviction — Score 5D crossing its 22D pace.
    if (b.score_5d != null && b.score_22d != null && p.score_5d != null && p.score_22d != null) {
      const now = b.score_5d - b.score_22d
      const prev = p.score_5d - p.score_22d
      if (prev <= 0 && now > 0) add(i, 'conviction', 'Conviction building', `Score 5D (${Math.round(b.score_5d)}) crossed above its 22D pace`, 'bull')
      else if (prev >= 0 && now < 0) add(i, 'conviction', 'Conviction fading', `Score 5D (${Math.round(b.score_5d)}) slipped below its 22D pace`, 'bear')
    }

    // 2) Magic RS zone flip into bull / bear.
    const zb = zoneBucket(b.magic_rs_zone)
    const zp = zoneBucket(p.magic_rs_zone)
    if (zb && zp && zb !== zp) {
      if (zb === 'bull' && zp !== 'bull') add(i, 'magic_rs', 'Magic RS turned green', `Relative strength crossed into ${b.magic_rs_zone}`, 'bull')
      else if (zb === 'bear' && zp !== 'bear') add(i, 'magic_rs', 'Magic RS turned red', `Relative strength crossed into ${b.magic_rs_zone}`, 'bear')
    }

    // 3) Flow flip.
    if (b.flow_type && b.flow_type !== p.flow_type && FLOW_LABEL[b.flow_type]) {
      const f = FLOW_LABEL[b.flow_type]
      add(i, 'flow', f.title, `Order flow flipped to ${f.title.toLowerCase()}`, f.tone)
    }

    // 4) Stage change into Stage 2 (advancing) / Stage 4 (declining).
    if (b.stage && p.stage && b.stage !== p.stage) {
      if (b.stage === 'S2') add(i, 'stage', 'Entered Stage 2', `Weinstein stage ${p.stage} → S2 (advancing)`, 'bull')
      else if (b.stage === 'S4') add(i, 'stage', 'Entered Stage 4', `Weinstein stage ${p.stage} → S4 (declining)`, 'bear')
    }

    // 5) Scan entries — an is_vani_* flag flipping false → true.
    for (const s of SCAN_FLAGS) {
      if (b[s.flag] === true && p[s.flag] !== true) add(i, 'scan', s.title, `Qualified for the ${s.title} screen`, s.tone)
    }

    // 6) Big money day.
    if (bigMoneyDates?.has(b.trade_date)) add(i, 'big_money', '₹ Big money day', 'Delivered value spiked well above its norm — an institutional footprint', 'bull')
  }

  return out
}

/** The single event to surface at a given playhead bar (highest priority). */
export function eventAtBar(events: StoryEvent[], barIndex: number): StoryEvent | null {
  let best: StoryEvent | null = null
  for (const e of events) {
    if (e.barIndex === barIndex && (!best || e.priority > best.priority)) best = e
  }
  return best
}
