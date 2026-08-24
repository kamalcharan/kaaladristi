/**
 * Waking Giants v4 journey adapters — Stirring / Waking Giants / Ascent.
 *
 * ONE shared builder (the owner's code-reuse contract), three voices.
 * The story is the Hibernation → Wake → Ascent journey (POA:
 * docs/claude/waking-giants-poa.md): a multi-year consolidation around
 * a flat Golden Line (SMA 150), broken by a close printing its highest
 * level in years, confirmed as timeframe alignment builds.
 *
 * The adapter re-derives the base/wake read from the 5-year weekly
 * window it receives (the deep 15-yr read lives in km_wg_journeys /
 * the scanner; here we tell the visible part of the story on the
 * chart's own data). All surfaced copy is D39-observational.
 */

import type {
  SetupAdapter,
  SetupData,
  WeeklyBar,
  LatestEodRow,
  EquityIdentity,
  CycleLabel,
  WhatConfirmsItem,
} from '../setupAdapter';
import {
  buildStandardKeyLevels,
  buildStandardLines,
  buildStandardPersonas,
  buildStandardZones,
  check,
  fmt,
  weeklyEma50,
} from '../adapterUtils';

type WgState = 'stirring' | 'waking' | 'ascent';

const BULL_ZONES = new Set(['Strong Bull', 'Mild Bull', 'Neutral Bull']);

/** Weekly wake read on the visible window: the most recent weekly close
 *  that exceeded the prior 104-week max after a drought of >= 78 weeks
 *  (~1.5y — the window-scale echo of the engine's 2-yr floor). */
function findWeeklyWake(weekly: WeeklyBar[]) {
  const n = weekly.length;
  if (n < 130) return null;
  for (let i = n - 1; i >= 104; i--) {
    const c = weekly[i].close;
    let priorMax = -Infinity;
    for (let j = i - 104; j < i; j++) priorMax = Math.max(priorMax, weekly[j].close);
    if (c <= priorMax) continue;
    // drought: last week (before i) at/above this close
    let last = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (weekly[j].close >= c) { last = j; break; }
    }
    const droughtWeeks = last === -1 ? i : i - last;
    if (droughtWeeks >= 78) {
      return { wakeIdx: i, wakeLevel: priorMax, baseStartIdx: Math.max(0, last === -1 ? 0 : last) };
    }
  }
  return null;
}

function buildWgStory(state: WgState, setupKey: string, setupLabel: string): SetupAdapter {
  return (weekly: WeeklyBar[], latest: LatestEodRow, identity: EquityIdentity): SetupData => {
    const ema50w = weeklyEma50(weekly);
    const gl = latest.sma_150;
    const glDist = gl != null && gl > 0 ? ((latest.close / gl - 1) * 100) : null;
    const lastW = weekly.length ? weekly[weekly.length - 1] : null;

    const wake = findWeeklyWake(weekly);
    const wakeLevel = wake?.wakeLevel ?? null;
    const yearsSpanned = (a: WeeklyBar, b: WeeklyBar) =>
      Math.max(0.1, (new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime()) / (365.25 * 24 * 3600 * 1000));

    // ── Cycle bands: hibernation → waking/ascent ──
    const cycleLabels: CycleLabel[] = [];
    if (weekly.length > 10) {
      const first = weekly[0];
      const last = weekly[weekly.length - 1];
      if (wake) {
        const baseFrom = weekly[wake.baseStartIdx];
        const wakeBar = weekly[wake.wakeIdx];
        const sleptY = yearsSpanned(baseFrom, wakeBar);
        cycleLabels.push({
          from: baseFrom.trade_date, to: wakeBar.trade_date,
          label: `${sleptY >= 4.5 ? 'LONG ' : ''}HIBERNATION · ~${sleptY.toFixed(1)}Y QUIET`,
          tone: 'neutral',
        });
        cycleLabels.push({
          from: wakeBar.trade_date, to: last.trade_date,
          label: state === 'ascent' ? 'ASCENT · JOURNEY IN PROGRESS' : 'WAKE · CEILING BROKEN',
          tone: 'bull',
        });
      } else {
        cycleLabels.push({
          from: first.trade_date, to: last.trade_date,
          label: state === 'stirring' ? 'HIBERNATION · QUIET BUILDING' : 'LONG CONSOLIDATION',
          tone: 'neutral',
        });
      }
    }

    // ── Levels ──
    const keyLevels = buildStandardKeyLevels(latest, ema50w);
    const lines = buildStandardLines(keyLevels);
    if (wakeLevel != null && Number.isFinite(wakeLevel)) {
      lines.push({ price: wakeLevel, label: 'Wake Level (old ceiling)', tone: 'bull' });
    }

    // ── Alignment read from what the chart data carries ──
    const dGreen = latest.magic_rs_zone != null ? BULL_ZONES.has(latest.magic_rs_zone) : null;
    const wGreen = lastW?.magic_rs_zone != null ? BULL_ZONES.has(lastW.magic_rs_zone) : null;
    const aboveGl = gl != null ? latest.close > gl : null;
    const aboveWake = wakeLevel != null ? latest.close > wakeLevel : null;
    const glRising = gl != null && latest.sma_50 != null ? latest.sma_50 > gl : null;

    // ── Voice per state ──
    const phase = state === 'ascent' ? 'Continuation' : state === 'waking' ? 'Breakout' : 'Setup';
    const narrative =
      state === 'stirring'
        ? `${identity.symbol} sits inside a long quiet stretch — price oscillating around the Golden Line with delivery-heavy, low-noise sessions clustering above its own norm. No ceiling has broken; these are sleeping-giant conditions to observe, not signals.`
        : state === 'waking'
          ? `${identity.symbol} has printed its highest close in years, at ${glDist != null ? `${glDist.toFixed(0)}% ${glDist >= 0 ? 'above' : 'below'}` : 'near'} the Golden Line. A multi-year ceiling breaking is the first session of a structural transition — the read strengthens as weekly and monthly timeframes align, and fades if the close slips back under the old ceiling.`
          : `${identity.symbol} is past its wake — the old ceiling broke and the multi-timeframe alignment confirmed. The journey read stays constructive while price holds above the Golden Line; a weekly close below it marks rest, and the read retires only when the timeframe alignment goes dark.`;

    const verdict = state === 'stirring' ? 'Quiet building' : state === 'waking' ? 'Ceiling broken' : 'Journey intact';

    // ── What confirms — mirrors the journey engine's gates ──
    const whatConfirms: WhatConfirmsItem[] = [
      { label: 'Close above the Golden Line (SMA 150)', state: check(aboveGl),
        explain: `Golden Line ${fmt(gl)} vs close ${fmt(latest.close)} — the wake definition requires the break to happen at or above it.` },
      { label: 'Old ceiling broken and holding', state: check(aboveWake),
        explain: wakeLevel != null ? `Wake level ${fmt(wakeLevel)} — the highest prior close of the visible multi-year range.` : 'No multi-year ceiling break visible in the 5-year window yet.' },
      { label: 'Daily MagicRS on the constructive side', state: check(dGreen),
        explain: `Daily zone: ${latest.magic_rs_zone ?? '—'}. Counts 1 point of the 6-point timeframe alignment.` },
      { label: 'Weekly MagicRS on the constructive side', state: check(wGreen),
        explain: `Weekly zone: ${lastW?.magic_rs_zone ?? '—'}. Counts 2 points — the weekly clock turning carries more structural weight.` },
      { label: 'Golden Line curling up (50 SMA above it)', state: check(glRising),
        explain: 'A rising Golden Line marks the consolidation resolving upward rather than continuing sideways.' },
      { label: 'Delivery participation above the stock\'s own norm', state: check(latest.delivery_pct != null ? latest.delivery_pct >= 45 : null),
        explain: `Latest delivery ${latest.delivery_pct != null ? latest.delivery_pct.toFixed(0) + '%' : '—'}. The journey engine measures this against the stock's own 60-session baseline; the scanner row carries the full count.` },
    ];

    const personas = buildStandardPersonas(latest, weekly, ema50w, {
      shelf: 'The prior 20-week high — where the post-wake structure last paused.',
      ema: 'The weekly 50 EMA — the structural line long journeys historically retest.',
      consol: 'Top of the prior 8-week consolidation — continuation reference inside the journey.',
      r1: 'Daily pivot R1 — where near-term follow-through historically registered.',
      pp: 'Daily pivot — the session\'s balance point.',
      guard: 'Support-test zone — max of pivot S1 and the 20 EMA.',
    });

    return {
      setupKey,
      setupLabel,
      header: {
        symbol: identity.symbol,
        companyName: identity.company_name,
        exchange: identity.exchange,
        industry: identity.industry,
        close: latest.close,
        pctChng: latest.pct_chng,
        rsPercentile: latest.rs_percentile,
        phase,
        phaseTone: state === 'stirring' ? 'neutral' : 'bull',
      },
      keyLevels,
      currentSituation: { verdict, verdictTone: state === 'stirring' ? 'neutral' : 'bull', narrative },
      chartAnnotations: {
        cycleLabels,
        entryZones: buildStandardZones(personas),
        horizontalLines: lines,
      },
      personas,
      whatConfirms,
      investorTip:
        state === 'stirring'
          ? 'A hibernation is only a story after it breaks — quiet building marks which sleeps are worth watching, nothing more.'
          : state === 'waking'
            ? 'Historically, multi-year ceiling breaks resolved over quarters, not sessions — the alignment building across timeframes is the read, not the breakout day itself.'
            : 'Long journeys rest — a pause below the Golden Line has historically been part of the pattern, not the end of it, while the timeframe alignment stays constructive.',
    };
  };
}

export const wakingGiantsAdapter = buildWgStory('waking', 'waking_giants', 'Waking Giants');
export const wgAscentAdapter    = buildWgStory('ascent', 'wg_ascent', 'Ascent');
export const wgStirringAdapter  = buildWgStory('stirring', 'wg_stirring', 'Stirring');
