/**
 * Golden Line pair — adapters for the Scanner Story Page (gap audit B3).
 *
 * One builder parameterised on the event, two registrations:
 *   · gl_breakout — the close came back ABOVE the 150-day mean after a
 *     close at or below it, on a volume-drive or accumulation bar.
 *   · gl_retest   — price came back DOWN to the line after ≥ 10 sessions
 *     above it, touched it intraday, and closed above it on such a bar.
 *
 * The Golden Line is sma_150 on the daily bar — the 150-session mean close,
 * roughly seven months of trade. The Weinstein reading behind the two
 * scans: a reclaim of a long mean on real participation is where a base
 * ends, and a held retest is where the market shows it agrees. Both are
 * observations about a level, not calls (SEBI): every persona line below
 * names a price the reader watches and what has historically followed.
 *
 * Persona lenses:
 *   · LT lens  — the line itself, the weekly structural line beneath it,
 *     and the level a failed reclaim historically returned to.
 *   · Swing lens — the bar's own pivots: continuation through R1, a
 *     quiet drift to the pivot, and the line-loss guard.
 */

import type {
  SetupAdapter,
  SetupData,
  SetupHeader,
  KeyLevels,
  CurrentSituation,
  ChartAnnotations,
  PersonaEntries,
  PersonaEntry,
  WhatConfirmsItem,
  EntryZoneAnnotation,
  HorizontalLine,
  WeeklyBar,
  LatestEodRow,
  EquityIdentity,
} from '../setupAdapter';
import { smaFromEnd, priorMaxFromEnd, priorMinFromEnd, trailingWindow } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';

type GlEvent = 'BREAKOUT' | 'RETEST';

const ZONE_WIDTH = 0.015;

/** Sessions above the line that make a retest "established" rather than a
 *  reclaim still being tested. Same floor fetchGlEvents / the gl_events
 *  pipeline step use to stamp a RETEST at all. */
const RETEST_MIN_HOLD = 10;
const ESTABLISHED_HOLD = 40;

function makeAdapter(event: GlEvent): SetupAdapter {
  const setupKey = event === 'BREAKOUT' ? 'gl_breakout' : 'gl_retest';
  const setupLabel = event === 'BREAKOUT' ? 'Golden Line Breakout' : 'Golden Line Retest';

  return (weekly, latest, identity) => {
    const line = latest.sma_150;
    const ema50w = smaFromEnd(weekly, 50, (b) => b.close);
    // The consolidation the reclaim came out of / the shelf the retest sits
    // beneath: prior 8-week close high, excluding the live week.
    const priorConsolTop = priorMaxFromEnd(weekly, 8, (b) => b.close);
    // The floor a retest actually probed: prior 4-week low, excluding the
    // live week. On a breakout it is the low of the base's last leg.
    const recentFloor = priorMinFromEnd(weekly, 4, (b) => b.low);

    const header = buildHeader(latest, identity, line, event);
    const keyLevels = buildKeyLevels(latest, ema50w, line);
    const personas = buildPersonas(latest, line, priorConsolTop, recentFloor, ema50w, event);
    const whatConfirms = buildWhatConfirms(latest, weekly, line, event);
    const cycleLabels = buildCycleLabels(weekly);
    const chartAnnotations: ChartAnnotations = {
      cycleLabels,
      entryZones: buildEntryZones(personas),
      horizontalLines: buildHorizontalLines(keyLevels, line),
    };
    const currentSituation = buildCurrentSituation(latest, whatConfirms, line, event);

    const data: SetupData = {
      setupKey,
      setupLabel,
      header,
      keyLevels,
      currentSituation,
      chartAnnotations,
      personas,
      whatConfirms,
      investorTip: buildInvestorTip(latest, line, event),
    };
    return data;
  };
}

export const glBreakoutAdapter: SetupAdapter = makeAdapter('BREAKOUT');
export const glRetestAdapter: SetupAdapter = makeAdapter('RETEST');

// ── Shared arithmetic ───────────────────────────────────────────────────

/** Signed % distance of the close from the line. Prefers the stored
 *  pct_from_gl (the pipeline's own number) and falls back to the same
 *  arithmetic on sma_150 for a bar the gl_events step has not stamped. */
function distFromLine(latest: LatestEodRow, line: number | null): number | null {
  if (latest.pct_from_gl != null && Number.isFinite(latest.pct_from_gl)) return latest.pct_from_gl;
  if (line == null || !Number.isFinite(line) || line <= 0) return null;
  return ((latest.close - line) / line) * 100;
}

// ── Header ──────────────────────────────────────────────────────────────

function buildHeader(latest: LatestEodRow, identity: EquityIdentity, line: number | null, event: GlEvent): SetupHeader {
  const { phase, tone } = derivePhase(latest, line, event);
  return {
    symbol: identity.symbol,
    companyName: identity.company_name,
    exchange: identity.exchange,
    industry: identity.industry,
    close: latest.close,
    pctChng: latest.pct_chng,
    rsPercentile: latest.rs_percentile,
    phase,
    phaseTone: tone,
  };
}

function derivePhase(latest: LatestEodRow, line: number | null, event: GlEvent): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const dist = distFromLine(latest, line);
  if (dist == null) return { phase: event === 'BREAKOUT' ? 'Reclaim' : 'Retest', tone: 'neutral' };
  if (dist < 0) return { phase: 'Back below the line', tone: 'bear' };
  if (event === 'BREAKOUT') {
    if (dist <= 2) return { phase: 'Fresh reclaim', tone: 'bull' };
    if (dist <= 6) return { phase: 'Follow-through', tone: 'bull' };
    return { phase: 'Extended from the line', tone: 'neutral' };
  }
  const held = latest.gl_days_above ?? 0;
  if (held >= ESTABLISHED_HOLD) return { phase: 'Established hold', tone: 'bull' };
  if (held >= RETEST_MIN_HOLD) return { phase: 'Line held', tone: 'bull' };
  return { phase: 'Early hold', tone: 'neutral' };
}

// ── Key Levels ──────────────────────────────────────────────────────────

function buildKeyLevels(latest: LatestEodRow, ema50Weekly: number | null, line: number | null): KeyLevels {
  const majorRes = pickBest(latest.pivot_r2, latest.w52_high, Math.min);
  return {
    pivot:               latest.pivot_pp,
    immediateResistance: latest.pivot_r1,
    majorResistance:     majorRes,
    immediateSupport:    latest.pivot_s1,
    // The line IS the strong support on this pair — it is why the row exists.
    strongSupport:       line ?? latest.pivot_s2,
    ema50Weekly,
  };
}

function pickBest(a: number | null, b: number | null, combine: (x: number, y: number) => number): number | null {
  if (a != null && b != null) return combine(a, b);
  return a ?? b;
}

// ── Persona lenses ──────────────────────────────────────────────────────

function buildPersonas(
  latest: LatestEodRow,
  line: number | null,
  priorConsolTop: number | null,
  recentFloor: number | null,
  ema50Weekly: number | null,
  event: GlEvent,
): PersonaEntries {
  const close = latest.close;
  const inRange = (p: number | null | undefined): number | null => {
    if (p == null || !Number.isFinite(p) || close <= 0) return null;
    const ratio = p / close;
    if (ratio < 0.70 || ratio > 1.45) return null;
    return p;
  };

  const ltInvestor: PersonaEntry[] = [
    {
      entryNo: 1,
      price: inRange(line),
      label: 'The Golden Line',
      rationale: event === 'BREAKOUT'
        ? 'The 150-day mean the close just reclaimed. Historically the first place the market comes back to test a reclaim; the line holding on light volume is what turns a reclaim into a trend.'
        : 'The 150-day mean price just came back to and held. A second, quieter touch here has historically been the higher-probability read than the first.',
    },
    {
      entryNo: 2,
      price: inRange(recentFloor),
      label: event === 'BREAKOUT' ? 'Base floor' : 'Retest floor',
      rationale: event === 'BREAKOUT'
        ? 'The prior 4-week low — the last leg of the base beneath the reclaim. Relevant only if the line gives way while the base itself stays intact.'
        : 'The prior 4-week low the retest probed. Below it the hold is over; above it the line has a floor beneath it.',
    },
    {
      entryNo: 3,
      price: inRange(ema50Weekly),
      label: 'Weekly structural line',
      rationale: 'The weekly 50 EMA. When a reclaim of the daily 150-mean is real, the weekly line historically turns up within a quarter; price returning to it fast reads as a failed reclaim.',
    },
  ];

  const swingTrader: PersonaEntry[] = [
    {
      entryNo: 1,
      price: inRange(latest.pivot_r1),
      label: 'Continuation zone',
      rationale: 'Above the daily pivot R1 with rvol holding. The reclaim continuing through R1 is the fastest-resolving read on this pair.',
    },
    {
      entryNo: 2,
      price: inRange(priorConsolTop),
      label: 'Consolidation top',
      rationale: 'The prior 8-week close high. Clearing it puts the reclaim above the whole base; stalling under it on rising volume has historically read as supply.',
    },
    {
      entryNo: 3,
      price: inRange(pickBest(latest.pivot_s1, line, Math.max)),
      label: 'Line-loss guard',
      rationale: 'Daily pivot S1 or the line itself, whichever is higher. The setup remains active only above this — a close back under the line on volume historically marked the reclaim as failed.',
    },
  ];

  return { ltInvestor, swingTrader };
}

// ── What Confirms ───────────────────────────────────────────────────────

function buildWhatConfirms(latest: LatestEodRow, weekly: WeeklyBar[], line: number | null, event: GlEvent): WhatConfirmsItem[] {
  const latestWeek = weekly[weekly.length - 1] ?? null;
  const items: WhatConfirmsItem[] = [];
  const dist = distFromLine(latest, line);

  // 1. Close above the line
  items.push({
    label: 'Close above the Golden Line',
    state: check(dist != null ? dist > 0 : null),
    explain: dist != null && line != null
      ? `Close ${fmt(latest.close)} vs 150-day mean ${fmt(line)} (${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%).`
      : 'sma_150 needs 150 daily bars; not available for this listing yet.',
  });

  // 2. The event bar itself — the gl_events step stamps it
  items.push({
    label: event === 'BREAKOUT' ? 'Reclaim stamped on this bar' : 'Retest stamped on this bar',
    state: check(latest.gl_event != null ? latest.gl_event === event : null),
    explain: latest.gl_event != null
      ? (latest.gl_event === event
          ? `gl_event = ${event} on ${latest.trade_date}.`
          : `Latest bar reads ${latest.gl_event} — the ${event.toLowerCase()} was an earlier session.`)
      : 'No Golden Line event on the latest bar (the gl_events step stamps BREAKOUT / RETEST nightly).',
  });

  // 3. Participation on the bar: volume-drive or accumulation dot
  const drive = latest.dot_svd === true || latest.dot_sbd === true;
  items.push({
    label: 'Volume Drive or Accumulation bar',
    state: check(latest.dot_svd != null || latest.dot_sbd != null ? drive : null),
    explain: drive
      ? `${latest.dot_svd ? 'Volume Drive' : 'Accumulation'} dot on the bar — the line was crossed on real participation.`
      : 'No SVD / SBD dot on the latest bar.',
  });

  // 4. Retest only: sessions held before the retest. Breakout: prior sessions
  //    above are structurally 1, so the slot carries rvol instead.
  if (event === 'RETEST') {
    const held = latest.gl_days_above;
    items.push({
      label: `Held ≥ ${RETEST_MIN_HOLD} sessions above the line`,
      state: check(held != null ? held >= RETEST_MIN_HOLD : null),
      explain: held != null
        ? `${held} consecutive session${held === 1 ? '' : 's'} closed above the line, this one included.`
        : 'gl_days_above not stamped for this bar.',
    });
  } else {
    items.push({
      label: 'Relative volume ≥ 1.5×',
      state: check(latest.rvol != null ? latest.rvol >= 1.5 : null),
      explain: latest.rvol != null
        ? `rvol ${latest.rvol.toFixed(2)}× the 20-day norm.`
        : 'rvol not computed for this bar.',
    });
  }

  // 5. Delivery participation
  items.push({
    label: 'Delivery ≥ 35% (not intraday churn)',
    state: check(latest.delivery_pct != null ? latest.delivery_pct >= 35 : null),
    explain: latest.delivery_pct != null
      ? `Delivery ${latest.delivery_pct.toFixed(0)}% of volume — the crossing was taken home, not day-traded.`
      : 'Delivery % unavailable (BSE or young listing).',
  });

  // 6. Weekly structure agrees
  const ema50w = smaFromEnd(weekly, 50, (b) => b.close);
  items.push({
    label: 'Weekly close above the 50-week line',
    state: check(latestWeek != null && ema50w != null ? latestWeek.close > ema50w : null),
    explain: latestWeek != null && ema50w != null
      ? `Weekly close ${fmt(latestWeek.close)} vs 50-week mean ${fmt(ema50w)}.`
      : 'Need at least 50 weekly bars for the structural line.',
  });

  // 7. RS top half
  items.push({
    label: 'Relative strength in top half',
    state: check(latest.rs_percentile != null ? latest.rs_percentile >= 50 : null),
    explain: latest.rs_percentile != null
      ? `RS percentile ${latest.rs_percentile.toFixed(0)}. A reclaim from a base rarely starts in the top quartile; the top half is the bar.`
      : 'RS percentile not yet computed for this bar.',
  });

  // Weekly volume — informational, shared with the other price-action adapters.
  const priorVolAvg10 = smaFromEnd(trailingWindow(weekly, 11).slice(0, -1), 10, (b) => b.volume);
  items.push({
    label: 'Weekly volume ≥ 1.2× 10-week avg',
    state: check(latestWeek?.volume != null && priorVolAvg10 != null && priorVolAvg10 > 0
      ? (latestWeek.volume / priorVolAvg10) >= 1.2
      : null),
    explain: priorVolAvg10 != null && latestWeek?.volume != null && priorVolAvg10 > 0
      ? `Weekly volume ${(latestWeek.volume / priorVolAvg10).toFixed(2)}× the prior 10-week average.`
      : 'Need at least 11 weekly bars for a 10-week volume lookback.',
  });

  return items;
}

function check(v: boolean | null): 'met' | 'pending' | 'failed' {
  if (v == null) return 'pending';
  return v ? 'met' : 'failed';
}

function fmt(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

// ── Entry Zones + Horizontal Lines ──────────────────────────────────────

function buildEntryZones(personas: PersonaEntries): EntryZoneAnnotation[] {
  const zones: EntryZoneAnnotation[] = [];
  const push = (p: PersonaEntry, persona: 'lt' | 'swing') => {
    if (p.price == null || !Number.isFinite(p.price)) return;
    const half = p.price * ZONE_WIDTH;
    zones.push({
      priceLow: p.price - half,
      priceHigh: p.price + half,
      label: `${persona === 'lt' ? 'LT' : 'Swing'} E${p.entryNo}: ${p.label}`,
      persona,
      tone: 'bull',
    });
  };
  personas.ltInvestor.forEach((p) => push(p, 'lt'));
  personas.swingTrader.forEach((p) => push(p, 'swing'));
  return zones;
}

function buildHorizontalLines(kl: KeyLevels, line: number | null): HorizontalLine[] {
  const lines: HorizontalLine[] = [];
  const push = (price: number | null, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, label, tone });
  };
  push(kl.majorResistance,     'Major Resistance', 'bear');
  push(kl.immediateResistance, 'Immediate Resistance', 'bear');
  push(line,                   'Golden Line (150d)', 'bull');
  push(kl.immediateSupport,    'Immediate Support', 'bull');
  push(kl.ema50Weekly,         '50 EMA (weekly)', 'neutral');
  return lines;
}

// ── Current Situation + Editor's Note ───────────────────────────────────

function buildCurrentSituation(latest: LatestEodRow, whatConfirms: WhatConfirmsItem[], line: number | null, event: GlEvent): CurrentSituation {
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const total = whatConfirms.length;
  const dist = distFromLine(latest, line);

  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (dist != null && dist < 0) { verdict = 'Line lost'; tone = 'bear'; }
  else if (met >= 6) { verdict = event === 'BREAKOUT' ? 'Confirmed reclaim' : 'Confirmed hold'; tone = 'bull'; }
  else if (met >= 4) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 2) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'No read'; tone = 'neutral'; }

  const parts: string[] = [];
  parts.push(`${met} of ${total} criteria met.`);
  if (dist != null) {
    if (dist >= 0) parts.push(`Holding ${dist.toFixed(1)}% above the 150-day mean.`);
    else parts.push(`Back ${Math.abs(dist).toFixed(1)}% below the 150-day mean — the ${event === 'BREAKOUT' ? 'reclaim' : 'hold'} has not held.`);
  }
  if (event === 'RETEST' && latest.gl_days_above != null) {
    parts.push(`${latest.gl_days_above} consecutive sessions above the line.`);
  }
  if (latest.rvol != null) parts.push(`Relative volume ${latest.rvol.toFixed(1)}×.`);

  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}

function buildInvestorTip(latest: LatestEodRow, line: number | null, event: GlEvent): string {
  const dist = distFromLine(latest, line);
  if (dist != null && dist < 0) {
    return 'Price is back under the 150-day mean it crossed. A reclaim that fails inside a few sessions has historically been the base extending, not ending — the next attempt at the line is the read, not this one.';
  }
  if (event === 'BREAKOUT') {
    return 'One close above a seven-month mean is a single bar of story. What has historically separated reclaims that trended from ones that faded is the first return to the line: shrinking volume into it reads as absorption, expanding volume through it reads as supply.';
  }
  return 'A retest that holds is the market agreeing with the reclaim. The tell has historically been volume on the touch — quiet is constructive, a spike through the line is the hold ending — and the count of sessions above the line since is the score.';
}
