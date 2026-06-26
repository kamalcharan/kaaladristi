/**
 * EquityVisualPulsePage — Equity-specific Visual Pulse
 * =====================================================
 * Full-page equity analysis: price chart with SMA 21/55/150,
 * Magic RS subchart, astro strip, manipulation banner,
 * sidebar cards (scan presence, industry context, smart money,
 * order flow, divergence).
 *
 * Architecture: separate page from IndexVisualPulsePage,
 * sharing atomic components (chart, cards, slider, astro strip).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useEquityVisualPulse } from '@/hooks/useEquityVisualPulse';
import type { EquityPulseBar } from '@/hooks/useEquityVisualPulse';
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
import VisualPulseChart from '../VisualPulseChart';
import AstroStrip from '../AstroStrip';
import TimelineSlider from '../TimelineSlider';
import {
  CorrelationCard,
  OrderFlowCard,
  SmartMoneyCard,
  DivergenceCard,
  VaNiHeader,
  VaNiSentence,
} from '../index';
import type { SmartMoneyBar } from '../SmartMoneyCard';
import MagicRsSubchart from '../MagicRsSubchart';
import MultiTimeframePills from './MultiTimeframePills';
import PumpDumpBanner, { scanBarsForManipulation } from './PumpDumpBanner';
import ScanPresenceCard from './ScanPresenceCard';
import IndustryContextCard from './IndustryContextCard';
import { useScanPresence } from '@/hooks/useScanPresence';

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

/** Compute Magic RS change over N bars */
function rsChangeLookback(bars: PulseBar[], idx: number, lookback: number): number | null {
  if (idx < lookback) return null;
  const current = bars[idx]?.magic_rs;
  const prior = bars[idx - lookback]?.magic_rs;
  if (current == null || prior == null) return null;
  return current - prior;
}

// ── Exchange badge color ────────────────────────────────────────

function exchangeColor(exchange: string | null): string {
  if (exchange === 'NSE') return 'text-accent-cyan';
  if (exchange === 'BSE') return 'text-risk-amber';
  return 'text-muted';
}

// ── Main Page ───────────────────────────────────────────────────

export default function EquityVisualPulsePage() {
  const { equityId: rawId } = useParams<{ equityId: string }>();
  const equityId = rawId ? parseInt(rawId, 10) : null;

  const {
    meta,
    bars,
    dcInferences,
    industryContext,
    isLoading,
    error,
  } = useEquityVisualPulse(equityId);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>('Balanced');
  const [isFading, setIsFading] = useState(false);

  const effectiveIdx = activeIndex ?? (bars.length > 0 ? bars.length - 1 : 0);

  // Scan presence (which scans contain this stock)
  const scanPresence = useScanPresence(equityId);

  // Pre-compute dots for all bars
  const dotsHistory: DotSignals[] = useMemo(() => {
    return bars.map((b, i) => computeDots(b, i > 0 ? bars[i - 1] : null));
  }, [bars]);

  // Pre-compute correlation history
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

  // Magic RS data for subchart
  const magicRsData = useMemo(() => {
    return bars.map((b) => ({
      trade_date: b.trade_date,
      magic_rs: b.magic_rs,
      magic_ma: b.magic_ma,
      magic_rs_zone: b.magic_rs_zone,
    }));
  }, [bars]);

  // Multi-timeframe RS deltas
  const rsChange1d = useMemo(() => rsChangeLookback(bars, effectiveIdx, 1), [bars, effectiveIdx]);
  const rsChange5d = useMemo(() => rsChangeLookback(bars, effectiveIdx, 5), [bars, effectiveIdx]);
  const rsChange20d = useMemo(() => rsChangeLookback(bars, effectiveIdx, 20), [bars, effectiveIdx]);

  // Pump/dump banner props
  // Scan all bars for pump/dump signals (not just current bar)
  const pumpDumpResult = useMemo(() => {
    if (bars.length === 0) return null;
    return scanBarsForManipulation(bars, 30);
  }, [bars]);

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
        Loading Equity Pulse...
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        {error ? `Error: ${(error as Error).message}` : 'Stock not found'}
      </div>
    );
  }

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        No EOD data available for {meta.symbol}
      </div>
    );
  }

  const bar = snapshot?.bar ?? bars[effectiveIdx];
  const equityBar = bars[effectiveIdx]; // typed as EquityPulseBar with pct_chng
  const isNow = effectiveIdx === bars.length - 1;
  const currentRs = bar?.magic_rs ?? null;

  // Determine if stock is inactive / delisted
  const isInactive = !meta.is_active;
  const lastTradeDate = bars[bars.length - 1]?.trade_date;

  // Data freshness — detect stale BSE-only stocks
  const todayIso = new Date().toISOString().split('T')[0];
  const daysSinceLastTrade = lastTradeDate
    ? Math.round((new Date(todayIso).getTime() - new Date(lastTradeDate).getTime()) / 86400000)
    : null;
  const isStaleData = daysSinceLastTrade != null && daysSinceLastTrade > 1 && !isInactive;

  // Insufficient history for Magic RS
  const hasRsData = bars.some((b) => b.magic_rs != null);
  const limitedHistory = bars.length < 60;

  // Flow narrative
  const flowNarrative = snapshot ? buildFlowNarrative(snapshot) : '';
  const smNarrative = snapshot ? buildSmNarrative(snapshot) : '';

  // ── Render ──

  return (
    <div className="h-full overflow-hidden bg-kd-bg flex flex-col lg:grid lg:grid-cols-[1fr_340px] lg:grid-rows-[1fr_58px]">

      {/* ── Left Panel — Header + Charts ── */}
      <div className="flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden lg:col-start-1 lg:row-start-1 px-3 pt-3 pb-2 md:px-4 md:pt-3">

        {/* Stock Header */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-mono font-bold ${exchangeColor(meta.exchange)}`}>
            {meta.exchange}
          </span>
          <span className="text-base font-serif font-bold text-primary leading-none">
            {meta.symbol}
          </span>
          <span className="text-xs text-secondary truncate max-w-[180px] md:max-w-none">
            {meta.company_name}
          </span>
          {meta.industry && (
            <span className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded bg-kd-elevated">
              {meta.industry}
            </span>
          )}
        </div>

        {/* Price line */}
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-lg font-mono font-bold ${bar.close >= bar.open ? 'text-risk-green' : 'text-risk-red'}`}>
            {'\u20B9'}{bar.close?.toLocaleString('en-IN')}
          </span>
          {equityBar?.pct_chng != null && (
            <span className={`text-xs font-mono ${(equityBar.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red'}`}>
              {(equityBar.pct_chng ?? 0) >= 0 ? '+' : ''}{(equityBar.pct_chng ?? 0).toFixed(2)}%
            </span>
          )}
          <span className="text-[10px] font-mono text-muted">
            {isNow ? 'Latest' : `Candle ${effectiveIdx + 1} / ${bars.length}`}
          </span>
          {isInactive && (
            <span className="text-[10px] font-mono text-risk-amber bg-risk-amber/10 px-1.5 py-0.5 rounded">
              Inactive — last traded {lastTradeDate}
            </span>
          )}
          {isStaleData && (
            <span className="text-[10px] font-mono text-muted">
              Last updated: {meta.exchange} {lastTradeDate} ({daysSinceLastTrade}d delayed)
            </span>
          )}
        </div>

        {/* Pump/Dump Banner */}
        {pumpDumpResult && <PumpDumpBanner result={pumpDumpResult} />}

        {/* Price Chart — uses shared VisualPulseChart */}
        <div className="flex-shrink-0 min-h-[180px] md:min-h-[220px] mt-1">
          <VisualPulseChart
            bars={bars}
            activeIndex={effectiveIdx}
            corrHistory={corrHistory}
            dotsHistory={dotsHistory}
          />
        </div>

        {/* Legend */}
        <div className="flex gap-3 py-1 text-[8px] font-mono text-muted flex-wrap">
          <span><span className="text-accent-gold">{'\u254C'}</span> Golden Line (SMA 150)</span>
          <span><span className="text-accent-violet">{'\u25CF'}</span> Volume Drive</span>
          <span><span className="text-accent-indigo">{'\u25CF'}</span> Rising Flow</span>
          <span><span className="text-risk-amber">{'\u25CF'}</span> Falling Flow</span>
        </div>

        {/* Astro Strip */}
        <AstroStrip dcInferences={dcInferences} activeDate={bar.trade_date} />

        {/* Magic RS Section */}
        <div className="mt-2">
          <MultiTimeframePills
            rsChange1d={rsChange1d}
            rsChange5d={rsChange5d}
            rsChange20d={rsChange20d}
            currentRs={currentRs}
            benchmarkLabel="NIFTY 500"
          />

          {hasRsData ? (
            <div className="mt-1">
              <MagicRsSubchart
                data={magicRsData}
                activeIndex={effectiveIdx}
                benchmarkLabel="NIFTY 500"
              />
              {limitedHistory && (
                <div className="text-[9px] font-mono text-muted text-center mt-0.5">
                  Limited history — fewer than 60 trading days available
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 py-4 text-center text-[11px] font-mono text-muted bg-kd-elevated rounded-lg border border-kd-border">
              Multi-benchmark RS not yet computed for this stock
            </div>
          )}
        </div>
      </div>

      {/* ── Right Sidebar ── */}
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
          className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-2.5"
          style={{
            opacity: isFading ? 0.3 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          {snapshot && (
            <>
              <VaNiSentence
                narrative={null}
                corrState={snapshot.corrState}
                date={bar.trade_date}
                isFading={isFading}
              />

              {/* Scan Presence */}
              <ScanPresenceCard
                stock={scanPresence.stock}
                matchedScans={scanPresence.matchedScans}
              />

              {/* Industry Context */}
              <IndustryContextCard
                industry={meta.industry}
                context={industryContext}
              />

              {/* Correlation */}
              <CorrelationCard
                astroScore={snapshot.astroScore}
                techScore={snapshot.techScore}
                smScore={snapshot.smScore}
                corrState={snapshot.corrState}
                selectedStyle={selectedStyle}
                onStyleChange={handleStyleChange}
              />

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

// ── Card-specific narrative builders (same as index VP) ─────────

function buildFlowNarrative(snap: PulseSnapshot): string {
  const parts: string[] = [];
  const ft = snap.bar.flow_type;
  const rvol = snap.bar.rvol ?? 0;

  if (ft === 'FRESH_LONGS') parts.push('Fresh capital entering.');
  else if (ft === 'SHORT_COVERING') parts.push('Shorts unwinding \u2014 watch for confirmation.');
  else if (ft === 'FRESH_SHORTS') parts.push('Selling pressure building.');
  else if (ft === 'LONG_LIQUIDATION') parts.push('Longs exiting \u2014 exhaustion watch.');
  else if (ft === 'LOW_VOLUME') parts.push('Volume absent.');
  else parts.push('Mixed flow signals.');

  if (rvol > 2) parts.push(`High conviction volume (RVOL ${rvol.toFixed(1)}x).`);
  else if (rvol < 0.5) parts.push('Thin volume \u2014 signals unreliable.');

  if (snap.rss.zone === 'OVERBOUGHT') parts.push('RSS overbought \u2014 momentum stretched.');
  else if (snap.rss.zone === 'OVERSOLD') parts.push('RSS at floor \u2014 reversal watch.');
  else if (snap.rss.spreadRepaired) parts.push('Structural spread positive.');

  return parts.join(' ');
}

function buildSmNarrative(snap: PulseSnapshot): string {
  const parts: string[] = [];
  const sm = snap.sm;

  if (sm.smTrending) parts.push('Smart money trending higher.');
  else if (sm.smExiting) parts.push('Smart money declining \u2014 falling flow risk.');
  else parts.push('Smart money flat.');

  if (sm.hasSVD5) parts.push('Volume Drive signal in last 5 bars \u2014 institutional volume confirmed.');
  if (sm.hasSYD) parts.push('Falling flow signal present \u2014 caution.');
  if (sm.pumpSignal) parts.push('Smart declining while fast rising \u2014 pump signature.');

  if (sm.relationship === 'Aligned') parts.push('Both layers aligned.');
  else if (sm.relationship === 'Diverging') parts.push('Layers diverging \u2014 elevated risk.');

  return parts.join(' ');
}
