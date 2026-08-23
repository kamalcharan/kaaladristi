/**
 * Weakness Confluence (power_sell) — adapter for the Scanner Story Page.
 *
 * Matview gate (migration 170): industry rotating-out or lagging, AND
 * (DISTRIBUTION, or: close < 150 SMA + zone Strong/Mild Bear + flow
 * FRESH_SHORTS/LONG_LIQUIDATION + rvol > 1.5). Ranked by Magic RS asc.
 *
 * SEBI: this is a WEAKNESS READ, never a sell instruction. Lenses are
 * renamed via personaMeta: the Holder Lens reads the levels someone
 * already exposed watches; the Pressure Lens reads where downside
 * pressure historically confirmed or eased. Every zone is a
 * where-the-read-changes reference.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, PersonaEntries, WhatConfirmsItem } from '../setupAdapter';
import { priorMaxFromEnd } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardZones, buildStandardLines, weeklyEma50, rangeGuard, pickBest, check, fmt } from '../adapterUtils';

export const powerSellAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const personas = buildPersonas(latest, weekly, ema50w);
  const cycleLabels = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildStandardZones(personas),
    horizontalLines: buildStandardLines(keyLevels),
  };

  const { phase, tone } = derivePhase(met);
  const currentSituation = buildSituation(latest, met, whatConfirms.length);

  const data: SetupData = {
    setupKey: 'power_sell',
    setupLabel: 'Weakness Confluence',
    header: {
      symbol: identity.symbol,
      companyName: identity.company_name,
      exchange: identity.exchange,
      industry: identity.industry,
      close: latest.close,
      pctChng: latest.pct_chng,
      rsPercentile: latest.rs_percentile,
      phase,
      phaseTone: tone,
    },
    keyLevels,
    currentSituation,
    chartAnnotations,
    personas,
    whatConfirms,
    personaMeta: {
      lt: {
        heading: 'Holder Lens',
        sub: 'Weekly · exposure',
        intent: 'Reads the levels someone already exposed watches. Each zone is where the weakness read has historically strengthened or been invalidated — not an instruction.',
      },
      swing: {
        heading: 'Pressure Lens',
        sub: 'Daily · downside',
        intent: 'Reads where downside pressure historically confirmed or eased. Zones closer to the last bar, faster to resolve.',
      },
    },
    investorTip:
      'Weakness confluence mirrors its bullish twin: it is a COUNT of independent negative signals, and it historically unwound the same way — one signal at a time. A reclaim of the 150 SMA with the flow flipping constructive has been the cleanest invalidation of this read.',
  };
  return data;
};

function derivePhase(met: number): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  if (met >= 5) return { phase: 'Full weakness confluence', tone: 'bear' };
  if (met >= 3) return { phase: 'Weakness building', tone: 'bear' };
  if (met >= 2) return { phase: 'Partial signals', tone: 'neutral' };
  return { phase: 'Signals easing', tone: 'neutral' };
}

function buildPersonas(latest: LatestEodRow, weekly: Parameters<SetupAdapter>[0], ema50w: number | null): PersonaEntries {
  const inRange = rangeGuard(latest.close);
  const shelf = priorMaxFromEnd(weekly, 20, (b) => b.high);
  const consol = priorMaxFromEnd(weekly, 8, (b) => b.close);

  return {
    ltInvestor: [
      {
        entryNo: 1,
        price: inRange(latest.sma_150),
        label: 'Invalidation line',
        rationale: 'The 150 SMA. A weekly close back above it with constructive flow has historically invalidated the weakness read — the level a holder watches first.',
      },
      {
        entryNo: 2,
        price: inRange(ema50w),
        label: 'Structural line',
        rationale: 'The weekly 50 EMA. Price rejecting from below it keeps the weakness read intact; reclaiming it starts the repair story.',
      },
      {
        entryNo: 3,
        price: inRange(shelf),
        label: 'Overhead supply zone',
        rationale: 'The prior 20-week high — the supply zone above. Weak names have historically stalled here even in relief phases.',
      },
    ],
    swingTrader: [
      {
        entryNo: 1,
        price: inRange(latest.pivot_s1),
        label: 'Pressure-confirm zone',
        rationale: 'Below the daily pivot S1 with rvol elevated — the fastest confirmation that the downside pressure is active.',
      },
      {
        entryNo: 2,
        price: inRange(latest.pivot_pp),
        label: 'Mid-range zone',
        rationale: 'The daily pivot. Relief attempts that die here on thin volume have historically kept the weakness read alive.',
      },
      {
        entryNo: 3,
        price: inRange(pickBest(latest.pivot_r1, consol, Math.min)),
        label: 'Pressure-off zone',
        rationale: 'Daily pivot R1 / the prior consolidation top. Above this the pressure read eases — the zone where this preset historically stopped applying.',
      },
    ],
  };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'Distribution signature present',
      state: check(latest.accum_distrib != null ? latest.accum_distrib === 'DISTRIBUTION' : null),
      explain: latest.accum_distrib != null
        ? `accum/distrib reads ${latest.accum_distrib}.`
        : 'Signature not computed for this bar.',
    },
    {
      label: 'Below the 150 SMA',
      state: check(latest.sma_150 != null ? latest.close < latest.sma_150 : null),
      explain: latest.sma_150 != null
        ? `Close ${fmt(latest.close)} vs 150 SMA ${fmt(latest.sma_150)}.`
        : '150 SMA not yet available (young listing).',
    },
    {
      label: 'Magic RS zone bearish',
      state: check(latest.magic_rs_zone != null
        ? ['Strong Bear', 'Mild Bear'].includes(latest.magic_rs_zone)
        : null),
      explain: latest.magic_rs_zone != null
        ? `Zone: ${latest.magic_rs_zone}. The scan gates on Strong/Mild Bear.`
        : 'Magic RS zone not computed.',
    },
    {
      label: 'Order flow deteriorating',
      state: check(latest.flow_type != null
        ? ['FRESH_SHORTS', 'LONG_LIQUIDATION'].includes(latest.flow_type)
        : null),
      explain: latest.flow_type != null
        ? `Flow: ${latest.flow_type.replace(/_/g, ' ').toLowerCase()}.`
        : 'Flow type not computed.',
    },
    {
      label: 'Relative volume > 1.5×',
      state: check(latest.rvol != null ? latest.rvol > 1.5 : null),
      explain: latest.rvol != null
        ? `rvol ${latest.rvol.toFixed(2)}× — weakness on volume carries more weight than drift.`
        : 'rvol not computed.',
    },
    {
      label: 'Relative strength in bottom half',
      state: check(latest.rs_percentile != null ? latest.rs_percentile <= 50 : null),
      explain: latest.rs_percentile != null
        ? `RS percentile ${latest.rs_percentile.toFixed(0)}.`
        : 'RS percentile not yet computed for this bar.',
    },
  ];
}

function buildSituation(latest: LatestEodRow, met: number, total: number): CurrentSituation {
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Weakness confirmed'; tone = 'bear'; }
  else if (met >= 3) { verdict = 'Deteriorating'; tone = 'bear'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'Signals absent'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} weakness signals present.`];
  if (latest.magic_rs_zone) parts.push(`Magic RS zone ${latest.magic_rs_zone}.`);
  if (latest.flow_type) parts.push(`Flow ${latest.flow_type.replace(/_/g, ' ').toLowerCase()}.`);
  parts.push('The industry gate (rotating-out / lagging) is evaluated by the nightly scan, not on this page.');
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
