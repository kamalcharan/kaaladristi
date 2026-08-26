/**
 * Strength Confluence (power_buy) — adapter for the Scanner Story Page.
 *
 * Matview gate (migration 170): industry rotating-in or leading, AND
 * (ACCUMULATION, or: close > 150 SMA + Magic RS zone Strong/Mild Bull +
 * flow FRESH_LONGS/SHORT_COVERING + rvol > 1.5). Ranked by Magic RS.
 *
 * The story: several independent positive conditions converging at
 * once — the What-Confirms card IS the thesis here.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

export const powerBuyAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'Weekly close above the prior 20-week high while the confluence holds. The zone where structure and signal agreement have historically met.',
    ema:    'Pullback reclaim of the weekly 50 EMA. Relevant only while most confluence signals stay green — a reclaim with fading signals reads differently.',
    consol: 'Prior 8-week consolidation top. A continuation reference within the same confluence regime.',
    r1:     'Above the daily pivot R1 with the confluence intact — the fastest-resolving read while all signals agree.',
    pp:     'Pullback to the daily pivot. Signal agreement holding through a quiet pullback has historically been the stronger read.',
    guard:  'Daily pivot S1 or the 20 EMA. Confluence setups historically unwind from here — the count of green signals below this zone is the tell.',
  });
  const cycleLabels = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildStandardZones(personas),
    horizontalLines: buildStandardLines(keyLevels),
  };

  const { phase, tone } = derivePhase(met, whatConfirms.length);
  const currentSituation = buildSituation(latest, met, whatConfirms.length);

  const data: SetupData = {
    setupKey: 'power_buy',
    setupLabel: 'Strength Confluence',
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
    investorTip:
      'Confluence is a COUNT, not a switch. The historical edge came from the number of independent signals agreeing at once — and faded one signal at a time, which is why the checklist above matters more here than any single line on the chart.',
  };
  return data;
};

function derivePhase(met: number, total: number): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  if (met >= total - 1) return { phase: 'Full confluence', tone: 'bull' };
  if (met >= 4) return { phase: 'Confluence building', tone: 'bull' };
  if (met >= 2) return { phase: 'Partial signals', tone: 'neutral' };
  return { phase: 'Signals faded', tone: 'bear' };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'Accumulation signature present',
      state: check(latest.accum_distrib != null ? latest.accum_distrib === 'ACCUMULATION' : null),
      explain: latest.accum_distrib != null
        ? `accum/distrib reads ${latest.accum_distrib}.`
        : 'Accumulation signature not computed for this bar.',
    },
    {
      label: 'Above the 150 SMA',
      state: check(latest.sma_150 != null ? latest.close > latest.sma_150 : null),
      explain: latest.sma_150 != null
        ? `Close ${fmt(latest.close)} vs 150 SMA ${fmt(latest.sma_150)}.`
        : '150 SMA not yet available (young listing).',
    },
    {
      label: 'Magic RS zone bullish',
      state: check(latest.magic_rs_zone != null
        ? ['Strong Bull', 'Mild Bull'].includes(latest.magic_rs_zone)
        : null),
      explain: latest.magic_rs_zone != null
        ? `Zone: ${latest.magic_rs_zone}. The scan gates on Strong/Mild Bull.`
        : 'Magic RS zone not computed.',
    },
    {
      label: 'Order flow constructive',
      state: check(latest.flow_type != null
        ? ['FRESH_LONGS', 'SHORT_COVERING'].includes(latest.flow_type)
        : null),
      explain: latest.flow_type != null
        ? `Flow: ${latest.flow_type.replace(/_/g, ' ').toLowerCase()}.`
        : 'Flow type not computed.',
    },
    {
      label: 'Relative volume > 1.5×',
      state: check(latest.rvol != null ? latest.rvol > 1.5 : null),
      explain: latest.rvol != null ? `rvol ${latest.rvol.toFixed(2)}×.` : 'rvol not computed.',
    },
    {
      label: 'Relative strength in top quartile',
      state: check(latest.rs_percentile != null ? latest.rs_percentile >= 75 : null),
      explain: latest.rs_percentile != null
        ? `RS percentile ${latest.rs_percentile.toFixed(0)}. Top quartile ≥ 75.`
        : 'RS percentile not yet computed for this bar.',
    },
  ];
}

function buildSituation(latest: LatestEodRow, met: number, total: number): CurrentSituation {
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Confluence confirmed'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'Signals absent'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} confluence signals green.`];
  if (latest.magic_rs_zone) parts.push(`Magic RS zone ${latest.magic_rs_zone}.`);
  if (latest.flow_type) parts.push(`Flow ${latest.flow_type.replace(/_/g, ' ').toLowerCase()}.`);
  parts.push('The industry gate (rotating-in / leading) is evaluated by the nightly scan, not on this page.');
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
