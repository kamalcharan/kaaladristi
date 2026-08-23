/**
 * Distribution Warnings (distribution_warning) — Story Page adapter.
 *
 * Matview gate (migration 170): the stock WAS Strong Bull ten sessions
 * ago and has decayed into a middle band, with a distribution signal
 * attached (recent SYD dot or downward volume divergence). Ranked by
 * rank-drop × RS-drop.
 *
 * The story: a leader losing its leadership — visible in the RS decay
 * before it is obvious in price. SEBI: an observational warning read;
 * lenses renamed via personaMeta (Holder / Pressure).
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, PersonaEntries, WhatConfirmsItem } from '../setupAdapter';
import { priorMaxFromEnd } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardZones, buildStandardLines, weeklyEma50, rangeGuard, pickBest, check, fmt } from '../adapterUtils';

const MIDDLE_BANDS = ['Mild Bull', 'Neutral Bull', 'Neutral', 'Neutral Bear', 'Mild Bear'];

export const distributionWarningAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const personas = buildPersonas(latest, weekly, ema50w);
  const cycleLabels = buildCycleLabels(weekly);
  const chartAnnotations: ChartAnnotations = {
    cycleLabels,
    entryZones: buildStandardZones(personas),
    horizontalLines: buildStandardLines(keyLevels),
  };

  const { phase, tone } = derivePhase(latest);
  const currentSituation = buildSituation(latest, whatConfirms);

  const data: SetupData = {
    setupKey: 'distribution_warning',
    setupLabel: 'Distribution Warnings',
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
        intent: 'Reads the levels a holder of a fading leader watches — where the decay read strengthens, and where it is invalidated. Observational, not an instruction.',
      },
      swing: {
        heading: 'Pressure Lens',
        sub: 'Daily · decay',
        intent: 'Reads where the leadership decay historically accelerated or paused. Faster-resolving zones near the last bar.',
      },
    },
    investorTip:
      'Leadership decays before price does — that is the whole preset. A stock that was Strong Bull two weeks ago and now reads a middle band, with distribution dots or a volume divergence underneath, has historically resolved DOWN more often than it recovered. The RS zone recovering to Strong Bull is the invalidation.',
  };
  return data;
};

function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const z = latest.magic_rs_zone;
  if (z === 'Strong Bull') return { phase: 'Leadership intact', tone: 'bull' };
  if (z != null && ['Mild Bear', 'Neutral Bear'].includes(z)) return { phase: 'Decay advanced', tone: 'bear' };
  if (z != null && MIDDLE_BANDS.includes(z)) return { phase: 'Leadership fading', tone: 'neutral' };
  return { phase: 'Decay read', tone: 'neutral' };
}

function buildPersonas(latest: LatestEodRow, weekly: Parameters<SetupAdapter>[0], ema50w: number | null): PersonaEntries {
  const inRange = rangeGuard(latest.close);
  const shelf = priorMaxFromEnd(weekly, 20, (b) => b.high);
  const consol = priorMaxFromEnd(weekly, 8, (b) => b.close);

  return {
    ltInvestor: [
      {
        entryNo: 1,
        price: inRange(consol),
        label: 'Decay-confirm zone',
        rationale: 'The prior 8-week consolidation top. Losing this zone after an RS decay has historically confirmed the distribution read.',
      },
      {
        entryNo: 2,
        price: inRange(ema50w),
        label: 'Structural line',
        rationale: 'The weekly 50 EMA. The last structural defense of a fading leader — behavior here decides whether decay becomes markdown.',
      },
      {
        entryNo: 3,
        price: inRange(shelf),
        label: 'Invalidation zone',
        rationale: 'The prior 20-week high. Reclaiming it with RS back in Strong Bull invalidates the warning entirely.',
      },
    ],
    swingTrader: [
      {
        entryNo: 1,
        price: inRange(latest.pivot_s1),
        label: 'Decay-accelerate zone',
        rationale: 'Below the daily pivot S1 — where the fade has historically turned into active selling.',
      },
      {
        entryNo: 2,
        price: inRange(latest.pivot_pp),
        label: 'Mid-range zone',
        rationale: 'The daily pivot. Failed bounces dying here with the divergence intact kept the warning alive.',
      },
      {
        entryNo: 3,
        price: inRange(pickBest(latest.pivot_r1, latest.ema_20, Math.max)),
        label: 'Warning-off zone',
        rationale: 'Daily pivot R1 / the 20 EMA reclaimed on volume — where this warning historically stopped applying.',
      },
    ],
  };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'RS decayed out of Strong Bull',
      state: check(latest.magic_rs_zone != null ? MIDDLE_BANDS.includes(latest.magic_rs_zone) : null),
      explain: latest.magic_rs_zone != null
        ? `Zone now ${latest.magic_rs_zone}. The scan additionally requires Strong Bull ten sessions ago — evaluated nightly from history.`
        : 'Magic RS zone not computed.',
    },
    {
      label: 'Volume divergence downward',
      state: check(latest.volume_divergence_flag != null ? latest.volume_divergence_flag === 'VOLUME_DIV_DOWN' : null),
      explain: latest.volume_divergence_flag != null
        ? `Divergence flag: ${latest.volume_divergence_flag}. (The scan accepts a recent SYD dot as the alternative signal — dots are on the chart.)`
        : 'Divergence flag not computed — check the chart for recent SYD (yellow) dots instead.',
    },
    {
      label: 'Order flow no longer constructive',
      state: check(latest.flow_type != null
        ? !['FRESH_LONGS', 'SHORT_COVERING'].includes(latest.flow_type)
        : null),
      explain: latest.flow_type != null
        ? `Flow: ${latest.flow_type.replace(/_/g, ' ').toLowerCase()}.`
        : 'Flow type not computed.',
    },
    {
      label: 'Distribution signature forming',
      state: check(latest.accum_distrib != null ? latest.accum_distrib === 'DISTRIBUTION' : null),
      explain: latest.accum_distrib != null
        ? `accum/distrib reads ${latest.accum_distrib}.`
        : 'Signature not computed for this bar.',
    },
    {
      label: 'Below the 20 EMA',
      state: check(latest.ema_20 != null ? latest.close < latest.ema_20 : null),
      explain: latest.ema_20 != null
        ? `Close ${fmt(latest.close)} vs 20 EMA ${fmt(latest.ema_20)} — the short-term trend has already given way.`
        : '20 EMA not yet available.',
    },
    {
      label: 'Delivery thinning (< 45%)',
      state: check(latest.delivery_pct != null ? latest.delivery_pct < 45 : null),
      explain: latest.delivery_pct != null
        ? `Delivery ${latest.delivery_pct.toFixed(0)}% — conviction leaving before price does.`
        : 'Delivery % unavailable (BSE or young listing).',
    },
  ];
}

function buildSituation(latest: LatestEodRow, confirms: WhatConfirmsItem[]): CurrentSituation {
  const met = confirms.filter((c) => c.state === 'met').length;
  const total = confirms.length;
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Distribution confirmed'; tone = 'bear'; }
  else if (met >= 3) { verdict = 'Warning active'; tone = 'bear'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'Warning easing'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} decay criteria present.`];
  if (latest.magic_rs_zone) parts.push(`Magic RS zone ${latest.magic_rs_zone} — the scan requires Strong Bull ten sessions ago, so the decay is recent.`);
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
