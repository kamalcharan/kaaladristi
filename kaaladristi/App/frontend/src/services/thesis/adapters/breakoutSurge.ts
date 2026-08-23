/**
 * Breakout Surge — adapter for the Scanner Story Page.
 *
 * The contrast test for the adapter contract (POA Wave 1): a DAILY
 * momentum preset — "NSE stocks closing above their 20-day high on a
 * green day, ranked by Score 5D" — with no long-base narrative
 * requirement. Where Stage 2 Leaders reads a multi-year structure,
 * Breakout Surge reads a single release of energy and the structure
 * directly beneath it.
 *
 * Persona lenses stay observational (SEBI):
 *   · LT lens  — the structure BENEATH the surge: is there a shelf
 *     worth trusting if the surge holds?
 *   · Swing lens — the surge itself: continuation, mid-range, and the
 *     level whose loss historically ended the move.
 *
 * Cycle labels come from the shared builders (stage-walk → price-shape
 * fallback) — a surge on a recovery archetype still shows its chapters.
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
import { smaFromEnd, priorMaxFromEnd, trailingWindow } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';

const SETUP_KEY = 'breakout_surge';
const SETUP_LABEL = 'Breakout Surge';

const ZONE_WIDTH = 0.015;

export const breakoutSurgeAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = smaFromEnd(weekly, 50, (b) => b.close);
  // ~20 trading days ≈ 4 weekly bars; prior high EXCLUDING the live week
  // is the shelf the surge cleared.
  const shelf = priorMaxFromEnd(weekly, 4, (b) => b.high);
  const priorConsolBase = priorMaxFromEnd(weekly, 8, (b) => b.close);

  const header = buildHeader(latest, identity, shelf);
  const keyLevels = buildKeyLevels(latest, ema50w);
  const personas = buildPersonas(latest, shelf, priorConsolBase, ema50w);
  const whatConfirms = buildWhatConfirms(latest, weekly, shelf);
  const cycleLabels = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildEntryZones(personas),
    horizontalLines: buildHorizontalLines(keyLevels, shelf),
  };
  const currentSituation = buildCurrentSituation(latest, whatConfirms, shelf);

  const data: SetupData = {
    setupKey: SETUP_KEY,
    setupLabel: SETUP_LABEL,
    header,
    keyLevels,
    currentSituation,
    chartAnnotations,
    personas,
    whatConfirms,
    investorTip: buildInvestorTip(latest, shelf),
  };
  return data;
};

// ── Header ──────────────────────────────────────────────────────────────

function buildHeader(latest: LatestEodRow, identity: EquityIdentity, shelf: number | null): SetupHeader {
  const { phase, tone } = derivePhase(latest, shelf);
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

function derivePhase(latest: LatestEodRow, shelf: number | null): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  if (shelf == null || !Number.isFinite(shelf)) return { phase: 'Surge', tone: 'bull' };
  const distPct = ((latest.close - shelf) / shelf) * 100;
  if (distPct < 0) return { phase: 'Surge faded', tone: 'bear' };
  if (distPct <= 3) return { phase: 'Fresh surge', tone: 'bull' };
  if (distPct <= 8) return { phase: 'Follow-through', tone: 'bull' };
  return { phase: 'Extended', tone: 'neutral' };
}

// ── Key Levels ──────────────────────────────────────────────────────────

function buildKeyLevels(latest: LatestEodRow, ema50Weekly: number | null): KeyLevels {
  const majorRes = pickBest(latest.pivot_r2, latest.w52_high, Math.min);
  const strongSup = pickBest(latest.pivot_s2, latest.sma_150, Math.max);
  return {
    pivot:               latest.pivot_pp,
    immediateResistance: latest.pivot_r1,
    majorResistance:     majorRes,
    immediateSupport:    latest.pivot_s1,
    strongSupport:       strongSup,
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
  shelf: number | null,
  priorConsolBase: number | null,
  ema50Weekly: number | null,
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
      price: inRange(shelf),
      label: 'Breakout shelf',
      rationale: 'The prior 20-day high the surge cleared. Historically the first zone the market retests — the shelf holding is what separates a surge from a spike.',
    },
    {
      entryNo: 2,
      price: inRange(priorConsolBase),
      label: 'Consolidation top',
      rationale: 'The prior 8-week consolidation top beneath the shelf. A deeper structural reference — relevant only if the shelf gives way while the trend stays intact.',
    },
    {
      entryNo: 3,
      price: inRange(ema50Weekly),
      label: 'Structural line',
      rationale: 'The weekly 50 EMA. When a surge is real, price historically does not see this line again for months; a fast return to it reads as a failed surge.',
    },
  ];

  const swingTrader: PersonaEntry[] = [
    {
      entryNo: 1,
      price: inRange(latest.pivot_r1),
      label: 'Continuation zone',
      rationale: 'Above the daily pivot R1 with rvol holding. The surge continuing through R1 is the fastest-resolving read in this preset.',
    },
    {
      entryNo: 2,
      price: inRange(latest.pivot_pp),
      label: 'Mid-range zone',
      rationale: 'Pullback to the daily pivot. A quiet drift here on shrinking volume historically preceded the second leg.',
    },
    {
      entryNo: 3,
      price: inRange(pickBest(latest.pivot_s1, latest.ema_20, Math.max)),
      label: 'Surge-fail guard',
      rationale: 'Daily pivot S1 or the 20 EMA. The setup remains active only above this — losing it on volume historically marked the surge as over.',
    },
  ];

  return { ltInvestor, swingTrader };
}

// ── What Confirms ───────────────────────────────────────────────────────

function buildWhatConfirms(latest: LatestEodRow, weekly: WeeklyBar[], shelf: number | null): WhatConfirmsItem[] {
  const latestWeek = weekly[weekly.length - 1] ?? null;
  const items: WhatConfirmsItem[] = [];

  // 1. Close above the 20-day (4-week) shelf
  items.push({
    label: 'Close above the 20-day shelf',
    state: check(shelf != null ? latest.close > shelf : null),
    explain: shelf != null
      ? `Close ${fmt(latest.close)} vs prior 4-week high ${fmt(shelf)}.`
      : 'Need at least 5 weekly bars for the shelf lookback.',
  });

  // 2. Green day
  items.push({
    label: 'Surge day closed green',
    state: check(latest.pct_chng != null ? latest.pct_chng > 0 : null),
    explain: latest.pct_chng != null
      ? `Day change ${latest.pct_chng >= 0 ? '+' : ''}${latest.pct_chng.toFixed(2)}%.`
      : 'No day-change value on the latest bar.',
  });

  // 3. Relative volume expansion
  items.push({
    label: 'Relative volume ≥ 1.5×',
    state: check(latest.rvol != null ? latest.rvol >= 1.5 : null),
    explain: latest.rvol != null
      ? `rvol ${latest.rvol.toFixed(2)}× the 20-day norm.`
      : 'rvol not computed for this bar.',
  });

  // 4. Delivery participation
  items.push({
    label: 'Delivery ≥ 35% (not intraday churn)',
    state: check(latest.delivery_pct != null ? latest.delivery_pct >= 35 : null),
    explain: latest.delivery_pct != null
      ? `Delivery ${latest.delivery_pct.toFixed(0)}% of volume — the surge was taken home, not day-traded.`
      : 'Delivery % unavailable (BSE or young listing).',
  });

  // 5. RS top quartile
  items.push({
    label: 'Relative strength in top quartile',
    state: check(latest.rs_percentile != null ? latest.rs_percentile >= 75 : null),
    explain: latest.rs_percentile != null
      ? `RS percentile ${latest.rs_percentile.toFixed(0)}. Top quartile ≥ 75.`
      : 'RS percentile not yet computed for this bar.',
  });

  // 6. Weekly volume confirms
  const priorVolAvg10 = smaFromEnd(trailingWindow(weekly, 11).slice(0, -1), 10, (b) => b.volume);
  items.push({
    label: 'Weekly volume ≥ 1.5× 10-week avg',
    state: check(latestWeek?.volume != null && priorVolAvg10 != null && priorVolAvg10 > 0
      ? (latestWeek.volume / priorVolAvg10) >= 1.5
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

function buildHorizontalLines(kl: KeyLevels, shelf: number | null): HorizontalLine[] {
  const lines: HorizontalLine[] = [];
  const push = (price: number | null, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, label, tone });
  };
  push(kl.majorResistance,     'Major Resistance', 'bear');
  push(kl.immediateResistance, 'Immediate Resistance', 'bear');
  push(shelf,                  'Breakout Shelf', 'bull');
  push(kl.immediateSupport,    'Immediate Support', 'bull');
  push(kl.strongSupport,       'Strong Support', 'bull');
  push(kl.ema50Weekly,         '50 EMA (weekly)', 'neutral');
  return lines;
}

// ── Current Situation + Editor's Note ───────────────────────────────────

function buildCurrentSituation(latest: LatestEodRow, whatConfirms: WhatConfirmsItem[], shelf: number | null): CurrentSituation {
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const total = whatConfirms.length;

  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Confirmed surge'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'No surge read'; tone = 'neutral'; }

  const parts: string[] = [];
  parts.push(`${met} of ${total} surge criteria met.`);
  if (shelf != null && Number.isFinite(shelf)) {
    const distPct = ((latest.close - shelf) / shelf) * 100;
    if (distPct >= 0) parts.push(`Holding ${distPct.toFixed(1)}% above the 20-day shelf it cleared.`);
    else parts.push(`Back ${Math.abs(distPct).toFixed(1)}% below the shelf — the surge has not held.`);
  }
  if (latest.rvol != null) parts.push(`Relative volume ${latest.rvol.toFixed(1)}×.`);
  if (latest.w52_high != null) {
    const distPct = ((latest.close - latest.w52_high) / latest.w52_high) * 100;
    if (Math.abs(distPct) < 2) parts.push('At the 52-week high.');
  }

  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}

function buildInvestorTip(latest: LatestEodRow, shelf: number | null): string {
  if (shelf != null && latest.close < shelf) {
    return 'The surge printed and faded — price is back under the shelf it cleared. Historically these resolve by rebuilding the shelf or rolling over; the shelf line is the tell, not the surge bar.';
  }
  return 'A surge is one bar of story. What historically separated the ones that trended from the ones that spiked is the FIRST pullback: shrinking volume into the shelf reads as absorption, expanding volume through it reads as distribution.';
}
