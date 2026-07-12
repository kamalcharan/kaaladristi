import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PulseStudySwitch, { PulseStudyHint } from '@/components/domain/PulseStudySwitch';
import { useIndexDetail } from '@/hooks/useSectorRotation';
import { useVisualPulse } from '@/hooks/useVisualPulse';
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
import { CorrelationCard, OrderFlowCard, SmartMoneyCard, DivergenceCard, VaNiHeader, VaNiSentence } from './index';
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

export default function VisualPulsePage() {
  const { indexId } = useParams<{ indexId: string }>();
  const numId = indexId ? parseInt(indexId, 10) : null;
  const navigate = useNavigate();

  const { bars, dcInferences, isLoading, error } = useVisualPulse(numId);
  // Header label was hardcoded "NIFTY 50" regardless of the viewed index —
  // resolve the real name (fixed alongside Phase 1, owner request).
  const { data: indexMeta } = useIndexDetail(numId ?? undefined);

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

  // Drag-to-pan from the chart — direct index updates, no fade (a fade
  // timeout per pointermove would make dragging feel laggy).
  const handleChartScrub = useCallback((idx: number) => {
    setActiveIndex(idx);
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>Loading Visual Pulse...</div>
    );
  }

  if (error || bars.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>{error ? `Error: ${error.message}` : 'No data available'}</div>
    );
  }

  const bar = snapshot?.bar ?? bars[effectiveIdx];
  const isNow = effectiveIdx === bars.length - 1;

  // Flow narrative (for order flow card)
  const flowNarrative = snapshot
    ? buildFlowNarrative(snapshot)
    : '';

  // SM narrative (for smart money card)
  const smNarrative = snapshot
    ? buildSmNarrative(snapshot)
    : '';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 380px',
      gridTemplateRows: '1fr 58px',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--kd-bg)',
    }}>
      {/* Left Panel — Chart + Astro */}
      <div style={{
        gridColumn: 1, gridRow: 1,
        display: 'flex', flexDirection: 'column',
        padding: '12px 16px',
        overflow: 'hidden',
      }}>
        {/* Top bar mini */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
        }}>
          <span style={{
            fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: 2,
          }}>
            DristiQ
          </span>
          <span style={{
            fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700,
            color: 'var(--text-primary)',
          }}>{indexMeta?.name ?? '…'}</span>
          <span style={{
            fontSize: 15, fontFamily: 'var(--font-mono, monospace)',
            color: bar.close >= (bar.open ?? 0) ? 'var(--risk-green)' : 'var(--risk-red)',
          }}>{bar.close?.toLocaleString()}</span>
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-muted)',
          }}>
            Candle {effectiveIdx + 1} / {bars.length}
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <PulseStudySwitch active="pulse" type="index" id={numId!} />
          </span>
        </div>
        <PulseStudyHint />

        {/* Chart */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <VisualPulseChart
            bars={bars}
            activeIndex={effectiveIdx}
            corrHistory={corrHistory}
            dotsHistory={dotsHistory}
            onScrub={handleChartScrub}
          />
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 14, padding: '4px 0',
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
        }}>
          <span><span style={{ color: 'var(--accent-gold)' }}>╌</span> Golden Line</span>
          <span><span style={{ color: 'var(--accent-violet)' }}>{'\u25CF'}</span> SVD</span>
          <span><span style={{ color: 'var(--accent-indigo)' }}>{'\u25CF'}</span> SBD</span>
          <span><span style={{ color: 'var(--risk-amber)' }}>{'\u25CF'}</span> SYD</span>
        </div>

        {/* Astro Strip */}
        <AstroStrip dcInferences={dcInferences} activeDate={bar.trade_date} />
      </div>

      {/* Right Panel — VaNi + Cards */}
      <div style={{
        gridColumn: 2, gridRow: 1,
        borderLeft: '1px solid var(--kd-border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* VaNi Header */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--kd-border)' }}>
          <VaNiHeader
            date={bar.trade_date}
            barPosition={isNow ? 'NOW' : `Candle ${effectiveIdx + 1} / ${bars.length}`}
            isThinking={isFading}
          />
        </div>

        {/* Scrollable cards */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          opacity: isFading ? 0.3 : 1,
          transition: 'opacity 0.15s ease',
        }}>
          {snapshot && (
            <>
              {/* VaNi Narrative — AI only, no fallback */}
              <VaNiSentence
                narrative={null}
                corrState={snapshot.corrState}
                date={bar.trade_date}
                isFading={isFading}
                onStudyClick={() => navigate(`/chart/index/${numId}`)}
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

      {/* Bottom — Timeline Slider */}
      <div style={{ gridColumn: '1 / -1', gridRow: 2 }}>
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

  if (sm.hasSVD5) parts.push('SVD signal in last 5 bars — institutional volume confirmed.');
  if (sm.hasSYD) parts.push('SYD present — falling flow caution.');
  if (sm.pumpSignal) parts.push('Smart declining while fast rising — pump signature.');

  if (sm.relationship === 'Aligned') parts.push('Both layers aligned.');
  else if (sm.relationship === 'Diverging') parts.push('Layers diverging — elevated risk.');

  return parts.join(' ');
}
