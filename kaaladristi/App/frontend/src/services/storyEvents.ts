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

import { priceActionEvents } from './priceActionEvents'

export type StoryTone = 'bull' | 'bear' | 'neutral'

/** The per-bar shape the extractor needs (a loose subset of the equity row). */
export interface StoryBar {
  trade_date: string
  close: number
  high?: number | null
  low?: number | null
  volume?: number | null
  magic_rs?: number | null
  magic_ma?: number | null
  delivery_pct?: number | null
  score_5d?: number | null
  score_22d?: number | null
  magic_rs_zone?: string | null
  flow_type?: string | null
  stage?: string | null
  /** The date the CURRENT stage began — `stage_since === trade_date` is the
   *  transition itself. Absent on resampled weekly/monthly bars and indices. */
  stage_since?: string | null
  stage_confirmed?: string | null
  sma_150?: number | null
  /** Price Action geometry (migrations 112 / 187). Present from each stock's
   *  FIRST bar — RELIANCE reads back to 1996 — unlike ema_20 (2025+). */
  pct_chng?: number | null
  breakout_level?: number | null
  pct_from_breakout?: number | null
  breakdown_level?: number | null
  pct_from_breakdown?: number | null
  /** Period-to-date pair. `prev_*_close` is the REFERENCE the pct is measured
   *  against, and it is what makes a crossing real or phantom — never drop it. */
  prev_week_close?: number | null
  pct_wtd?: number | null
  prev_month_close?: number | null
  pct_mtd?: number | null
  gl_event?: string | null
  gl_days_above?: number | null
  pct_from_gl?: number | null
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
  | 'rs_breakaway'
  | 'gl'
  | 'price_action'
  | 'discovery'

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
  rs_breakaway: 'var(--story-rsbreakaway)',
  gl: 'var(--story-gl)',
  price_action: 'var(--story-priceaction)',
  discovery: 'var(--story-discovery)',
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
  discovery: 9,
  big_money: 8,
  gl: 7.5,
  fpb: 7,
  rs_breakaway: 6.5,
  magic_rs: 6,
  stage: 5,
  sector: 4,
  scan: 3,
  conviction: 2,
  flow: 1,
  // Deliberately last. Price Action fires often (44 events on SOLARA's 123
  // bars) and carries no cooldown — see priceActionEvents.ts on why a measured
  // distribution refused to supply one. Bottom priority is how that density is
  // paid for: on a shared bar it never displaces a journey milestone, a Big
  // Money day or a stage change.
  price_action: 0.5,
}

function zoneBucket(z?: string | null): StoryTone | null {
  if (!z) return null
  if (z === 'Strong Bull' || z === 'Mild Bull') return 'bull'
  if (z === 'Strong Bear' || z === 'Mild Bear') return 'bear'
  return 'neutral' // Neutral / Neutral Bull / Neutral Bear
}

// Weinstein's four stages, plus the approach state the classifier emits.
//
// D39 — the names describe STRUCTURE, never direction. "advancing" and
// "declining" read as a call on where price goes next; base, breakout attempt,
// top formation and markdown describe the shape the stage IS. `tone` stays
// bull/bear because it is an internal colour key, never rendered as text.
//
// S3 still carries the BEAR tone: leaving a Stage 2 run is the moment worth
// marking, and toning it neutral is what let a topping stock look unchanged.
const STAGE_NAME: Record<string, string> = {
  S1: 'Stage 1 · base',
  S2_CANDIDATE: 'Stage 2 · breakout attempt',
  S2: 'Stage 2',
  S3: 'Stage 3 · top formation',
  S4: 'Stage 4 · markdown',
}

const STAGE_LABEL: Record<string, { title: string; name: string; tone: StoryTone }> = {
  S1: { title: 'Entered Stage 1', name: STAGE_NAME.S1, tone: 'neutral' },
  S2_CANDIDATE: { title: 'Approaching Stage 2', name: STAGE_NAME.S2_CANDIDATE, tone: 'neutral' },
  S2: { title: 'Entered Stage 2', name: STAGE_NAME.S2, tone: 'bull' },
  S3: { title: 'Entered Stage 3', name: STAGE_NAME.S3, tone: 'bear' },
  S4: { title: 'Entered Stage 4', name: STAGE_NAME.S4, tone: 'bear' },
}

const GL_LABEL: Record<string, { title: string; detail: string; tone: StoryTone }> = {
  BREAKOUT: {
    title: 'Golden Line breakout',
    detail: 'Closed back above the 150-day Golden Line with a volume-drive or accumulation bar within five days.',
    tone: 'bull',
  },
  RETEST: {
    title: 'Golden Line retest held',
    detail: 'Came back to the Golden Line and held it, on a volume-drive or accumulation bar.',
    tone: 'bull',
  },
}

const FLOW_LABEL: Record<string, { title: string; tone: StoryTone }> = {
  FRESH_LONGS: { title: 'Fresh longs', tone: 'bull' },
  SHORT_COVERING: { title: 'Short covering', tone: 'bull' },
  FRESH_SHORTS: { title: 'Fresh shorts', tone: 'bear' },
  LONG_LIQUIDATION: { title: 'Long liquidation', tone: 'bear' },
}

// Stage-2 (advancing) is covered by the Stage event, so is_vani_s2 is omitted
// here to avoid a duplicate bubble on the same bar.
//
// ⚠ NAMING TRAP, fixed here. `is_vani_surge` was titled "Breakout surge" and
// `is_vani_breakout` "Fresh breakout" — but NEITHER is the Breakout Surge
// scanner. That scanner qualifies on 20-day-high geometry
// (`pct_chng > 0 AND pct_from_breakout > 0`); these two flags are 52-WEEK-high
// proximity plus a volume surge:
//
//   is_vani_breakout  rvol > 3 AND close > sma_150 AND rsi_14 in [50,78]
//                     AND magic_rs > 20 AND close >= w52_high * 0.95
//   is_vani_surge     rvol > 5 AND close >= w52_high * 0.95 AND rsi_14 < 78
//                     AND magic_rs > 0 AND close > sma_50
//
// On 2026-09-11 the scanner held 200 stocks and the flag fired on 8, overlap 6;
// on SOLARA's own bars the flag fired 0 times where the scanner condition fired
// 14. Same word, different rule. What the flags actually DO is decide the
// scanner's HIGHLIGHT (`vani_flag` = is_vani_surge OR is_vani_breakout) — so
// they are titled for what they measure, and the derived 20-day-high events
// live in priceActionEvents.ts under their own names.
const SCAN_FLAGS: { flag: keyof StoryBar; title: string; tone: StoryTone }[] = [
  { flag: 'is_vani_smart', title: 'Smart Money loading', tone: 'bull' },
  { flag: 'is_vani_breakout', title: 'Near the 52-week high on volume', tone: 'bull' },
  { flag: 'is_vani_surge', title: 'At the 52-week high on heavy volume', tone: 'bull' },
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

// ── RS breakaway — magic_rs pulling cleanly away from its own MA (magic_ma is
// already the smoothed trailing baseline magic_rs_zone is derived from — same
// fast-line-vs-baseline shape as a MACD line separating from its signal line).
// "Clean" is measured, not just "positive": most of the day-over-day moves
// must agree with the overall direction (a straight climb, not a sawtooth),
// and the baseline must have moved little over the same window — the read
// is the SEPARATION, not just RS being up. ──
const BREAKAWAY = {
  WINDOW: 8,          // bars — long enough to judge a trend, short enough to stay current
  MIN_RS_MOVE: 6,     // minimum |Δmagic_rs| over the window before this means anything
  CLEAN_RATIO: 0.75,  // share of day-over-day deltas that must agree with the overall direction
  MA_SLACK: 0.35,      // |Δmagic_ma| must stay under this fraction of |Δmagic_rs|
} as const

function breakawayTone(bars: StoryBar[], i: number): StoryTone | null {
  const w = BREAKAWAY.WINDOW
  if (i < w) return null
  const rs = bars[i].magic_rs, rs0 = bars[i - w].magic_rs
  const ma = bars[i].magic_ma, ma0 = bars[i - w].magic_ma
  if (rs == null || rs0 == null || ma == null || ma0 == null) return null

  const rsChange = rs - rs0
  if (Math.abs(rsChange) < BREAKAWAY.MIN_RS_MOVE) return null
  const maChange = ma - ma0
  if (Math.abs(maChange) > Math.abs(rsChange) * BREAKAWAY.MA_SLACK) return null

  let agree = 0, total = 0
  for (let k = i - w + 1; k <= i; k++) {
    const a = bars[k].magic_rs, b = bars[k - 1].magic_rs
    if (a == null || b == null) continue
    total++
    if ((rsChange > 0 && a > b) || (rsChange < 0 && a < b)) agree++
  }
  if (total === 0 || agree / total < BREAKAWAY.CLEAN_RATIO) return null

  return rsChange > 0 ? 'bull' : 'bear'
}

function breakawayEvents(bars: StoryBar[]): { i: number; title: string; detail: string; tone: StoryTone }[] {
  const out: { i: number; title: string; detail: string; tone: StoryTone }[] = []
  let prev: StoryTone | null = null
  for (let i = 1; i < bars.length; i++) {
    const tone = breakawayTone(bars, i)
    if (tone && tone !== prev) {
      out.push({
        i,
        title: tone === 'bull' ? 'Clean breakaway' : 'Clean breakdown',
        detail: tone === 'bull'
          ? `Magic RS pulled cleanly away from its own baseline over the last ${BREAKAWAY.WINDOW} sessions`
          : `Magic RS broke cleanly below its own baseline over the last ${BREAKAWAY.WINDOW} sessions`,
        tone,
      })
    }
    prev = tone
  }
  return out
}

/**
 * Build the ordered story for a stock's bars (ascending by date).
 * @param bigMoneyDates set of trade_date strings flagged as big-money days.
 */
/** The Waking Giants journey, if this stock is on one.
 *
 *  Unlike every other input here this is NOT per-bar data — it is one row in
 *  km_wg_journeys describing a multi-year arc, so it contributes two DATED
 *  markers rather than something scanned bar by bar. Undefined for the vast
 *  majority of stocks, which are on no journey at all. */
/** One Waking Giants journey — current or archived.
 *
 *  km_wg_journeys stores SIX dated milestones and the story layer read two of
 *  them (turn, wake). `confirm_date` is the Ascent moment — the payoff the whole
 *  engine exists to find, 75 current + 348 archived rows on 2026-09-14 — and it
 *  had never appeared on a chart; `sleep_date` (595 archived rows) closes the
 *  arc. Both are emitted now.
 *
 *  `sleep_date` is only ever set on an ARCHIVED row (is_current = false): a
 *  current journey by definition has not slept. Reading journeys with
 *  `is_current` alone therefore cannot show a journey that ended inside the
 *  loaded window — which is why the fetch now returns every journey for the
 *  stock and the builder walks them all. */
export interface StoryJourney {
  state?: string | null
  is_current?: boolean | null
  wake_date?: string | null
  wake_close?: number | null
  turn_date?: string | null
  turn_close?: number | null
  confirm_date?: string | null
  sleep_date?: string | null
  base_start?: string | null
  base_high?: number | null
  base_years?: number | null
  stir_days?: number | null
  align_score?: number | null
  resting?: boolean | null
  pct_from_turn?: number | null
  pct_from_wake?: number | null
}

export function buildStoryEvents(
  bars: StoryBar[],
  bigMoneyDates?: Set<string>,
  sectorByDate?: Map<string, { leading: boolean }>,
  journey?: StoryJourney | StoryJourney[] | null,
): StoryEvent[] {
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

  // Weinstein stage transition.
  //
  // `stage_since` is the classifier's OWN record of when the current stage
  // began, so `stage_since === trade_date` IS the transition — a stored fact
  // rather than one we re-derive. Preferred wherever the column is loaded, for
  // two reasons the bar-diff cannot cover: the previous LOADED bar may be days
  // earlier (a gap, a suspension), and a stock that leaves a stage and returns
  // to the same one reads as "unchanged" to a diff. The diff remains the
  // fallback for series carrying no stage_since — resampled weekly/monthly
  // bars and indices.
  //
  // `prev` is undefined for the first bar, which is the case the diff could
  // never see at all: a window opening on the very session a stage began drew
  // nothing. stage_since answers it without a predecessor.
  const addStageEvent = (i: number, b: StoryBar, prev?: StoryBar) => {
    if (!b.stage) return
    const changed = b.stage_since != null
      ? b.stage_since === b.trade_date
      : (!!prev?.stage && b.stage !== prev.stage)
    if (!changed) return
    // UNKNOWN is not a stage, it is the classifier saying it could not tell.
    // A move OUT of it is the indicator arriving, not the stock changing
    // character — 713 fabricated events when this was missing.
    if (prev?.stage === 'UNKNOWN') return
    const st = STAGE_LABEL[b.stage]   // undefined for UNKNOWN — nothing fires
    if (!st) return
    const from = prev?.stage ? (STAGE_NAME[prev.stage] ?? prev.stage) : null
    add(i, 'stage', st.title, from ? `${from} → ${st.name}` : `Now ${st.name}`, st.tone)
  }

  // The first bar carries no predecessor, so only a stored stage_since can
  // speak for it.
  if (bars.length) addStageEvent(0, bars[0])

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

    // 4) Stage change — EVERY transition, not only the two loud ones.
    //
    // This used to fire on S2 and S4 alone, so a stock topping out of Stage 2
    // into Stage 3 passed silently: the single transition a holder most wants
    // marked was the one the replay refused to draw. ZIMLAB sat at S3 for
    // thirteen sessions with nothing on the timeline to say so.
    // UNKNOWN is not a stage, it is the classifier saying it could not tell --
    // 38,848 bars carry it, almost all of them missing sma_200. A move OUT of
    // it is the indicator arriving, not the stock changing character, and
    // announcing "Entered Stage 4" on the day a moving average finally has
    // enough bars would be a fabricated event (713 of them since 2026-07-01).
    // Treat it exactly like a missing previous stage: say nothing.
    //
    // `stage_since` is the classifier's OWN record of when the current stage
    // began, so `stage_since === trade_date` IS the transition — a stored fact
    // rather than a diff we re-derive. Preferred when the column is loaded,
    // because the bar-to-bar diff cannot see a transition that happened on the
    // first bar of the window (there is no previous bar to compare against),
    // and a 1-year chart silently dropped every stage change that landed on its
    // left edge. The diff stays as the fallback for series that carry no
    // stage_since (resampled weekly/monthly bars, indices).
    addStageEvent(i, b, p)

    // 4b) Golden Line event — an SVD/SBD-backed cross or hold of the 150 SMA.
    // gl_event is only ever written on a bar that already carries the volume
    // signature (see backfill_gl_events.py), so its presence IS the confluence;
    // nothing further needs testing here.
    if (b.gl_event && b.gl_event !== p.gl_event) {
      const g = GL_LABEL[b.gl_event]
      if (g) {
        const held = b.gl_days_above != null && b.gl_days_above > 0
          ? ` Holding the line ${b.gl_days_above} sessions.`
          : ''
        add(i, 'gl', g.title, g.detail + held, g.tone)
      }
    }

    // 5) Scan entries — an is_vani_* flag flipping false → true.
    for (const s of SCAN_FLAGS) {
      if (b[s.flag] === true && p[s.flag] !== true) add(i, 'scan', s.title, `Qualified for the ${s.title} screen`, s.tone)
    }

    // 6) Big money day.
    if (bigMoneyDates?.has(b.trade_date)) add(i, 'big_money', '₹ Big money day', 'Delivered value spiked well above its norm — an institutional footprint', 'bull')

    // 6b) Sector rotating in — the stock's industry crossed into the leading quartile.
    if (sectorByDate) {
      const sNow = sectorByDate.get(b.trade_date)
      const sPrev = sectorByDate.get(p.trade_date)
      if (sNow?.leading && sPrev && !sPrev.leading) add(i, 'sector', 'Sector rotating in', 'The stock’s sector crossed into the leading quartile', 'bull')
    }
  }

  // 7) FPB — coil forming + burst/shatter release (recomputed from the bars).
  for (const f of fpbEvents(bars)) add(f.i, 'fpb', f.title, f.detail, f.tone)

  // 8) RS breakaway — magic_rs cleanly separating from its own MA.
  for (const b of breakawayEvents(bars)) add(b.i, 'rs_breakaway', b.title, b.detail, b.tone)

  // 9) Discovery — the journey's own turn and wake, placed on their bars.
  //
  // These are the two dates the whole Waking Giants engine exists to find, and
  // until now neither appeared on any chart: a stock could be mid-journey with
  // the timeline showing no sign of it. Matched by date rather than scanned,
  // and skipped silently when the date falls outside the loaded range — a
  // journey that woke two years ago has no bar to sit on in a 1-year view.
  // A stock can hold several journeys (one current, the rest archived —
  // 755 stocks have one, 226 have two, a handful many more). Walk them all:
  // an arc that ENDED inside the loaded window is exactly as much a part of
  // this chart's story as the one still running.
  const journeys: StoryJourney[] = !journey ? []
    : Array.isArray(journey) ? journey : [journey]

  const barAt = (d?: string | null) =>
    d ? bars.findIndex((x) => x.trade_date === d) : -1

  for (const j of journeys) {
    const yrs = j.base_years != null ? `${j.base_years} years` : 'a long stretch'

    const ti = barAt(j.turn_date)
    if (ti >= 0) {
      add(ti, 'discovery', 'Journey turned',
          `The weekly clock turned green and price cleared the Golden Line after ${yrs} of dormancy` +
          (j.turn_close != null ? ` — from Rs ${j.turn_close}.` : '.'),
          'bull')
    }

    const wi = barAt(j.wake_date)
    if (wi >= 0) {
      add(wi, 'discovery', 'Journey woke',
          `Cleared its hibernation ceiling` +
          (j.wake_close != null ? ` at Rs ${j.wake_close}` : '') +
          `${j.state ? ` — now ${j.state.toLowerCase()}` : ''}.`,
          'bull')
    }

    // The Ascent moment. Of 595 closed journeys, 348 reached it — and the
    // confirmed ones ran 494 days on average against 38 for those that never
    // did, so this is the single most consequential marker on the arc.
    const ci = barAt(j.confirm_date)
    if (ci >= 0) {
      add(ci, 'discovery', 'Journey confirmed',
          'All three clocks aligned and the monthly close held above the base ceiling' +
          (j.base_high != null ? ` of Rs ${j.base_high}.` : '.'),
          'bull')
    }

    // Only ever present on an archived row. D39: describe the structure, not
    // a direction — the journey closed, that is all this says.
    const si = barAt(j.sleep_date)
    if (si >= 0) {
      const lived = j.wake_date && j.sleep_date
        ? Math.round((Date.parse(j.sleep_date) - Date.parse(j.wake_date)) / 86400000)
        : null
      add(si, 'discovery', 'Journey closed',
          'Clock alignment collapsed and the journey was archived' +
          (lived != null ? ` — ${lived} days after its wake.` : '.') +
          (j.confirm_date ? '' : ' It never reached confirmation.'),
          'bear')
    }
  }

  // 10) The six Price Action scanners, derived from the bar row. Emitted
  //     through the same add() as everything else — one emission point, so
  //     reaction and priority are computed identically — but derived in its own
  //     module, because the reference-reset guard is subtle enough to earn its
  //     own test.
  for (const e of priceActionEvents(bars)) {
    add(e.barIndex, 'price_action', e.title, e.detail, e.tone)
  }

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
