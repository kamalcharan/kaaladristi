/**
 * Monthly Decliners — adapter for the Scanner Story Page.
 *
 * The mirror of Monthly Movers: this preset selects on close BELOW the previous
 * week's close — week-to-date weakness, not a breakdown through a floor. The
 * same honesty applies in reverse. It is a wide, low-bar filter (1,119 NSE rows
 * on 2026-08-25), so the adapter's job is to show WHERE the decline sits in the
 * structure, not to dress it as a setup.
 *
 * The question worth answering is depth: has price also lost its 20-day floor,
 * or is this a pullback inside a range? Same depth argument the up-side
 * adapters make, pointed downward.
 *
 * Observational throughout — levels are structure with historical behaviour,
 * never instruction (SEBI, D39).
 *
 * See: docs/claude/price-action-matrix-poa.md.
 */

import type {
  SetupAdapter, SetupData, SetupHeader, KeyLevels, CurrentSituation,
  ChartAnnotations, PersonaEntries, PersonaEntry, WhatConfirmsItem,
  EntryZoneAnnotation, HorizontalLine, WeeklyBar, LatestEodRow, EquityIdentity,
} from '../setupAdapter';
import { smaFromEnd, priorMinFromEnd, trailingWindow } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';

const SETUP_KEY = 'monthly_decliners';
const SETUP_LABEL = 'Monthly Decliners';
const PERIOD_WORD = 'month';
const PRIOR_LOW_BARS = 4;   // ~4 weekly bars = one month
const ZONE_WIDTH = 0.015;

export const monthlyDeclinersAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = smaFromEnd(weekly, 50, (b) => b.close);
  const refClose = latest.prev_month_close;
  const floorLvl = latest.breakdown_level;
  const priorPeriodLow = priorMinFromEnd(weekly, PRIOR_LOW_BARS, (b) => b.low);

  const keyLevels = buildKeyLevels(latest, ema50w);
  const personas = buildPersonas(latest, refClose, floorLvl, ema50w);
  const whatConfirms = buildWhatConfirms(latest, weekly, refClose, priorPeriodLow, floorLvl, ema50w);

  const data: SetupData = {
    setupKey: SETUP_KEY,
    setupLabel: SETUP_LABEL,
    header: buildHeader(latest, identity, refClose),
    keyLevels,
    currentSituation: buildCurrentSituation(latest, whatConfirms, refClose, floorLvl),
    chartAnnotations: {
      cycleLabels: buildCycleLabels(weekly),
      entryZones: buildEntryZones(personas),
      horizontalLines: buildHorizontalLines(keyLevels, refClose, floorLvl),
    } as ChartAnnotations,
    personas,
    whatConfirms,
    investorTip: buildInvestorTip(latest, floorLvl),
  };
  return data;
};

function buildHeader(latest: LatestEodRow, identity: EquityIdentity, refClose: number | null): SetupHeader {
  const pct = latest.pct_mtd;
  let phase = 'Decline';
  let tone: 'bull' | 'bear' | 'neutral' = 'bear';
  if (pct == null || refClose == null) { phase = 'Decline'; tone = 'neutral'; }
  else if (pct > 0) { phase = `Back above last ${PERIOD_WORD}`; tone = 'neutral'; }
  else if (pct > -2) { phase = 'Shallow drift'; tone = 'neutral'; }
  else if (pct > -6) { phase = 'Decline'; tone = 'bear'; }
  else { phase = 'Steep decline'; tone = 'bear'; }
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

function pick(a: number | null, b: number | null, combine: (x: number, y: number) => number): number | null {
  if (a != null && b != null) return combine(a, b);
  return a ?? b;
}

function buildKeyLevels(latest: LatestEodRow, ema50Weekly: number | null): KeyLevels {
  return {
    pivot: latest.pivot_pp,
    immediateResistance: latest.pivot_r1,
    majorResistance: pick(latest.pivot_r2, latest.sma_50, Math.min),
    immediateSupport: latest.pivot_s1,
    strongSupport: pick(latest.pivot_s2, latest.w52_low, Math.max),
    ema50Weekly,
  };
}

function buildPersonas(
  latest: LatestEodRow,
  refClose: number | null,
  floorLvl: number | null,
  ema50Weekly: number | null,
): PersonaEntries {
  const close = latest.close;
  const inRange = (p: number | null | undefined): number | null => {
    if (p == null || !Number.isFinite(p) || close <= 0) return null;
    const ratio = p / close;
    return ratio < 0.70 || ratio > 1.45 ? null : p;
  };

  const ltInvestor: PersonaEntry[] = [
    {
      entryNo: 1,
      price: inRange(floorLvl),
      label: '20-day floor',
      rationale: 'The lowest close of the prior 20 sessions. While price holds above it the decline is a pullback inside a range; losing it is what historically separated a wobble from a structural break.',
    },
    {
      entryNo: 2,
      price: inRange(ema50Weekly),
      label: 'Structural line',
      rationale: 'The weekly 50 EMA. Declines that stopped above this line historically stayed inside an intact trend; ones that cut through it changed the trend question entirely.',
    },
    {
      entryNo: 3,
      price: inRange(latest.w52_low),
      label: '52-week floor',
      rationale: 'The deepest reference in view. Relevant only once the two levels above have already given way.',
    },
  ];

  const swingTrader: PersonaEntry[] = [
    {
      entryNo: 1,
      price: inRange(refClose),
      label: `Last ${PERIOD_WORD}’s close`,
      rationale: 'The level this screener measures from. Reclaiming it removes the row from this list on the next refresh — the fastest-resolving read here.',
    },
    {
      entryNo: 2,
      price: inRange(latest.pivot_pp),
      label: 'Mid-range zone',
      rationale: 'The daily pivot. A decline stalling here on shrinking volume reads differently from one accelerating through it.',
    },
    {
      entryNo: 3,
      price: inRange(latest.pivot_s1),
      label: 'Lower guard',
      rationale: 'Daily pivot S1. Losing it on expanding volume has historically extended a decline rather than ended it.',
    },
  ];

  return { ltInvestor, swingTrader };
}

function buildWhatConfirms(
  latest: LatestEodRow,
  weekly: WeeklyBar[],
  refClose: number | null,
  priorPeriodLow: number | null,
  floorLvl: number | null,
  ema50Weekly: number | null,
): WhatConfirmsItem[] {
  const latestWeek = weekly[weekly.length - 1] ?? null;
  const items: WhatConfirmsItem[] = [];

  items.push({
    label: `Below last ${PERIOD_WORD}’s close (the list’s own bar)`,
    state: check(refClose != null ? latest.close < refClose : null),
    explain: refClose != null
      ? `Close ${fmt(latest.close)} vs last ${PERIOD_WORD}’s close ${fmt(refClose)}. A low bar — it is a starting filter, not a finding.`
      : `No previous-${PERIOD_WORD} close on this row.`,
  });

  items.push({
    label: `Also below last ${PERIOD_WORD}’s LOW`,
    state: check(priorPeriodLow != null ? latest.close < priorPeriodLow : null),
    explain: priorPeriodLow != null
      ? `Prior ${PERIOD_WORD} low ${fmt(priorPeriodLow)} — the same decline read against the period’s floor rather than its finish.`
      : `Not enough weekly bars for a prior-${PERIOD_WORD} low.`,
  });

  items.push({
    label: 'Also below the 20-day floor (a real breakdown)',
    state: check(floorLvl != null ? latest.close < floorLvl : null),
    explain: floorLvl != null
      ? `20-day breakdown level ${fmt(floorLvl)}. This is the rung that reads as a BREAKDOWN rather than ${PERIOD_WORD}-to-date weakness — depth, not the shallow window, is what carried a signal in the forward tests.`
      : 'breakdown_level not populated for this bar (migration 187 / rolling backfill).',
  });

  items.push({
    label: 'Below the 50 EMA (weekly)',
    state: check(ema50Weekly != null ? latest.close < ema50Weekly : null),
    explain: ema50Weekly != null
      ? `Weekly 50 EMA ${fmt(ema50Weekly)}.`
      : 'Need at least 50 weekly bars for the structural line.',
  });

  items.push({
    label: 'Relative strength in the bottom quartile',
    state: check(latest.rs_percentile != null ? latest.rs_percentile <= 25 : null),
    explain: latest.rs_percentile != null
      ? `RS percentile ${latest.rs_percentile.toFixed(0)}. A decline in a strong-RS name reads differently from one in a weak-RS name.`
      : 'RS percentile not yet computed for this bar.',
  });

  const priorVolAvg10 = smaFromEnd(trailingWindow(weekly, 11).slice(0, -1), 10, (b) => b.volume);
  items.push({
    label: 'Weekly volume >= 1.5x the 10-week average',
    state: check(latestWeek?.volume != null && priorVolAvg10 != null && priorVolAvg10 > 0
      ? (latestWeek.volume / priorVolAvg10) >= 1.5 : null),
    explain: priorVolAvg10 != null && latestWeek?.volume != null && priorVolAvg10 > 0
      ? `Weekly volume ${(latestWeek.volume / priorVolAvg10).toFixed(2)}x the prior 10-week average. A decline on expanding volume is a different event from one on drying volume.`
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
      tone: 'bear',
    });
  };
  personas.ltInvestor.forEach((p) => push(p, 'lt'));
  personas.swingTrader.forEach((p) => push(p, 'swing'));
  return zones;
}

function buildHorizontalLines(kl: KeyLevels, refClose: number | null, floorLvl: number | null): HorizontalLine[] {
  const lines: HorizontalLine[] = [];
  const push = (price: number | null, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, label, tone });
  };
  push(kl.majorResistance, 'Major Resistance', 'bear');
  push(kl.immediateResistance, 'Immediate Resistance', 'bear');
  push(refClose, `Last ${PERIOD_WORD}’s Close`, 'neutral');
  push(floorLvl, '20-Day Floor', 'bear');
  push(kl.immediateSupport, 'Immediate Support', 'bull');
  push(kl.strongSupport, 'Strong Support', 'bull');
  push(kl.ema50Weekly, '50 EMA (weekly)', 'neutral');
  return lines;
}

function buildCurrentSituation(
  latest: LatestEodRow,
  whatConfirms: WhatConfirmsItem[],
  refClose: number | null,
  floorLvl: number | null,
): CurrentSituation {
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const total = whatConfirms.length;
  const brokeFloor = floorLvl != null && latest.close < floorLvl;

  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (brokeFloor && met >= 5) { verdict = 'Breakdown with depth'; tone = 'bear'; }
  else if (brokeFloor) { verdict = 'Floor lost'; tone = 'bear'; }
  else if (met >= 4) { verdict = 'Broad weakness'; tone = 'bear'; }
  else { verdict = 'Period loss only'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} criteria met.`];
  if (refClose != null && refClose > 0) {
    const d = ((latest.close - refClose) / refClose) * 100;
    parts.push(`${Math.abs(d).toFixed(1)} percent ${d < 0 ? 'below' : 'above'} last ${PERIOD_WORD}’s close of ${fmt(refClose)}.`);
  }
  parts.push(brokeFloor
    ? 'Price is also under its 20-day floor — a structural break, not just a soft period.'
    : 'Price still holds its 20-day floor, so this reads as a pullback inside a range rather than a breakdown.');
  if (latest.rvol != null) parts.push(`Relative volume ${latest.rvol.toFixed(1)}x.`);

  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}

function buildInvestorTip(latest: LatestEodRow, floorLvl: number | null): string {
  if (floorLvl != null && latest.close < floorLvl) {
    return 'Price is under both the period reference and its 20-day floor. What historically distinguished a decline that continued from one that turned was volume: expanding through the floor read as distribution, drying up read as exhaustion.';
  }
  return 'Sitting below the period’s reference close is a low bar — a large share of the market clears it on any given day. The depth ladder above (the period low, then the 20-day floor) is what narrows it into something structural.';
}
