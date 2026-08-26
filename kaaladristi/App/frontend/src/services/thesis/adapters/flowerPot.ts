/**
 * Flower Pot Burst (flower_pot_burst) — Story Page adapter.
 *
 * The scan (matview fpb_* CTEs, mirroring services/storyEvents FPB
 * constants) finds coils — dying volume, contracting range, flat RS —
 * and the rare session a coil releases with explosive volume-and-range
 * expansion (Burst ↑ / Shatter ↓).
 *
 * This adapter reads the SAME physics from the weekly bars it is
 * handed (the daily coil metrics live in the scan; weekly proxies are
 * labeled as such): compression = recent 4-week range and volume
 * shrinking vs their 12-week norms with RS flat; release = the latest
 * bar breaking the coil range on expanded volume.
 */

import type { SetupAdapter, SetupData, ChartAnnotations, CurrentSituation, LatestEodRow, WeeklyBar, WhatConfirmsItem } from '../setupAdapter';
import { buildCycleLabels } from '../cycleLabels';
import { buildStandardKeyLevels, buildStandardPersonas, buildStandardZones, buildStandardLines, weeklyEma50, check, fmt } from '../adapterUtils';

interface CoilRead {
  rangeRatio: number | null;   // 4-wk avg range / 12-wk avg range (< 0.75 = contracting)
  volRatio: number | null;     // 4-wk avg volume / 12-wk avg volume (< 0.7 = dying)
  rsDrift: number | null;      // |Δ magic_rs| over 4 weeks (< 3 = flat)
  coilHigh: number | null;     // top of the last-8-week coil range
  coilLow: number | null;
  released: boolean | null;    // latest bar broke the coil range on expanded volume
  releasedUp: boolean;
}

function readCoil(weekly: WeeklyBar[], latest: LatestEodRow): CoilRead {
  const n = weekly.length;
  if (n < 14) return { rangeRatio: null, volRatio: null, rsDrift: null, coilHigh: null, coilLow: null, released: null, releasedUp: false };
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const win = (from: number, to: number) => weekly.slice(Math.max(0, n - from), n - to);
  const range = (b: WeeklyBar) => b.high - b.low;

  const recent = win(5, 1);       // last 4 completed-ish weeks (excl live week)
  const base = win(13, 1);        // 12-week norm
  const rangeRatio = base.length ? avg(recent.map(range)) / Math.max(1e-9, avg(base.map(range))) : null;
  const volRatio = base.length ? avg(recent.map((b) => b.volume)) / Math.max(1e-9, avg(base.map((b) => b.volume))) : null;

  const rsNow = weekly[n - 2]?.magic_rs;
  const rsPrev = weekly[n - 6]?.magic_rs;
  const rsDrift = rsNow != null && rsPrev != null ? Math.abs(rsNow - rsPrev) : null;

  const coilBars = win(9, 1);
  const coilHigh = coilBars.length ? Math.max(...coilBars.map((b) => b.high)) : null;
  const coilLow = coilBars.length ? Math.min(...coilBars.map((b) => b.low)) : null;

  const live = weekly[n - 1];
  const volExpanded = base.length ? live.volume > 2 * avg(base.map((b) => b.volume)) : false;
  const brokeUp = coilHigh != null && live.close > coilHigh;
  const brokeDown = coilLow != null && live.close < coilLow;
  const released = coilHigh != null ? (brokeUp || brokeDown) && volExpanded : null;

  return { rangeRatio, volRatio, rsDrift, coilHigh, coilLow, released, releasedUp: brokeUp && !brokeDown };
}

export const flowerPotBurstAdapter: SetupAdapter = (weekly, latest, identity) => {
  const coil = readCoil(weekly, latest);
  const ema50w = weeklyEma50(weekly);
  const keyLevels = buildStandardKeyLevels(latest, ema50w);
  const whatConfirms = buildWhatConfirms(latest, coil);
  const personas = buildStandardPersonas(latest, weekly, ema50w, {
    shelf:  'The prior 20-week high. A coil releasing upward toward a shelf has historically been the strongest version of this pattern — compression resolving into structure.',
    ema:    'The weekly 50 EMA. Coils forming ON this line resolved with the trend more often than coils floating mid-air.',
    consol: coil.coilHigh != null
      ? `The coil ceiling (~₹${Math.round(coil.coilHigh)}). The release is only real above it on expanded volume; inside the coil, nothing has happened yet.`
      : 'The prior 8-week consolidation top — the coil ceiling once enough bars exist.',
    r1:     'Above the daily pivot R1 on release volume — the burst extending.',
    pp:     'The daily pivot. During compression this is home; the read is patience, not action.',
    guard:  coil.coilLow != null
      ? `The coil floor (~₹${Math.round(coil.coilLow)}). A break below it on volume is the Shatter case — the same stored energy, downward.`
      : 'Daily pivot S1 or the 20 EMA — the downside release line.',
  });
  const chartAnnotations: ChartAnnotations = {
    cycleLabels: buildCycleLabels(weekly),
    entryZones: buildStandardZones(personas),
    horizontalLines: buildStandardLines(keyLevels),
  };

  const { phase, tone } = derivePhase(coil);
  const currentSituation = buildSituation(coil, whatConfirms);

  const data: SetupData = {
    setupKey: 'flower_pot_burst',
    setupLabel: 'Flower Pot Burst',
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
      'A coil stores energy without declaring direction — the same compression powers a Burst up and a Shatter down. Historically the mistake was anticipating the direction; the pattern only pays after the release bar, and the coil boundary lines above are where that verdict prints.',
  };
  return data;
};

function derivePhase(coil: CoilRead): { phase: string; tone: 'bull' | 'bear' | 'neutral' } {
  if (coil.released === true) {
    return coil.releasedUp
      ? { phase: 'Burst ↑', tone: 'bull' }
      : { phase: 'Shatter ↓', tone: 'bear' };
  }
  const compressed = (coil.rangeRatio ?? 1) < 0.75 && (coil.volRatio ?? 1) < 0.7;
  if (compressed) return { phase: 'Coiling', tone: 'neutral' };
  return { phase: 'Coil read', tone: 'neutral' };
}

function buildWhatConfirms(latest: LatestEodRow, coil: CoilRead): WhatConfirmsItem[] {
  return [
    {
      label: 'Range contracting (weekly proxy)',
      state: check(coil.rangeRatio != null ? coil.rangeRatio < 0.75 : null),
      explain: coil.rangeRatio != null
        ? `Recent 4-week range ${(coil.rangeRatio * 100).toFixed(0)}% of the 12-week norm — the walls closing in. (Daily coil metrics live in the scan; this is the weekly read.)`
        : 'Need ~14 weekly bars for the compression read.',
    },
    {
      label: 'Volume dying (weekly proxy)',
      state: check(coil.volRatio != null ? coil.volRatio < 0.7 : null),
      explain: coil.volRatio != null
        ? `Recent 4-week volume ${(coil.volRatio * 100).toFixed(0)}% of the 12-week norm — participation drying up inside the coil.`
        : 'Need ~14 weekly bars for the volume read.',
    },
    {
      label: 'Relative strength flat',
      state: check(coil.rsDrift != null ? coil.rsDrift < 3 : null),
      explain: coil.rsDrift != null
        ? `Magic RS drifted ${coil.rsDrift.toFixed(1)} pts over 4 weeks — nobody winning the argument yet.`
        : 'Magic RS history insufficient.',
    },
    {
      label: 'Coil released on volume',
      state: check(coil.released),
      explain: coil.released != null
        ? coil.released
          ? `Latest bar closed ${coil.releasedUp ? 'ABOVE the coil ceiling' : 'BELOW the coil floor'} on 2×+ volume — the release has printed.`
          : `Still inside the coil (${coil.coilLow != null && coil.coilHigh != null ? `₹${Math.round(coil.coilLow)}–₹${Math.round(coil.coilHigh)}` : 'range forming'}). Not a failure — the pattern IS the wait.`
        : 'Coil range not yet established.',
    },
    {
      label: 'Not in a markdown stage',
      state: check(latest.stage != null ? latest.stage !== 'S3' && latest.stage !== 'S4' : null),
      explain: latest.stage != null
        ? `Weinstein stage ${latest.stage} — the scan excludes S3/S4 coils (compression inside a downtrend resolves down too often).`
        : 'Stage not classified.',
    },
    {
      label: 'Delivery present on the release',
      state: check(latest.delivery_pct != null ? latest.delivery_pct >= 45 : null),
      explain: latest.delivery_pct != null
        ? `Delivery ${latest.delivery_pct.toFixed(0)}% — the scan requires the burst bar to be taken home (${fmt(latest.close)}).`
        : 'Delivery % unavailable.',
    },
  ];
}

function buildSituation(coil: CoilRead, confirms: WhatConfirmsItem[]): CurrentSituation {
  const met = confirms.filter((c) => c.state === 'met').length;
  const total = confirms.length;
  let verdict: string;
  let tone: 'bull' | 'bear' | 'neutral';
  if (coil.released === true) { verdict = coil.releasedUp ? 'Burst printed' : 'Shatter printed'; tone = coil.releasedUp ? 'bull' : 'bear'; }
  else if (met >= 3) { verdict = 'Coiling'; tone = 'neutral'; }
  else { verdict = 'Coil read'; tone = 'neutral'; }

  const parts: string[] = [`${met} of ${total} coil criteria met.`];
  if (coil.coilLow != null && coil.coilHigh != null) {
    parts.push(`Coil range ₹${Math.round(coil.coilLow)}–₹${Math.round(coil.coilHigh)}.`);
  }
  parts.push(coil.released === true
    ? 'Energy released — the story is now follow-through versus retrace.'
    : 'Energy still stored — direction undeclared until the range breaks on volume.');
  return { verdict, verdictTone: tone, narrative: parts.join(' ') };
}
