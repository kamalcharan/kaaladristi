/**
 * Volume Drive (volume_drive) — Story Page adapter.
 *
 * Scan gates (scanEngine fetchVolumeDrive): a volume-drive (SVD) or
 * accumulation (SBD) dot printed TODAY, ranked by delivery conviction —
 * because a big bar everyone can see has already happened; delivery is
 * what separates a real bid from churn.
 *
 * The story: TODAY'S bar. The dots are on the chart (SVD violet, SBD
 * blue); this page reads whether the bar that printed them was taken
 * home or day-traded.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

export const volumeDriveAdapter: SetupAdapter = (weekly, latest, identity) => {
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest);
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'The prior 20-week high. A volume-drive bar printing NEAR a shelf has historically been the higher-quality read — energy arriving where it matters.',
    ema:    'The weekly 50 EMA. Drive bars into or off this line read as structure being defended with size.',
    consol: 'Prior 8-week consolidation top — where the drive bar sits relative to the recent range decides whether it is a break or a churn.',
    r1:     'Above the daily pivot R1 while the drive-day delivery holds — follow-through on the bar that fired the dot.',
    pp:     'The daily pivot. Quiet digestion of a drive bar here has historically outperformed immediate continuation chasing.',
    guard:  'Daily pivot S1 or the 20 EMA. A drive bar fully retraced below this zone historically marked the bar as churn, not accumulation.',
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
    setupKey: 'volume_drive',
    setupLabel: 'Volume Drive',
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
      'The bar already happened — everyone saw it. What the market cannot see on the chart is delivery: a drive bar with 50%+ taken home was bought to keep; the same bar at 20% delivery was a day-trading festival. This preset ranks by exactly that difference.',
  };
  return data;
};

function derivePhase(latest: LatestEodRow): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  const drive = latest.dot_svd === true || latest.dot_sbd === true;
  if (drive && (latest.delivery_pct ?? 0) >= 50) return { phase: 'Drive · delivered', tone: 'bull' };
  if (drive) return { phase: 'Drive day', tone: 'bull' };
  if (latest.dot_syd === true) return { phase: 'Distribution bar', tone: 'bear' };
  return { phase: 'Post-drive', tone: 'neutral' };
}

function buildWhatConfirms(latest: LatestEodRow): WhatConfirmsItem[] {
  return [
    {
      label: 'Drive/accumulation dot on the latest bar',
      state: check(latest.dot_svd != null || latest.dot_sbd != null
        ? latest.dot_svd === true || latest.dot_sbd === true
        : null),
      explain: `SVD ${latest.dot_svd ? 'yes' : 'no'} · SBD ${latest.dot_sbd ? 'yes' : 'no'} — the dots are visible on the chart (violet / blue).`,
    },
    {
      label: 'Delivery conviction ≥ 50%',
      state: check(latest.delivery_pct != null ? latest.delivery_pct >= 50 : null),
      explain: latest.delivery_pct != null
        ? `Delivery ${latest.delivery_pct.toFixed(0)}% of the drive-day volume was taken home.`
        : 'Delivery % unavailable (BSE or young listing).',
    },
    {
      label: 'Relative volume expanded (≥ 1.5×)',
      state: check(latest.rvol != null ? latest.rvol >= 1.5 : null),
      explain: latest.rvol != null ? `rvol ${latest.rvol.toFixed(2)}×.` : 'rvol not computed.',
    },
    {
      label: 'No distribution dot on the same bar',
      state: check(latest.dot_syd != null ? latest.dot_syd !== true : null),
      explain: latest.dot_syd === true
        ? 'An SYD (distribution) dot printed the same day — mixed signal.'
        : 'No SYD dot on the latest bar.',
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
  if (met >= 5) { verdict = 'Delivered drive'; tone = 'bull'; }
  else if (met >= 3) { verdict = 'Constructive'; tone = 'bull'; }
  else if (met >= 1) { verdict = 'Watch'; tone = 'neutral'; }
  else { verdict = 'No drive read'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} drive criteria met.`];
  if (latest.delivery_pct != null) parts.push(`Delivery ${latest.delivery_pct.toFixed(0)}%.`);
  if (latest.rvol != null) parts.push(`Volume ${latest.rvol.toFixed(1)}× its norm.`);
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
