/**
 * Conviction Flow (conviction_flow) — adapter for the Scanner Story Page.
 *
 * Matview gate (migration 170): 5-day delivery value outpacing the
 * 22-day norm (delivery_surge_x > 1.5), avg 22-day delivery value
 * > ₹1.5 Cr (liquid enough to matter), day change within ±8% (surge
 * without a blow-off bar). Ranked by delivery surge.
 *
 * The story: MONEY, not price — recent delivered value running ahead of
 * its own norm while price stays orderly.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

export const convictionFlowAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'The prior 20-week high. Conviction flow arriving BELOW a shelf has historically preceded its test — the money moves before the level does.',
    ema:    'The weekly 50 EMA. Delivered-value surges into this line read as conviction defending structure.',
    consol: 'Prior 8-week consolidation top — the range the surging delivery value is being spent inside.',
    r1:     'Above the daily pivot R1 while the delivery surge persists — price starting to follow the money.',
    pp:     'The daily pivot. An orderly hold here while delivered value runs 1.5×+ its norm is the core of this read.',
    guard:  'Daily pivot S1 or the 20 EMA. The conviction read historically ended when this broke while the surge multiple decayed back under 1×.',
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
    setupKey: 'conviction_flow',
    setupLabel: 'Conviction Flow',
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
      'The surge multiple compares the last 5 days of DELIVERED value against the stock’s own 22-day norm — money versus its own history, not versus other stocks. Historically the read carried while the multiple held above 1.5× on orderly price; a one-day spike that decays immediately was noise.',
  };
  return data;
};

function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const x = latest.delivery_surge_x;
  if (x == null) return { phase: 'Flow read', tone: 'neutral' };
  if (x >= 3) return { phase: 'Heavy conviction', tone: 'bull' };
  if (x >= 1.5) return { phase: 'Conviction building', tone: 'bull' };
  if (x >= 1) return { phase: 'At norm', tone: 'neutral' };
  return { phase: 'Flow receding', tone: 'bear' };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'Delivery surge > 1.5× the 22-day norm',
      state: check(latest.delivery_surge_x != null ? latest.delivery_surge_x > 1.5 : null),
      explain: latest.delivery_surge_x != null
        ? `Surge ${latest.delivery_surge_x.toFixed(2)}× — 5-day delivered value vs the 22-day baseline.`
        : 'Delivery surge not computed (needs migration 094/095 rolling metrics).',
    },
    {
      label: 'Liquid enough to matter (₹1.5 Cr+ daily)',
      state: check(latest.avg_amt_22d != null ? latest.avg_amt_22d > 1.5 : null),
      explain: latest.avg_amt_22d != null
        ? `22-day avg delivered value ₹${latest.avg_amt_22d.toFixed(1)} Cr.`
        : '22-day delivery value not computed.',
    },
    {
      label: 'Price orderly (day change within ±8%)',
      state: check(latest.pct_chng != null ? Math.abs(latest.pct_chng) <= 8 : null),
      explain: latest.pct_chng != null
        ? `Day change ${latest.pct_chng >= 0 ? '+' : ''}${latest.pct_chng.toFixed(2)}% — the scan excludes blow-off bars.`
        : 'No day-change value on the latest bar.',
    },
    {
      label: 'Delivery share ≥ 40%',
      state: check(latest.delivery_pct != null ? latest.delivery_pct >= 40 : null),
      explain: latest.delivery_pct != null
        ? `Delivery ${latest.delivery_pct.toFixed(0)}% of volume.`
        : 'Delivery % unavailable (BSE or young listing).',
    },
    {
      label: 'Above the 20 EMA',
      state: check(latest.ema_20 != null ? latest.close > latest.ema_20 : null),
      explain: latest.ema_20 != null
        ? `Close ${fmt(latest.close)} vs 20 EMA ${fmt(latest.ema_20)}.`
        : '20 EMA not yet available.',
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
  ];
}

function buildSituation(latest: LatestEodRow, confirms: WhatConfirmsItem[]): CurrentSituation {
  const met = confirms.filter((c) => c.state === 'met').length;
  const total = confirms.length;
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Conviction confirmed'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'No flow read'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} conviction criteria met.`];
  if (latest.delivery_surge_x != null) parts.push(`Delivered value running ${latest.delivery_surge_x.toFixed(1)}× its 22-day norm.`);
  if (latest.avg_amt_22d != null) parts.push(`Baseline ₹${latest.avg_amt_22d.toFixed(1)} Cr/day delivered.`);
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
