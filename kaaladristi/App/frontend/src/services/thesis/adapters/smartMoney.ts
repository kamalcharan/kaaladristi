/**
 * Smart Money Loading (smart_money) — adapter for the Scanner Story Page.
 *
 * Matview gate (migration 170): stock sits in an industry with broad
 * rising flow, delivery_pct > 60, rss_value > 0. Ranked by delivery %.
 *
 * The story: institutions take DELIVERY — the footprint is high
 * delivery share plus institutional-presence indicators, usually before
 * price makes it obvious.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

export const smartMoneyAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'The prior 20-week high. When institutional delivery keeps arriving beneath a shelf, its eventual break has historically carried — the loading came first.',
    ema:    'The weekly 50 EMA. High-delivery pullbacks to this line historically read as institutions defending, not exiting.',
    consol: 'Prior 8-week consolidation top — where the visible loading has been happening. The zone institutions have been paying, per the delivery data.',
    r1:     'Above the daily pivot R1 while delivery share stays elevated — price confirming what the delivery data already showed.',
    pp:     'Pullback to the daily pivot on SHRINKING delivery — thin handing-back, not distribution.',
    guard:  'Daily pivot S1 or the 20 EMA. Loading theses historically failed when this zone broke on HIGH delivery — institutions changing their mind is visible in the same data.',
  });
  const cycleLabels = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildStandardZones(personas),
    horizontalLines: buildStandardLines(keyLevels),
  };

  const { phase, tone } = derivePhase(latest);
  const currentSituation = buildSituation(latest, whatConfirms);

  const data: SetupData = {
    setupKey: 'smart_money',
    setupLabel: 'Smart Money Loading',
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
      'Delivery is the only number in the dataset a large player cannot fake cheaply — taking delivery costs full capital. When delivery share stays above 60% across quiet sessions, someone is building a position they intend to keep; the chart usually admits it later.',
  };
  return data;
};

function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const d = latest.delivery_pct;
  if (d == null) return { phase: 'Loading read', tone: 'neutral' };
  if (d >= 60) return { phase: 'Loading', tone: 'bull' };
  if (d >= 45) return { phase: 'Presence', tone: 'bull' };
  return { phase: 'Thin delivery', tone: 'neutral' };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'Delivery share > 60%',
      state: check(latest.delivery_pct != null ? latest.delivery_pct > 60 : null),
      explain: latest.delivery_pct != null
        ? `Delivery ${latest.delivery_pct.toFixed(0)}% of volume — taken home, not day-traded.`
        : 'Delivery % unavailable (BSE or young listing).',
    },
    {
      label: 'RSS momentum positive',
      state: check(latest.rss_value != null ? latest.rss_value > 0 : null),
      explain: latest.rss_value != null
        ? `RSS ${latest.rss_value.toFixed(1)} — the spread-momentum read the scan gates on.`
        : 'RSS not computed for this bar.',
    },
    {
      label: 'Institutional presence elevated',
      state: check(latest.sniper_inst != null ? latest.sniper_inst >= 25 : null),
      explain: latest.sniper_inst != null
        ? `sniper_inst ${latest.sniper_inst.toFixed(0)} (range 0–50; ≥35 reads strong).`
        : 'Institution indicator not computed.',
    },
    {
      label: 'Accumulation or constructive flow',
      state: check(latest.accum_distrib != null || latest.flow_type != null
        ? latest.accum_distrib === 'ACCUMULATION' || ['FRESH_LONGS', 'SHORT_COVERING'].includes(latest.flow_type ?? '')
        : null),
      explain: `accum/distrib ${latest.accum_distrib ?? '—'} · flow ${latest.flow_type?.replace(/_/g, ' ').toLowerCase() ?? '—'}.`,
    },
    {
      label: 'Above the 150 SMA',
      state: check(latest.sma_150 != null ? latest.close > latest.sma_150 : null),
      explain: latest.sma_150 != null
        ? `Close ${fmt(latest.close)} vs 150 SMA ${fmt(latest.sma_150)}.`
        : '150 SMA not yet available (young listing).',
    },
    {
      label: 'Relative strength not lagging',
      state: check(latest.magic_rs_zone != null
        ? !['Strong Bear', 'Mild Bear'].includes(latest.magic_rs_zone)
        : null),
      explain: latest.magic_rs_zone != null
        ? `Magic RS zone ${latest.magic_rs_zone} — loading with RS in the bear zones has historically taken far longer to resolve.`
        : 'Magic RS zone not computed.',
    },
  ];
}

function buildSituation(latest: LatestEodRow, confirms: WhatConfirmsItem[]): CurrentSituation {
  const met = confirms.filter((c) => c.state === 'met').length;
  const total = confirms.length;
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Loading confirmed'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'No loading read'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} loading criteria met.`];
  if (latest.delivery_pct != null) parts.push(`Delivery ${latest.delivery_pct.toFixed(0)}% of volume.`);
  if (latest.sniper_inst != null) parts.push(`Institutional presence ${latest.sniper_inst.toFixed(0)}/50.`);
  parts.push('The industry-flow gate (broad rising flow across the sector) is evaluated by the nightly scan.');
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
