/**
 * Stage 2 Leaders — adapter for the Scanner Story Page.
 *
 * See: docs/claude/scanner-story-page-poa.md · Phase 1 · Reusability contract.
 *
 * Reads:
 *   · Latest EOD row (pivots, SMAs, w52, stage, RS %ile)
 *   · Weekly OHLC (last ~5y from km_equity_weekly)
 *   · Equity identity (symbol, exchange, industry)
 *
 * Returns a SetupData shape the ScannerArrivalView renders as-is. No I/O
 * inside — the Phase 4 hook does the fetching and hands us the rows.
 *
 * Rules encoded in this file (all from the POA):
 *
 *   Key levels     — pivot_pp, pivot_r1, min(pivot_r2, w52_high),
 *                    pivot_s1, max(pivot_s2, sma_150), rolling SMA(50)
 *                    over weekly closes.
 *   Cycle labels   — walk weekly `stage` transitions; label contiguous
 *                    runs meeting minimum-length thresholds.
 *   Personas       — LT Investor (3 structural entries) + Swing Trader
 *                    (3 opportunistic entries), prices derived per stock.
 *   What-Confirms  — 6 criteria: weekly close vs 50 EMA, prior 20-week
 *                    high, RS top-quartile, weekly higher-high, weekly
 *                    volume expansion, close above sma_150.
 *   Phase pill     — Setup / Breakout / Continuation / Exhaustion, from
 *                    stage + distance-to-w52-high.
 *   Narrative      — deterministic 2-line read (Phase 2 upgrades this
 *                    to VaNi-generated).
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
  CycleLabel,
  EntryZoneAnnotation,
  HorizontalLine,
  WeeklyBar,
  LatestEodRow,
  EquityIdentity,
} from '../setupAdapter';
import { smaFromEnd, priorMaxFromEnd, trailingWindow } from '../setupAdapter';

// ── Constants ───────────────────────────────────────────────────────────

const SETUP_KEY = 'stage_2_leaders';
const SETUP_LABEL = 'Stage 2 Leaders';

/** Minimum contiguous weeks for a run to earn a cycle label. Tuned from
 *  the reference images (Solara has ~50 weeks of Old Stage 2 + ~60 weeks
 *  of Long Stage 1 — 26 weeks catches genuine runs, ignores noise). */
const MIN_S2_RUN_WEEKS = 26;
const MIN_S4_RUN_WEEKS = 20;
const MIN_S1_RUN_WEEKS = 26;

/** How wide to draw an entry-zone band, as a fraction of the entry
 *  price. 0.015 = ±1.5% envelope — matches the "zone" feel of the
 *  reference images (the entry is a range, not a single price). */
const ZONE_WIDTH = 0.015;

/** Weekly volume expansion multiple for the What-Confirms "volume
 *  breakout" check. 1.5× 10-week avg = the classic Weinstein/Minervini
 *  breakout gate. */
const WEEKLY_VOL_EXPANSION_X = 1.5;

// ── Adapter ─────────────────────────────────────────────────────────────

export const stage2LeadersAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = smaFromEnd(weekly, 50, (b) => b.close);   // weekly 50 EMA proxy (SMA — close enough for a visible line)

  const header       = buildHeader(latest, identity);
  const keyLevels    = buildKeyLevels(latest, ema50w);
  const personas     = buildPersonas(latest, weekly, ema50w);
  const whatConfirms = buildWhatConfirms(latest, weekly, ema50w);
  const cycleLabels  = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildEntryZones(personas),
    horizontalLines: buildHorizontalLines(keyLevels),
  };
  const currentSituation = buildCurrentSituation(latest, whatConfirms, ema50w);
  const setupPhase = derivePhaseAndTone(latest);
  header.phase = setupPhase.phase;
  header.phaseTone = setupPhase.tone;

  const data: SetupData = {
    setupKey: SETUP_KEY,
    setupLabel: SETUP_LABEL,
    header,
    keyLevels,
    currentSituation,
    chartAnnotations,
    personas,
    whatConfirms,
  };
  return data;
};

// ── Header ──────────────────────────────────────────────────────────────

function buildHeader(latest: LatestEodRow, identity: EquityIdentity): SetupHeader {
  return {
    symbol: identity.symbol,
    companyName: identity.company_name,
    exchange: identity.exchange,
    industry: identity.industry,
    close: latest.close,
    pctChng: latest.pct_chng,
    rsPercentile: latest.rs_percentile,
    phase: 'Setup',       // overwritten by derivePhaseAndTone
    phaseTone: 'neutral',
  };
}

function derivePhaseAndTone(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const stage = latest.stage ?? '';
  const close = latest.close;
  const w52h = latest.w52_high ?? Infinity;
  const sma50 = latest.sma_50;

  if (stage === 'S2') {
    if (w52h && close >= w52h * 0.97) return { phase: 'Breakout',     tone: 'bull' };
    if (sma50 && close <= sma50 * 1.02) return { phase: 'Exhaustion',  tone: 'neutral' };
    return { phase: 'Continuation', tone: 'bull' };
  }
  if (stage === 'S2_CANDIDATE') return { phase: 'Setup', tone: 'neutral' };
  if (stage === 'S1' || stage === 'S1_CANDIDATE') return { phase: 'Re-accumulation', tone: 'neutral' };
  if (stage === 'S3') return { phase: 'Topping', tone: 'bear' };
  if (stage === 'S4') return { phase: 'Markdown', tone: 'bear' };
  return { phase: 'Cold', tone: 'neutral' };
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

// ── Persona Entries ─────────────────────────────────────────────────────

function buildPersonas(latest: LatestEodRow, weekly: WeeklyBar[], ema50Weekly: number | null): PersonaEntries {
  const priorWeekHigh20 = priorMaxFromEnd(weekly, 20, (b) => b.high);
  const priorConsolBase = priorMaxFromEnd(weekly, 8,  (b) => b.close);

  const ltInvestor: PersonaEntry[] = [
    {
      entryNo: 1,
      price: priorWeekHigh20,
      label: 'Best historical',
      rationale: 'Weekly breakout above the prior 20-week high with a weekly-close + volume expansion. Highest-probability structural entry.',
    },
    {
      entryNo: 2,
      price: ema50Weekly,
      label: 'Early / higher-risk',
      rationale: 'Pullback reclaim of the weekly 50 EMA — earlier trigger, wider risk. Requires the trend to already be structurally intact.',
    },
    {
      entryNo: 3,
      price: priorConsolBase,
      label: 'Add-on',
      rationale: 'Continuation base — pullback into the prior 8-week consolidation top and hold. Ideal for scaling into an existing position.',
    },
  ];

  const swingTrader: PersonaEntry[] = [
    {
      entryNo: 1,
      price: latest.pivot_r1,
      label: 'Breakout',
      rationale: 'Break above the daily pivot R1 with rvol > 1.5. Fastest-resolving swing entry.',
    },
    {
      entryNo: 2,
      price: latest.pivot_pp,
      label: 'Mid-range pullback',
      rationale: 'Continuation entry on a pullback to the daily pivot PP. Tighter stop than the breakout entry.',
    },
    {
      entryNo: 3,
      price: pickBest(latest.pivot_s1, latest.ema_20, Math.max),
      label: 'Support test',
      rationale: 'Deeper pullback to the daily pivot S1 or 20 EMA. Still in Stage 2 territory — good risk/reward, needs confirmation.',
    },
  ];

  return { ltInvestor, swingTrader };
}

// ── What Confirms ───────────────────────────────────────────────────────

function buildWhatConfirms(latest: LatestEodRow, weekly: WeeklyBar[], ema50Weekly: number | null): WhatConfirmsItem[] {
  const latestWeek = weekly[weekly.length - 1] ?? null;
  const items: WhatConfirmsItem[] = [];

  // 1. Weekly close above 50 EMA
  items.push({
    label: 'Weekly close above 50 EMA',
    state: check(latestWeek?.close != null && ema50Weekly != null ? latestWeek.close > ema50Weekly : null),
    explain: ema50Weekly != null
      ? `Weekly close ${fmt(latestWeek?.close)} vs 50 EMA ${fmt(ema50Weekly)}.`
      : 'Need at least 50 weekly bars to compute the 50 EMA.',
  });

  // 2. Weekly close above prior 20-week high
  const prior20h = priorMaxFromEnd(weekly, 20, (b) => b.high);
  items.push({
    label: 'Weekly close breaks prior 20-week high',
    state: check(latestWeek?.close != null && prior20h != null ? latestWeek.close > prior20h : null),
    explain: prior20h != null
      ? `Weekly close ${fmt(latestWeek?.close)} vs prior 20-week high ${fmt(prior20h)}.`
      : 'Need at least 21 weekly bars for a 20-week lookback.',
  });

  // 3. RS percentile in top quartile
  items.push({
    label: 'Relative strength in top quartile',
    state: check(latest.rs_percentile != null ? latest.rs_percentile >= 75 : null),
    explain: latest.rs_percentile != null
      ? `RS percentile ${latest.rs_percentile.toFixed(0)}. Top quartile ≥ 75.`
      : 'RS percentile not yet computed for this bar.',
  });

  // 4. Weekly higher high vs 22-week lookback
  const prior22h = priorMaxFromEnd(weekly, 22, (b) => b.high);
  items.push({
    label: 'Higher high vs 22-week lookback',
    state: check(latestWeek?.high != null && prior22h != null ? latestWeek.high > prior22h : null),
    explain: prior22h != null
      ? `Weekly high ${fmt(latestWeek?.high)} vs 22-week prior high ${fmt(prior22h)}.`
      : 'Need at least 23 weekly bars for a 22-week lookback.',
  });

  // 5. Weekly volume ≥ 1.5× 10-week avg
  const priorVolAvg10 = smaFromEnd(trailingWindow(weekly, 11).slice(0, -1), 10, (b) => b.volume);
  items.push({
    label: `Weekly volume ≥ ${WEEKLY_VOL_EXPANSION_X}× 10-week avg`,
    state: check(latestWeek?.volume != null && priorVolAvg10 != null && priorVolAvg10 > 0
      ? (latestWeek.volume / priorVolAvg10) >= WEEKLY_VOL_EXPANSION_X
      : null),
    explain: priorVolAvg10 != null && latestWeek?.volume != null && priorVolAvg10 > 0
      ? `Weekly volume ${(latestWeek.volume / priorVolAvg10).toFixed(2)}× the prior 10-week average.`
      : 'Need at least 11 weekly bars for a 10-week volume lookback.',
  });

  // 6. Above sma_150 (long-term filter)
  items.push({
    label: 'Above 150 SMA (long-term filter)',
    state: check(latest.sma_150 != null ? latest.close > latest.sma_150 : null),
    explain: latest.sma_150 != null
      ? `Close ${fmt(latest.close)} vs 150 SMA ${fmt(latest.sma_150)}.`
      : '150 SMA not yet available (young listing).',
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

// ── Cycle Labels ────────────────────────────────────────────────────────

function buildCycleLabels(weekly: WeeklyBar[]): CycleLabel[] {
  if (weekly.length === 0) return [];
  const labels: CycleLabel[] = [];
  let runStart = 0;
  let runStage = weekly[0].stage ?? '';
  const emit = (from: number, to: number, stage: string) => {
    const length = to - from + 1;
    const rule = STAGE_LABEL_RULES[stage];
    if (!rule || length < rule.minWeeks) return;
    labels.push({
      from: weekly[from].trade_date,
      to:   weekly[to].trade_date,
      label: rule.label,
      tone:  rule.tone,
    });
  };
  for (let i = 1; i < weekly.length; i++) {
    const s = weekly[i].stage ?? '';
    if (s === runStage) continue;
    emit(runStart, i - 1, runStage);
    runStart = i;
    runStage = s;
  }
  // Final run
  emit(runStart, weekly.length - 1, runStage);
  return labels;
}

const STAGE_LABEL_RULES: Record<string, { label: string; tone: 'bull' | 'bear' | 'neutral'; minWeeks: number }> = {
  'S1':           { label: 'Long Stage 1 Re-accumulation', tone: 'neutral', minWeeks: MIN_S1_RUN_WEEKS },
  'S1_CANDIDATE': { label: 'Basing (Stage 1 Candidate)',   tone: 'neutral', minWeeks: MIN_S1_RUN_WEEKS },
  'S2_CANDIDATE': { label: 'Stage 2 Breakout Attempt',     tone: 'bull',    minWeeks: 4 },
  'S2':           { label: 'Stage 2 Uptrend',              tone: 'bull',    minWeeks: MIN_S2_RUN_WEEKS },
  'S3':           { label: 'Stage 3 Topping',              tone: 'neutral', minWeeks: 12 },
  'S4':           { label: 'Stage 4 Markdown',             tone: 'bear',    minWeeks: MIN_S4_RUN_WEEKS },
};

// ── Entry Zones (chart bands) ───────────────────────────────────────────

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

// ── Horizontal Lines (chart key-level rules) ────────────────────────────

function buildHorizontalLines(kl: KeyLevels): HorizontalLine[] {
  const lines: HorizontalLine[] = [];
  const push = (price: number | null, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, label, tone });
  };
  push(kl.majorResistance,     'Major Resistance',     'bear');
  push(kl.immediateResistance, 'Immediate Resistance', 'bear');
  push(kl.pivot,               'Pivot',                'neutral');
  push(kl.ema50Weekly,         '50 EMA (weekly)',      'neutral');
  push(kl.immediateSupport,    'Immediate Support',    'bull');
  push(kl.strongSupport,       'Strong Support',       'bull');
  return lines;
}

// ── Current Situation (Phase 1 = deterministic; Phase 2 = VaNi) ─────────

function buildCurrentSituation(latest: LatestEodRow, whatConfirms: WhatConfirmsItem[], ema50Weekly: number | null): CurrentSituation {
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const total = whatConfirms.length;

  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Confirmed';   tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch';   tone = 'neutral'; }
  else { verdict = 'Wait for setup'; tone = 'neutral'; }

  const parts: string[] = [];
  parts.push(`${met} of ${total} confirmation criteria met.`);

  const stage = latest.stage ?? 'unclassified';
  if (ema50Weekly != null) {
    const distPct = ((latest.close - ema50Weekly) / ema50Weekly) * 100;
    if (Math.abs(distPct) < 2) {
      parts.push(`Trading around the weekly 50 EMA (${distPct.toFixed(1)}%) — a structural pivot line.`);
    } else if (distPct >= 2) {
      parts.push(`Trading ${distPct.toFixed(1)}% above the weekly 50 EMA.`);
    } else {
      parts.push(`Trading ${Math.abs(distPct).toFixed(1)}% below the weekly 50 EMA — below the structural line.`);
    }
  }
  if (latest.w52_high != null) {
    const distPct = ((latest.close - latest.w52_high) / latest.w52_high) * 100;
    if (Math.abs(distPct) < 2) parts.push(`At the 52-week high — breakout territory.`);
    else if (distPct >= 0) parts.push(`Already above prior 52-week high (extended).`);
    else parts.push(`${Math.abs(distPct).toFixed(1)}% below the 52-week high.`);
  }
  parts.push(`Weinstein stage: ${stage}.`);

  return {
    verdict,
    verdictTone: tone,
    narrative: parts.join(' '),
  };
}
