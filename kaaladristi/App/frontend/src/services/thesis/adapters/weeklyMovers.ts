/**
 * Weekly Movers — adapter for the Scanner Story Page.
 *
 * The honest case in the adapter family. Every other preset here narrates a
 * SELECTION: a shelf cleared, a base broken, delivery absorbed. Weekly Movers
 * selects on "trading above last week's close", which is period-to-date
 * momentum, not a breakout — and the measurement says so plainly:
 *
 *   On 2026-08-24, NSE close >= 50, mcap >= 14k Cr (universe 475):
 *     above previous week's CLOSE ....... 199 rows  (42% of the universe)
 *     above previous week's HIGH .........  41 rows
 *     above the 20-WEEK high ............   44 rows
 *
 *   Forward-tested Jan 2025 - Jul 2026 against the close 22 sessions later,
 *   exclusive tiers: a 5-day high alone ran 48.6% up and a 22-day high 47.4%,
 *   against a 48.5% baseline. Depth is what carried the signal (66-day high:
 *   53.6%), not the shallow window.
 *
 * So this adapter deliberately does NOT dress a weekly gain as a setup. Its job
 * is to show the reader WHERE the advance sits in the structure and how much of
 * the market shares it, so a low bar reads as a low bar. The one question worth
 * answering here is depth: did the week's advance also clear the 20-day shelf?
 *
 * Persona lenses stay observational (SEBI - D39): they describe structure and
 * historical behaviour, never a recommendation.
 *
 * See: docs/claude/price-action-matrix-poa.md sections 3a and 3b.
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

const SETUP_KEY = 'weekly_movers';
const SETUP_LABEL = 'Weekly Movers';

const ZONE_WIDTH = 0.015;

export const weeklyMoversAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = smaFromEnd(weekly, 50, (b) => b.close);
  // The reference this preset actually selects on.
  const refClose = finite(latest.prev_week_close);
  // Prior week's HIGH — the first stricter rung above the preset's own bar.
  const priorWeekHigh = priorMaxFromEnd(weekly, 1, (b) => b.high);
  // 20-week high — the rung that reads as a genuine weekly breakout.
  const high20w = priorMaxFromEnd(weekly, 20, (b) => b.high);

  const header = buildHeader(latest, identity);
  const keyLevels = buildKeyLevels(latest, ema50w);
  const personas = buildPersonas(latest, refClose, priorWeekHigh, ema50w);
  const whatConfirms = buildWhatConfirms(latest, weekly, refClose, priorWeekHigh, high20w);
  const cycleLabels = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildEntryZones(personas),
    horizontalLines: buildHorizontalLines(keyLevels, refClose, priorWeekHigh, high20w),
  };

  const data: SetupData = {
    setupKey: SETUP_KEY,
    setupLabel: SETUP_LABEL,
    header,
    keyLevels,
    currentSituation: buildCurrentSituation(latest, whatConfirms, refClose, high20w),
    chartAnnotations,
    personas,
    whatConfirms,
    investorTip: buildInvestorTip(latest, refClose, high20w),
  };
  return data;
};

function finite(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

// ── Header ──────────────────────────────────────────────────────────────

function buildHeader(latest: LatestEodRow, identity: EquityIdentity): SetupHeader {
  const { phase, tone } = derivePhase(latest);
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

/** Phase names the WEEK's travel, never a prediction. */
function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const wtd = finite(latest.pct_wtd);
  if (wtd == null) return { phase: 'Week-to-date', tone: 'neutral' };
  if (wtd <= 0) return { phase: 'Below last week', tone: 'bear' };
  if (wtd < 2) return { phase: 'Early-week gain', tone: 'neutral' };
  if (wtd < 5) return { phase: 'Week-to-date advance', tone: 'bull' };
  return { phase: 'Wide week', tone: 'bull' };
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
  refClose: number | null,
  priorWeekHigh: number | null,
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
      price: inRange(priorWeekHigh),
      label: 'Prior week high',
      rationale: 'The first level above this preset’s own bar. Clearing last week’s HIGH rather than its close narrows the field from roughly 42% of the universe to about 9% — the same advance, read with a stricter rung.',
    },
    {
      entryNo: 2,
      price: inRange(refClose),
      label: 'Last week’s close',
      rationale: 'The reference this list is measured from. Price back beneath it means the week-to-date gain has gone, and the row would leave the screener on the next refresh.',
    },
    {
      entryNo: 3,
      price: inRange(ema50Weekly),
      label: 'Structural line',
      rationale: 'The weekly 50 EMA. A week-to-date gain sitting far above this line is a move inside an established trend; one occurring below it is a bounce inside a downtrend, and the two have historically behaved differently.',
    },
  ];

  const swingTrader: PersonaEntry[] = [
    {
      entryNo: 1,
      price: inRange(latest.pivot_r1),
      label: 'Continuation zone',
      rationale: 'Above the daily pivot R1 with relative volume holding. On a week-to-date read this is the level that separates an advance still being fed from one coasting.',
    },
    {
      entryNo: 2,
      price: inRange(latest.pivot_pp),
      label: 'Mid-range zone',
      rationale: 'Pullback to the daily pivot while still above last week’s close — the week’s gain intact but no longer extending.',
    },
    {
      entryNo: 3,
      price: inRange(pickBest(refClose, latest.ema_20, Math.max)),
      label: 'Week-gain guard',
      rationale: 'Last week’s close or the 20 EMA, whichever is higher. Below this the week-to-date premise is simply no longer true.',
    },
  ];

  return { ltInvestor, swingTrader };
}

// ── What Confirms ───────────────────────────────────────────────────────

function buildWhatConfirms(
  latest: LatestEodRow,
  weekly: WeeklyBar[],
  refClose: number | null,
  priorWeekHigh: number | null,
  high20w: number | null,
): WhatConfirmsItem[] {
  const latestWeek = weekly[weekly.length - 1] ?? null;
  const items: WhatConfirmsItem[] = [];

  // 1. The preset's own bar — deliberately labelled as the low bar it is.
  items.push({
    label: 'Above last week’s close (the list’s own bar)',
    state: check(refClose != null ? latest.close > refClose : null),
    explain: refClose != null
      ? `Close ${fmt(latest.close)} vs last week’s close ${fmt(refClose)}. About 42% of the eligible universe clears this on a typical day — it is a starting filter, not a finding.`
      : 'No previous-week close on this bar (first week of the symbol’s history).',
  });

  // 2-3. The depth ladder — the part that carries information.
  items.push({
    label: 'Also above last week’s HIGH',
    state: check(priorWeekHigh != null ? latest.close > priorWeekHigh : null),
    explain: priorWeekHigh != null
      ? `Prior week high ${fmt(priorWeekHigh)}. Roughly 9% of the universe clears this, against 42% for the close.`
      : 'Need at least 2 weekly bars for a prior-week high.',
  });

  items.push({
    label: 'Also above the 20-week high',
    state: check(high20w != null ? latest.close > high20w : null),
    explain: high20w != null
      ? `20-week high ${fmt(high20w)}. This is the rung that reads as a weekly BREAKOUT rather than weekly momentum — and depth, not the shallow window, is what forward-tested with an edge.`
      : 'Need at least 21 weekly bars for a 20-week lookback.',
  });

  // 4. Day still green — a week-to-date gain can sit on a red day.
  items.push({
    label: 'Latest session closed green',
    state: check(latest.pct_chng != null ? latest.pct_chng > 0 : null),
    explain: latest.pct_chng != null
      ? `Day change ${latest.pct_chng >= 0 ? '+' : ''}${latest.pct_chng.toFixed(2)}%. A week-to-date gain does NOT imply a green day — the two diverge on every session except the week’s first.`
      : 'No day-change value on the latest bar.',
  });

  // 5. Participation.
  items.push({
    label: 'Relative volume ≥ 1.5×',
    state: check(latest.rvol != null ? latest.rvol >= 1.5 : null),
    explain: latest.rvol != null
      ? `rvol ${latest.rvol.toFixed(2)}× the 20-day norm.`
      : 'rvol not computed for this bar.',
  });

  items.push({
    label: 'Delivery ≥ 35% (not intraday churn)',
    state: check(latest.delivery_pct != null ? latest.delivery_pct >= 35 : null),
    explain: latest.delivery_pct != null
      ? `Delivery ${latest.delivery_pct.toFixed(0)}% of volume.`
      : 'Delivery % unavailable (BSE carries none, or a young listing).',
  });

  // 6. Weekly volume behind the advance.
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

function buildHorizontalLines(
  kl: KeyLevels,
  refClose: number | null,
  priorWeekHigh: number | null,
  high20w: number | null,
): HorizontalLine[] {
  const lines: HorizontalLine[] = [];
  const push = (price: number | null, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, label, tone });
  };
  push(kl.majorResistance,     'Major Resistance', 'bear');
  push(high20w,                '20-Week High', 'bear');
  push(kl.immediateResistance, 'Immediate Resistance', 'bear');
  push(priorWeekHigh,          'Prior Week High', 'neutral');
  push(refClose,               'Last Week’s Close', 'bull');
  push(kl.immediateSupport,    'Immediate Support', 'bull');
  push(kl.ema50Weekly,         '50 EMA (weekly)', 'neutral');
  return lines;
}

// ── Current Situation + Editor's Note ───────────────────────────────────

function buildCurrentSituation(
  latest: LatestEodRow,
  whatConfirms: WhatConfirmsItem[],
  refClose: number | null,
  high20w: number | null,
): CurrentSituation {
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const total = whatConfirms.length;
  const clearedDepth = high20w != null && latest.close > high20w;

  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (clearedDepth && met >= 5) { verdict = 'Weekly breakout'; tone = 'bull'; }
  else if (clearedDepth) { verdict = 'Advance with depth'; tone = 'bull'; }
  else if (met >= 4) { verdict = 'Broad weekly advance'; tone = 'neutral'; }
  else { verdict = 'Week-to-date gain only'; tone = 'neutral'; }

  const parts: string[] = [];
  parts.push(`${met} of ${total} criteria met.`);
  const wtd = finite(latest.pct_wtd);
  if (wtd != null) parts.push(`Week-to-date ${wtd >= 0 ? '+' : ''}${wtd.toFixed(2)}%.`);
  if (refClose != null) parts.push(`Measured from last week’s close of ${fmt(refClose)}.`);
  parts.push(clearedDepth
    ? 'The advance also cleared the 20-week high — the depth rung that separates a breakout from weekly momentum.'
    : 'The advance has NOT cleared the 20-week high, so this reads as weekly momentum rather than a breakout.');
  if (latest.rvol != null) parts.push(`Relative volume ${latest.rvol.toFixed(1)}×.`);

  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}

function buildInvestorTip(latest: LatestEodRow, refClose: number | null, high20w: number | null): string {
  if (refClose != null && latest.close < refClose) {
    return 'Price has slipped back under last week’s close, so the premise that put this row on the list is no longer true. On this screener that is not a pullback to watch — it is the signal ending.';
  }
  if (high20w != null && latest.close > high20w) {
    return 'This one clears the depth rung: above last week’s close AND above the 20-week high. Measured over Jan 2025 - Jul 2026, depth is where the forward edge sat — shallow windows read no better than the market.';
  }
  return 'Being above last week’s close is a low bar — roughly 42% of the eligible universe clears it on a typical day, and forward-tested it read no better than the market. Treat this list as a starting field and let the depth ladder above (last week’s high, then the 20-week high) do the narrowing.';
}
