/**
 * Stage 2 Watch (stage_2_watch) — Story Page adapter.
 *
 * Scan gates (scanEngine fetchStage2Watch): stage = S2_CANDIDATE,
 * close > ₹30, close > 150 SMA, 50 SMA > 150 SMA (MA stacking), and
 * NOT extended (< 50% above the 150 SMA). The 200 SMA is not yet
 * rising — that's what separates Watch from Leaders.
 *
 * The story: the run-up TO a Stage 2, not the Stage 2 itself. The
 * candidate either graduates (200 SMA turns up, breakout holds) or
 * washes back into the base.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

export const stage2WatchAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'The prior 20-week high — the graduation line. A candidate clearing it with volume is how Stage 2 Watch names historically became Stage 2 Leaders.',
    ema:    'The weekly 50 EMA. Candidates basing above it kept their candidacy; losing it sent them back into Stage 1.',
    consol: 'Prior 8-week consolidation top — the top of the candidate base being built right now.',
    r1:     'Above the daily pivot R1 with volume — an early graduation attempt in progress.',
    pp:     'The daily pivot. Candidates spend most of their time here; dullness with MA stacking intact is normal, not a failure.',
    guard:  'Daily pivot S1 or the 20 EMA. The candidacy read weakened historically when this broke and the MA stack started uncrossing.',
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
    setupKey: 'stage_2_watch',
    setupLabel: 'Stage 2 Watch',
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
      'A candidate is a question, not an answer. The 200 SMA turning up is what has historically graduated these into Stage 2 Leaders — until then, the base can still fail, and the MA stack uncrossing is the earliest tell that it is.',
  };
  return data;
};

function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  if (latest.stage === 'S2') return { phase: 'Graduated', tone: 'bull' };
  if (latest.stage === 'S2_CANDIDATE') {
    if (latest.sma_150 != null && latest.close > latest.sma_150 * 1.25) return { phase: 'Candidate · extended', tone: 'neutral' };
    return { phase: 'Stage 2 candidate', tone: 'bull' };
  }
  if (latest.stage === 'S1' || latest.stage === 'S1_CANDIDATE') return { phase: 'Back to base', tone: 'neutral' };
  return { phase: 'Watch', tone: 'neutral' };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'Stage reads S2_CANDIDATE',
      state: check(latest.stage != null ? latest.stage === 'S2_CANDIDATE' || latest.stage === 'S2' : null),
      explain: latest.stage != null ? `Weinstein stage: ${latest.stage}.` : 'Stage not classified for this bar.',
    },
    {
      label: 'Above the 150 SMA',
      state: check(latest.sma_150 != null ? latest.close > latest.sma_150 : null),
      explain: latest.sma_150 != null
        ? `Close ${fmt(latest.close)} vs 150 SMA ${fmt(latest.sma_150)}.`
        : '150 SMA not yet available (young listing).',
    },
    {
      label: 'MA stacking (50 SMA above 150 SMA)',
      state: check(latest.sma_50 != null && latest.sma_150 != null ? latest.sma_50 > latest.sma_150 : null),
      explain: latest.sma_50 != null && latest.sma_150 != null
        ? `50 SMA ${fmt(latest.sma_50)} vs 150 SMA ${fmt(latest.sma_150)}.`
        : 'MA pair not yet available.',
    },
    {
      label: 'Not extended (< 50% above 150 SMA)',
      state: check(latest.sma_150 != null ? ((latest.close - latest.sma_150) / latest.sma_150) * 100 < 50 : null),
      explain: latest.sma_150 != null
        ? `${(((latest.close - latest.sma_150) / latest.sma_150) * 100).toFixed(1)}% above the 150 SMA — the scan drops candidates already too far gone.`
        : '150 SMA not yet available.',
    },
    {
      label: '200 SMA graduation check',
      state: check(latest.sma_200 != null ? latest.close > latest.sma_200 : null),
      explain: latest.sma_200 != null
        ? `Close ${fmt(latest.close)} vs 200 SMA ${fmt(latest.sma_200)}. The 200 SMA turning UP is the graduation signal — its slope is evaluated by the nightly scan.`
        : '200 SMA not yet available.',
    },
    {
      label: 'Relative strength improving (≥ 60)',
      state: check(latest.rs_percentile != null ? latest.rs_percentile >= 60 : null),
      explain: latest.rs_percentile != null
        ? `RS percentile ${latest.rs_percentile.toFixed(0)} — candidates that graduated historically built RS before price.`
        : 'RS percentile not yet computed.',
    },
  ];
}

function buildSituation(latest: LatestEodRow, confirms: WhatConfirmsItem[]): CurrentSituation {
  const met = confirms.filter((c) => c.state === 'met').length;
  const total = confirms.length;
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= 5) { verdict = 'Strong candidate'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Candidacy intact'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'Candidacy weak'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} candidacy criteria met.`];
  if (latest.stage) parts.push(`Stage ${latest.stage}.`);
  parts.push('Graduation = the 200 SMA turning up while the breakout holds — the difference between Watch and Leaders.');
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
