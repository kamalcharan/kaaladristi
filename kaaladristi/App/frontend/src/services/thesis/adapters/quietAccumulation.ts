/**
 * Quiet Rising Flow (quiet_accumulation) — adapter for the Story Page.
 *
 * Matview gate (migration 170): industry NOT yet leading but with
 * rising accumulation change, stock shows ACCUMULATION, institutional
 * presence rising vs its 5-day prior. Ranked by industry accumulation
 * change.
 *
 * The story is EARLINESS: the whole point is that nothing looks
 * exciting yet. One confirm is deliberately inverted — LOW relative
 * volume is a feature here, not a bug.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

export const quietAccumulationAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'The prior 20-week high. In quiet-accumulation reads this shelf often sits far above — the zone matters as the eventual destination, not the present.',
    ema:    'The weekly 50 EMA. Quiet builds happen around this line; holding it through dull sessions is the whole pattern.',
    consol: 'Prior 8-week consolidation top — the top of the quiet range where the accumulation is happening.',
    r1:     'Above the daily pivot R1 — for this preset an EARLY awakening sign rather than the norm; quiet names are not expected to be here yet.',
    pp:     'The daily pivot — where a quiet name spends most of its time. Dullness with accumulation is the read, not a warning.',
    guard:  'Daily pivot S1 or the 20 EMA. Quiet accumulation failing looks like this zone breaking with the accumulation signature flipping off.',
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
    setupKey: 'quiet_accumulation',
    setupLabel: 'Quiet Rising Flow',
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
      'This preset exists for the stretch of a chart nobody screenshots — flat price, dull volume, and a rising accumulation line underneath. Historically the read stopped being early (and stopped being cheap) the day relative volume finally expanded.',
  };
  return data;
};

function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  if (latest.rs_percentile != null && latest.rs_percentile >= 90) return { phase: 'No longer quiet', tone: 'neutral' };
  if (latest.rvol != null && latest.rvol > 1.5) return { phase: 'Awakening', tone: 'bull' };
  if (latest.accum_distrib === 'ACCUMULATION') return { phase: 'Quiet build', tone: 'bull' };
  return { phase: 'Watch', tone: 'neutral' };
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
      label: 'Institutional presence building',
      state: check(latest.sniper_inst != null ? latest.sniper_inst >= 15 : null),
      explain: latest.sniper_inst != null
        ? `sniper_inst ${latest.sniper_inst.toFixed(0)} (range 0–50). The scan gates on it RISING vs its 5-day prior — evaluated nightly.`
        : 'Institution indicator not computed.',
    },
    {
      label: 'Delivery participation ≥ 40%',
      state: check(latest.delivery_pct != null ? latest.delivery_pct >= 40 : null),
      explain: latest.delivery_pct != null
        ? `Delivery ${latest.delivery_pct.toFixed(0)}% — quiet buying still gets taken home.`
        : 'Delivery % unavailable (BSE or young listing).',
    },
    {
      label: 'Still quiet (rvol ≤ 1.5×)',
      state: check(latest.rvol != null ? latest.rvol <= 1.5 : null),
      explain: latest.rvol != null
        ? `rvol ${latest.rvol.toFixed(2)}× — INVERTED gate: low volume is the point of this preset; expansion means the quiet phase is ending.`
        : 'rvol not computed.',
    },
    {
      label: 'Holding the weekly 50 EMA area',
      state: check(latest.close > 0 && latest.sma_150 != null ? latest.close > latest.sma_150 * 0.95 : null),
      explain: latest.sma_150 != null
        ? `Close ${fmt(latest.close)} vs 150 SMA ${fmt(latest.sma_150)} (within −5% counts — quiet bases sag).`
        : '150 SMA not yet available (young listing).',
    },
    {
      label: 'Relative strength not deteriorating',
      state: check(latest.magic_rs_zone != null
        ? !['Strong Bear', 'Mild Bear'].includes(latest.magic_rs_zone)
        : null),
      explain: latest.magic_rs_zone != null
        ? `Magic RS zone ${latest.magic_rs_zone}.`
        : 'Magic RS zone not computed.',
    },
  ];
}

function buildSituation(latest: LatestEodRow, confirms: WhatConfirmsItem[]): CurrentSituation {
  const met = confirms.filter((c) => c.state === 'met').length;
  const total = confirms.length;
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Quiet build confirmed'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'No build read'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} quiet-build criteria met.`];
  if (latest.rvol != null) parts.push(`Relative volume ${latest.rvol.toFixed(2)}× — ${latest.rvol <= 1.5 ? 'still under the radar' : 'waking up'}.`);
  parts.push('The industry gate (not-yet-leading, accumulation rising) is evaluated by the nightly scan.');
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
