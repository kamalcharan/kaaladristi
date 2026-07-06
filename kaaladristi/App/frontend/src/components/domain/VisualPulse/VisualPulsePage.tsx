import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PulseStudySwitch, { PulseStudyHint } from '@/components/domain/PulseStudySwitch';
import { useIndexDetail } from '@/hooks/useSectorRotation';
import { useVisualPulse } from '@/hooks/useVisualPulse';
import { useInstrumentInsight } from '@/hooks';
import {
  computePulseSnapshot,
  computeCorrHistory,
  computeDots,
  type TradingStyle,
  type PulseBar,
  type PulseSnapshot,
  type CorrelationState,
  type DotSignals,
} from '@/services/visualPulseEngine';
import VisualPulseChart from './VisualPulseChart';
import AstroStrip from './AstroStrip';
import TimelineSlider from './TimelineSlider';
import PulseVerdictBand from './PulseVerdictBand';
import { OrderFlowCard, SmartMoneyCard, DivergenceCard, VaNiHeader } from './index';
import type { SmartMoneyBar } from './SmartMoneyCard';

// ── Helpers ─────────────────────────────────────────────────────

function buildSmHistory(bars: PulseBar[], dotsHistory: DotSignals[]): SmartMoneyBar[] {
  return bars.map((b, i) => ({
    sm: b.sniper_inst ?? 0,
    fm: b.sniper_hot ?? 0,
    isSVD: dotsHistory[i]?.isSVD ?? false,
    isSBD: dotsHistory[i]?.isSBD ?? false,
    isSYD: dotsHistory[i]?.isSYD ?? false,
  }));
}

function buildRssHistory(bars: PulseBar[]): number[] {
  return bars.map((b) => b.rss_value ?? 0);
}

// ── Main Page ───────────────────────────────────────────────────
// Layout pass 2026-07-06: verdict-first restructure on the shared responsive
// shell (same shell as EquityVisualPulsePage). The PulseVerdictBand above the
// chart replaces the sidebar's VaNiSentence + CorrelationCard; the sidebar
// keeps only the evidence trio (Order Flow / Smart Money / Divergence).

export default function VisualPulsePage() {
  const { indexId } = useParams<{ indexId: string }>();
  const numId = indexId ? parseInt(indexId, 10) : null;
  const navigate = useNavigate();

  const { bars, dcInferences, isLoading, error } = useVisualPulse(numId);
  // Header label was hardcoded "NIFTY 50" regardless of the viewed index —
  // resolve the real name (fixed alongside Phase 1, owner request).
  const { data: indexMeta } = useIndexDetail(numId ?? undefined);

  // AI narrative for the LATEST bar only — one cached call per instrument per
  // day (platform VaNi presence pattern). Scrubbing never fires LLM calls.
  const insightQuery = useInstrumentInsight(numId ?? 0, 'index');

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>('Balanced');
  const [isFading, setIsFading] = useState(false);

  // Default to latest bar when data loads
  const effectiveIdx = activeIndex ?? (bars.length > 0 ? bars.length - 1 : 0);

  // Pre-compute dots for all bars
  const dotsHistory: DotSignals[] = useMemo(() => {
    return bars.map((b, i) => computeDots(b, i > 0 ? bars[i - 1] : null));
  }, [bars]);

  // Pre-compute correlation history (recompute when style changes)
  const corrHistory: CorrelationState[] = useMemo(() => {
    if (bars.length === 0) return [];
    return computeCorrHistory(bars, dcInferences, selectedStyle);
  }, [bars, dcInferences, selectedStyle]);

  // Compute snapshot for active bar
  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (bars.length === 0) return null;
    return computePulseSnapshot(bars, effectiveIdx, dcInferences, selectedStyle);
  }, [bars, effectiveIdx, dcInferences, selectedStyle]);

  // Smart money history (last 30 bars up to active)
  const smHistory: SmartMoneyBar[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 29);
    const slice = bars.slice(start, effectiveIdx + 1);
    const dotsSlice = dotsHistory.slice(start, effectiveIdx + 1);
    return buildSmHistory(slice, dotsSlice);
  }, [bars, effectiveIdx, dotsHistory]);

  // RSS history (last 20 values up to active)
  const rssHistory: number[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return buildRssHistory(bars.slice(start, effectiveIdx + 1));
  }, [bars, effectiveIdx]);

  // Price + RSI history for divergence card (last 20)
  const priceHistory = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return bars.slice(start, effectiveIdx + 1).map((b) => b.close);
  }, [bars, effectiveIdx]);

  const rsiHistory = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return bars.slice(start, effectiveIdx + 1).map((b) => b.rsi_14 ?? 50);
  }, [bars, effectiveIdx]);

  // Slider change with fade animation
  const handleSliderChange = useCallback((idx: number) => {
    setIsFading(true);
    setTimeout(() => {
      setActiveIndex(idx);
      setIsFading(false);
    }, 180);
  }, []);

  const handleStyleChange = useCallback((style: TradingStyle) => {
    setIsFading(true);
    setTimeout(() => {
      setSelectedStyle(style);
      setIsFading(false);
    }, 150);
  }, []);

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        Loading Visual Pulse...
      </div>
    );
  }

  if (error || bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        {error ? `Error: ${error.message}` : 'No data available'}
      </div>
    );
  }

  const bar = snapshot?.bar ?? bars[effectiveIdx];
  const isNow = effectiveIdx === bars.length - 1;

  // Flow narrative (for order flow card)
  const flowNarrative = snapshot ? buildFlowNarrative(snapshot) : '';

  // SM narrative (for smart money card)
  const smNarrative = snapshot ? buildSmNarrative(snapshot) : '';

  return (
    <div className="h-full overflow-hidden bg-kd-bg flex flex-col lg:grid lg:grid-cols-[1fr_340px] lg:grid-rows-[1fr_58px]">

      {/* ── Left Panel — Verdict + Chart + Astro ── */}
      <div className="flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden lg:col-start-1 lg:row-start-1 px-3 pt-3 pb-2 md:px-4">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <span className="text-base font-serif font-bold text-primary leading-none">
            {indexMeta?.name ?? '…'}
          </span>
          <span
            className="text-[15px] font-mono"
            style={{ color: bar.close >= (bar.open ?? 0) ? 'var(--risk-green)' : 'var(--risk-red)' }}
          >
            {bar.close?.toLocaleString('en-IN')}
          </span>
          <span className="ml-auto">
            <PulseStudySwitch active="pulse" type="index" id={numId!} />
          </span>
        </div>
        <PulseStudyHint />

        {/* Verdict band — the 5-second answer, first thing the eye lands on */}
        {snapshot && (
          <PulseVerdictBand
            corrState={snapshot.corrState}
            astroScore={snapshot.astroScore}
            techScore={snapshot.techScore}
            smScore={snapshot.smScore}
            selectedStyle={selectedStyle}
            onStyleChange={handleStyleChange}
            date={bar.trade_date}
            isNow={isNow}
            isFading={isFading}
            narrative={insightQuery.data?.ai ? insightQuery.data.insight : null}
            narrativeLoading={insightQuery.isLoading}
            onStudyClick={() => navigate(`/chart/index/${numId}`)}
          />
        )}

        {/* Chart */}
        <div className="flex-1 min-h-[200px]">
          <VisualPulseChart
            bars={bars}
            activeIndex={effectiveIdx}
            corrHistory={corrHistory}
            dotsHistory={dotsHistory}
          />
        </div>

        {/* Legend — mapped vocabulary, same as equity VP */}
        <div className="flex gap-3.5 py-1 text-[10px] font-mono text-muted flex-wrap">
          <span><span style={{ color: 'var(--accent-gold)' }}>╌</span> Golden Line (SMA 150)</span>
          <span><span style={{ color: 'var(--accent-violet)' }}>●</span> Volume Drive</span>
          <span><span style={{ color: 'var(--accent-indigo)' }}>●</span> Rising Flow</span>
          <span><span style={{ color: 'var(--risk-amber)' }}>●</span> Falling Flow</span>
        </div>

        {/* Astro Strip */}
        <AstroStrip dcInferences={dcInferences} activeDate={bar.trade_date} />
      </div>

      {/* ── Right Sidebar — evidence trio ── */}
      <div className="border-t lg:border-t-0 lg:border-l border-kd-border flex flex-col min-h-0 lg:col-start-2 lg:row-start-1 overflow-hidden">

        {/* VaNi Header */}
        <div className="px-3 py-2 border-b border-kd-border shrink-0">
          <VaNiHeader
            date={bar.trade_date}
            barPosition={isNow ? 'NOW' : `Candle ${effectiveIdx + 1} / ${bars.length}`}
            isThinking={isFading}
          />
        </div>

        {/* Scrollable cards */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 flex flex-col gap-2.5"
          style={{ opacity: isFading ? 0.3 : 1, transition: 'opacity 0.15s ease' }}
        >
          {snapshot && (
            <>
              {/* Order Flow + RSS */}
              <OrderFlowCard
                bar={snapshot.bar}
                rss={snapshot.rss}
                rssHistory={rssHistory}
                narrative={flowNarrative}
              />

              {/* Smart Money */}
              <SmartMoneyCard
                smHistory={smHistory}
                sm={snapshot.sm}
                dots={[snapshot.dots]}
                narrative={smNarrative}
              />

              {/* Divergence */}
              <DivergenceCard
                divergence={snapshot.divergence}
                rsiHistory={rsiHistory}
                priceHistory={priceHistory}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Bottom — Timeline Slider ── */}
      <div className="lg:col-span-2 lg:row-start-2 shrink-0">
        <TimelineSlider
          total={bars.length}
          activeIndex={effectiveIdx}
          bars={bars}
          corrHistory={corrHistory}
          onChange={handleSliderChange}
        />
      </div>
    </div>
  );
}

// ── Card-specific narrative builders ────────────────────────────

function buildFlowNarrative(snap: PulseSnapshot): string {
  const parts: string[] = [];
  const ft = snap.bar.flow_type;
  const rvol = snap.bar.rvol ?? 0;

  if (ft === 'FRESH_LONGS') parts.push('Fresh capital entering.');
  else if (ft === 'SHORT_COVERING') parts.push('Shorts unwinding — watch for confirmation.');
  else if (ft === 'FRESH_SHORTS') parts.push('Selling pressure building.');
  else if (ft === 'LONG_LIQUIDATION') parts.push('Longs exiting — exhaustion watch.');
  else if (ft === 'LOW_VOLUME') parts.push('Volume absent.');
  else parts.push('Mixed flow signals.');

  if (rvol > 2) parts.push(`High conviction volume (RVOL ${rvol.toFixed(1)}x).`);
  else if (rvol < 0.5) parts.push('Thin volume — signals unreliable.');

  if (snap.rss.zone === 'OVERBOUGHT') parts.push('RSS overbought — momentum stretched.');
  else if (snap.rss.zone === 'OVERSOLD') parts.push('RSS at floor — reversal watch.');
  else if (snap.rss.spreadRepaired) parts.push('Structural spread positive.');

  return parts.join(' ');
}

function buildSmNarrative(snap: PulseSnapshot): string {
  const parts: string[] = [];
  const sm = snap.sm;

  if (sm.smTrending) parts.push('Smart money trending higher.');
  else if (sm.smExiting) parts.push('Smart money declining — falling flow risk.');
  else parts.push('Smart money flat.');

  if (sm.hasSVD5) parts.push('Volume Drive signal in last 5 bars — institutional volume confirmed.');
  if (sm.hasSYD) parts.push('Falling flow signal present — caution.');
  if (sm.pumpSignal) parts.push('Smart declining while fast rising — pump signature.');

  if (sm.relationship === 'Aligned') parts.push('Both layers aligned.');
  else if (sm.relationship === 'Diverging') parts.push('Layers diverging — elevated risk.');

  return parts.join(' ');
}
