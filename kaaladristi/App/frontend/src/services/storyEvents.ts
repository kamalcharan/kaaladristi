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
  high?: number | null
  low?: number | null
  volume?: number | null
  magic_rs?: number | null
  delivery_pct?: number | null
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
  | 'fpb'
  | 'magic_rs'
  | 'stage'
  | 'scan'
  | 'sector'
  | 'conviction'
  | 'flow'

/** One signature colour per kind (→ globals.css --story-* vars). */
export const KIND_COLORS: Record<StoryKind, string> = {
  big_money: 'var(--story-bigmoney)',
  fpb: 'var(--story-fpb)',
  magic_rs: 'var(--story-magicrs)',
  stage: 'var(--story-stage)',
  scan: 'var(--story-scan)',
  sector: 'var(--story-sector)',
  conviction: 'var(--story-conviction)',
  flow: 'var(--story-flow)',
}

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
  big_money: 8,
  fpb: 7,
  magic_rs: 6,
  stage: 5,
  sector: 4,
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

// ── FPB (energy compression → release) — thresholds calibrated to live NSE
// (mirrors services/scanEngine.ts). Recomputed per-bar from the loaded candles;
// no is_vani_fpb flag exists, so we detect coil-start + burst/shatter here. ──
const FPB = {
  ATR_MAX: 0.8, RANGE_MAX: 0.08, VOL_DEATH: 0.6, RS_FLAT: 2,
  MIN_CLOSE: 20, MIN_BARS: 60, PRIOR: 22,
  VOL_BURST: 3.0, RANGE_EXP: 2.0, CLOSE_STR: 0.70, DELIV_MIN: 45,
} as const

function fpbEvents(bars: StoryBar[]): { i: number; title: string; detail: string; tone: StoryTone }[] {
  const n = bars.length
  const out: { i: number; title: string; detail: string; tone: StoryTone }[] = []
  if (n < FPB.MIN_BARS + 1) return out
  const high = bars.map((b) => b.high ?? b.close)
  const low = bars.map((b) => b.low ?? b.close)
  const close = bars.map((b) => b.close)
  const vol = bars.map((b) => b.volume ?? 0)
  const mrs = bars.map((b) => (b.magic_rs != null ? b.magic_rs : NaN))
  const range = bars.map((_, i) => high[i] - low[i])
  const tr = bars.map((_, i) => {
    const pc = i > 0 ? close[i - 1] : close[i]
    return Math.max(high[i] - low[i], Math.abs(high[i] - pc), Math.abs(low[i] - pc))
  })
  const mean = (arr: number[], end: number, len: number) => {
    let s = 0, c = 0
    for (let k = Math.max(0, end - len + 1); k <= end; k++) { const v = arr[k]; if (v != null && !Number.isNaN(v)) { s += v; c++ } }
    return c ? s / c : NaN
  }
  const maxIn = (arr: number[], a: number, b: number) => { let m = -Infinity; for (let k = Math.max(0, a); k <= b; k++) if (arr[k] > m) m = arr[k]; return m }
  const minIn = (arr: number[], a: number, b: number) => { let m = Infinity; for (let k = Math.max(0, a); k <= b; k++) if (arr[k] < m) m = arr[k]; return m }

  const compressed = (idx: number): boolean => {
    if (idx < FPB.MIN_BARS - 1 || close[idx] <= FPB.MIN_CLOSE) return false
    const stg = bars[idx].stage
    if (stg === 'S3' || stg === 'S4') return false
    const atr15 = mean(tr, idx, 15), atr60 = mean(tr, idx, 60)
    if (!(atr60 > 0) || atr15 / atr60 >= FPB.ATR_MAX) return false
    if ((maxIn(high, idx - 9, idx) - minIn(low, idx - 9, idx)) / close[idx] >= FPB.RANGE_MAX) return false
    const vol5 = mean(vol, idx, 5), vol22 = mean(vol, idx, 22)
    if (!(vol22 > 0) || vol5 / vol22 >= FPB.VOL_DEATH) return false
    const rsNow = mrs[idx], rsPrev = mrs[idx - 5]
    if (Number.isNaN(rsNow) || Number.isNaN(rsPrev) || Math.abs(rsNow - rsPrev) >= FPB.RS_FLAT) return false
    return true
  }

  for (let i = FPB.MIN_BARS; i < n; i++) {
    if (compressed(i) && !compressed(i - 1)) {
      out.push({ i, title: 'Coil forming', detail: 'Volatility compressing — range tight, volume dying, RS flat', tone: 'neutral' })
    }
    let setupPrior = false
    for (let k = Math.max(0, i - FPB.PRIOR); k <= i - 1; k++) { if (compressed(k)) { setupPrior = true; break } }
    if (!setupPrior) continue
    const vol22Prior = mean(vol, i - 1, 22)
    const volBurst = vol22Prior > 0 ? vol[i] / vol22Prior : NaN
    const avgRange15Prior = mean(range, i - 1, 15)
    const rangeExp = avgRange15Prior > 0 ? range[i] / avgRange15Prior : NaN
    const dayRange = high[i] - low[i]
    const closeStr = dayRange > 0 ? (close[i] - low[i]) / dayRange : 0
    const deliv = bars[i].delivery_pct ?? 0
    const energy = close[i] > FPB.MIN_CLOSE && volBurst >= FPB.VOL_BURST && rangeExp >= FPB.RANGE_EXP && deliv > FPB.DELIV_MIN
    if (energy && closeStr >= FPB.CLOSE_STR && close[i] > maxIn(high, i - 10, i - 1)) {
      out.push({ i, title: 'Coil released — Burst ↑', detail: `Explosive release: ${volBurst.toFixed(1)}× volume, ${rangeExp.toFixed(1)}× range, closed above the 10-day range`, tone: 'bull' })
    } else if (energy && closeStr <= 1 - FPB.CLOSE_STR && close[i] < minIn(low, i - 10, i - 1)) {
      out.push({ i, title: 'Coil released — Shatter ↓', detail: `Downside release: ${volBurst.toFixed(1)}× volume, ${rangeExp.toFixed(1)}× range, broke below the 10-day range`, tone: 'bear' })
    }
  }
  return out
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

  // 7) FPB — coil forming + burst/shatter release (recomputed from the bars).
  for (const f of fpbEvents(bars)) add(f.i, 'fpb', f.title, f.detail, f.tone)

  out.sort((a, b) => a.barIndex - b.barIndex)
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
