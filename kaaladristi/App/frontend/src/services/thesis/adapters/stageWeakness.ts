/**
 * Stage-weakness family — Story Page adapters for the three bearish
 * stage presets. One file: they share the Holder/Pressure lenses, the
 * same structural zone set, and the same invalidation grammar; only
 * gates, phase, and voice differ.
 *
 *   · stage_3_watch    — S3, 50 SMA converging toward 200 SMA (<15% gap).
 *                        The death cross hasn't happened yet — this is
 *                        the countdown.
 *   · stage_4_leaders  — S4 with the full death cross confirmed
 *                        (close < 50 SMA < 200 SMA).
 *   · vani_exit_watch  — the same death cross PLUS RS percentile < 20:
 *                        the weakest names in the tape.
 *
 * SEBI: weakness READS with explicit invalidations, never instructions.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, PersonaEntries, WhatConfirmsItem } from '../setupAdapter';
import { priorMaxFromEnd } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardZones, buildStandardLines, weeklyEma50, rangeGuard, pickBest, check, fmt, HOLDER_PRESSURE_META } from '../adapterUtils';

// ── Shared pieces ───────────────────────────────────────────────────────

function weaknessPersonas(latest: LatestEodRow, weekly: Parameters<SetupAdapter>[0], ema50w: number | null): PersonaEntries {
  const inRange = rangeGuard(latest.close);
  const shelf = priorMaxFromEnd(weekly, 20, (b) => b.high);
  const consol = priorMaxFromEnd(weekly, 8, (b) => b.close);
  return {
    ltInvestor: [
      {
        entryNo: 1,
        price: inRange(latest.sma_200),
        label: 'Death-cross line',
        rationale: 'The 200 SMA — the long-term dividing line of the whole stage read. Behavior around it decides whether this stays a markdown story.',
      },
      {
        entryNo: 2,
        price: inRange(ema50w),
        label: 'Structural line',
        rationale: 'The weekly 50 EMA. Reclaiming it has historically been the FIRST repair signal a weak name prints.',
      },
      {
        entryNo: 3,
        price: inRange(shelf),
        label: 'Invalidation zone',
        rationale: 'The prior 20-week high. Above it with the MAs re-stacking, the weakness read is fully invalidated.',
      },
    ],
    swingTrader: [
      {
        entryNo: 1,
        price: inRange(latest.pivot_s1),
        label: 'Pressure-confirm zone',
        rationale: 'Below the daily pivot S1 — where the markdown historically resumed after relief attempts.',
      },
      {
        entryNo: 2,
        price: inRange(latest.pivot_pp),
        label: 'Mid-range zone',
        rationale: 'The daily pivot. Relief rallies dying here on thin volume kept the weakness read alive.',
      },
      {
        entryNo: 3,
        price: inRange(pickBest(latest.pivot_r1, consol, Math.min)),
        label: 'Pressure-off zone',
        rationale: 'Daily pivot R1 / the prior consolidation top — above this the pressure read eases and this preset historically stopped applying.',
      },
    ],
  };
}

function weaknessConfirms(latest: LatestEodRow, extra: WhatConfirmsItem[]): WhatConfirmsItem[] {
  return [
    ...extra,
    {
      label: 'Below the 50 SMA',
      state: check(latest.sma_50 != null ? latest.close < latest.sma_50 : null),
      explain: latest.sma_50 != null ? `Close ${fmt(latest.close)} vs 50 SMA ${fmt(latest.sma_50)}.` : '50 SMA not yet available.',
    },
    {
      label: 'Order flow not constructive',
      state: check(latest.flow_type != null
        ? !['FRESH_LONGS', 'SHORT_COVERING'].includes(latest.flow_type)
        : null),
      explain: latest.flow_type != null
        ? `Flow: ${latest.flow_type.replace(/_/g, ' ').toLowerCase()}.`
        : 'Flow type not computed.',
    },
    {
      label: 'Relative strength weak',
      state: check(latest.rs_percentile != null ? latest.rs_percentile <= 40 : null),
      explain: latest.rs_percentile != null ? `RS percentile ${latest.rs_percentile.toFixed(0)}.` : 'RS percentile not yet computed.',
    },
  ];
}

function weaknessSituation(met: number, total: number, tail: string): CurrentSituation {
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (met >= total - 1) { verdict = 'Weakness confirmed'; tone = 'bear'; }
  else if (met >= 3) { verdict = 'Deteriorating'; tone = 'bear'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'Signals easing'; tone = 'neutral'; }
  return { verdict, verdictTone: tone, narrative: `${met} of ${total} weakness criteria present. ${tail}` };
}

function buildWeaknessData(
  key: string,
  label: string,
  weekly: Parameters<SetupAdapter>[0],
  latest: LatestEodRow,
  identity: Parameters<SetupAdapter>[2],
  phase: { phase: string; tone: 'bull' | 'bear' | 'neutral' },
  whatConfirms: WhatConfirmsItem[],
  situationTail: string,
  tip: string,
): SetupData {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const personas = weaknessPersonas(latest, weekly, ema50w);
  const met = whatConfirms.filter((c) => c.state === 'met').length;
  const chartAnnotations: ChartAnnotations = {
    cycleLabels: buildCycleLabels(weekly),
    entryZones: buildStandardZones(personas),
    horizontalLines: buildStandardLines(keyLevels),
  };
  return {
    setupKey: key,
    setupLabel: label,
    header: {
      symbol: identity.symbol,
      companyName: identity.company_name,
      exchange: identity.exchange,
      industry: identity.industry,
      close: latest.close,
      pctChng: latest.pct_chng,
      rsPercentile: latest.rs_percentile,
      phase: phase.phase,
      phaseTone: phase.tone,
    },
    keyLevels,
    currentSituation: weaknessSituation(met, whatConfirms.length, situationTail),
    chartAnnotations,
    personas,
    whatConfirms,
    personaMeta: { lt: { ...HOLDER_PRESSURE_META.lt }, swing: { ...HOLDER_PRESSURE_META.swing } },
    investorTip: tip,
  };
}

// ── stage_3_watch ───────────────────────────────────────────────────────

export const stage3WatchAdapter: SetupAdapter = (weekly, latest, identity) => {
  const gapPct = latest.sma_50 != null && latest.sma_200 != null && latest.sma_200 > 0
    ? (Math.abs(latest.sma_50 - latest.sma_200) / latest.sma_200) * 100
    : null;
  const phase = latest.stage === 'S4'
    ? { phase: 'Crossed over', tone: 'bear' as const }
    : gapPct != null && gapPct < 5
      ? { phase: 'Cross imminent', tone: 'bear' as const }
      : { phase: 'Converging', tone: 'neutral' as const };
  const confirms = weaknessConfirms(latest, [
    {
      label: 'Stage reads S3 (topping)',
      state: check(latest.stage != null ? latest.stage === 'S3' || latest.stage === 'S4' : null),
      explain: latest.stage != null ? `Weinstein stage: ${latest.stage}.` : 'Stage not classified.',
    },
    {
      label: '50 SMA converging on 200 SMA (< 15% gap)',
      state: check(gapPct != null ? gapPct < 15 : null),
      explain: gapPct != null
        ? `Gap ${gapPct.toFixed(1)}% — the countdown to a death cross; the scan sorts by this.`
        : 'MA pair not yet available.',
    },
    {
      label: 'Distribution signature forming',
      state: check(latest.accum_distrib != null ? latest.accum_distrib === 'DISTRIBUTION' : null),
      explain: latest.accum_distrib != null ? `accum/distrib reads ${latest.accum_distrib}.` : 'Signature not computed.',
    },
  ]);
  return buildWeaknessData(
    'stage_3_watch', 'Stage 3 Watch', weekly, latest, identity, phase, confirms,
    'The death cross has NOT happened yet — this preset is the countdown, and tops that repaired did it from here.',
    'Stage 3 is the last exit before the markdown. Historically the split happened at the 200 SMA: names that held it and re-stacked the MAs repaired; names that crossed became Stage 4 Leaders. The gap percentage above is the clock.',
  );
};

// ── stage_4_leaders ─────────────────────────────────────────────────────

export const stage4LeadersAdapter: SetupAdapter = (weekly, latest, identity) => {
  const deathCross = latest.sma_50 != null && latest.sma_200 != null
    ? latest.close < latest.sma_50 && latest.sma_50 < latest.sma_200
    : null;
  const phase = deathCross === true
    ? { phase: 'Markdown', tone: 'bear' as const }
    : { phase: 'Cross unwinding', tone: 'neutral' as const };
  const confirms = weaknessConfirms(latest, [
    {
      label: 'Stage reads S4 (declining)',
      state: check(latest.stage != null ? latest.stage === 'S4' : null),
      explain: latest.stage != null ? `Weinstein stage: ${latest.stage}.` : 'Stage not classified.',
    },
    {
      label: 'Death cross confirmed',
      state: check(deathCross),
      explain: deathCross != null
        ? `close < 50 SMA < 200 SMA: ${deathCross ? 'yes' : 'no'} (${fmt(latest.close)} / ${fmt(latest.sma_50)} / ${fmt(latest.sma_200)}).`
        : 'MA pair not yet available.',
    },
    {
      label: 'Below the 200 SMA',
      state: check(latest.sma_200 != null ? latest.close < latest.sma_200 : null),
      explain: latest.sma_200 != null ? `Close ${fmt(latest.close)} vs 200 SMA ${fmt(latest.sma_200)}.` : '200 SMA not yet available.',
    },
  ]);
  return buildWeaknessData(
    'stage_4_leaders', 'Stage 4 Leaders', weekly, latest, identity, phase, confirms,
    'A confirmed markdown regime — the burden of proof is on the repair, not the decline.',
    'Stage 4 rallies have historically been the market’s most convincing traps: sharp, fast, and dead at the declining 200 SMA. The read only changes when the MAs re-stack — a single reclaim of the 50 SMA has not been enough.',
  );
};

// ── vani_exit_watch ─────────────────────────────────────────────────────

export const vaniExitWatchAdapter: SetupAdapter = (weekly, latest, identity) => {
  const deathCross = latest.sma_50 != null && latest.sma_200 != null
    ? latest.close < latest.sma_50 && latest.sma_50 < latest.sma_200
    : null;
  const phase = (latest.rs_percentile ?? 100) < 20 && deathCross === true
    ? { phase: 'Deep weakness', tone: 'bear' as const }
    : { phase: 'Weakness watch', tone: 'bear' as const };
  const confirms = weaknessConfirms(latest, [
    {
      label: 'Stage reads S4 (declining)',
      state: check(latest.stage != null ? latest.stage === 'S4' : null),
      explain: latest.stage != null ? `Weinstein stage: ${latest.stage}.` : 'Stage not classified.',
    },
    {
      label: 'Death cross confirmed',
      state: check(deathCross),
      explain: deathCross != null
        ? `close < 50 SMA < 200 SMA: ${deathCross ? 'yes' : 'no'}.`
        : 'MA pair not yet available.',
    },
    {
      label: 'RS in the bottom quintile (< 20)',
      state: check(latest.rs_percentile != null ? latest.rs_percentile < 20 : null),
      explain: latest.rs_percentile != null
        ? `RS percentile ${latest.rs_percentile.toFixed(0)} — the weakest names in the tape.`
        : 'RS percentile not yet computed.',
    },
  ]);
  return buildWeaknessData(
    'vani_exit_watch', 'VaNi Weakness Watch', weekly, latest, identity, phase, confirms,
    'The highest-conviction weakness read in the system: lowest relative strength AND a confirmed death cross.',
    'This list is the intersection of two independent negatives: the tape’s weakest RS quintile and a confirmed death cross. Historically, names on it stayed weak far longer than felt reasonable — the invalidation (MAs re-stacking with RS recovering) is deliberately demanding.',
  );
};
