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
  type PulseSnapshot,
  type CorrelationState,
  type DotSignals,
} from '@/services/visualPulseEngine';
import VisualPulseChart from './VisualPulseChart';
import TimelineSlider from './TimelineSlider';
import PulseVerdictBand from './PulseVerdictBand';

// ── Main Page ───────────────────────────────────────────────────
// Strip-to-the-studs pass 2026-07-06 (owner: "everything is bothering me").
// The Pulse contract is a 4–5 second verdict, no widgets — so the page is
// exactly: identity row → verdict hero → chart → timeline replay. The
// evidence cards (Order Flow / Smart Money / Divergence / Magic RS / astro
// strip) live on Study, one click away via the hero's CTA and the switch.

export default function VisualPulsePage() {
  const { indexId } = useParams<{ indexId: string }>();
  const numId = indexId ? parseInt(indexId, 10) : null;
  const navigate = useNavigate();

  const { bars, dcInferences, isLoading, error } = useVisualPulse(numId);
  const { data: indexMeta } = useIndexDetail(numId ?? undefined);

  // AI narrative for the LATEST bar only — one cached call per instrument per
  // day (platform VaNi presence pattern). Scrubbing never fires LLM calls.
  const insightQuery = useInstrumentInsight(numId ?? 0, 'index');

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>('Balanced');
  const [isFading, setIsFading] = useState(false);

  const effectiveIdx = activeIndex ?? (bars.length > 0 ? bars.length - 1 : 0);

  const dotsHistory: DotSignals[] = useMemo(() => {
    return bars.map((b, i) => computeDots(b, i > 0 ? bars[i - 1] : null));
  }, [bars]);

  const corrHistory: CorrelationState[] = useMemo(() => {
    if (bars.length === 0) return [];
    return computeCorrHistory(bars, dcInferences, selectedStyle);
  }, [bars, dcInferences, selectedStyle]);

  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (bars.length === 0) return null;
    return computePulseSnapshot(bars, effectiveIdx, dcInferences, selectedStyle);
  }, [bars, effectiveIdx, dcInferences, selectedStyle]);

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
  const prevClose = effectiveIdx > 0 ? bars[effectiveIdx - 1].close : null;
  const pctChng = prevClose ? ((bar.close - prevClose) / prevClose) * 100 : null;

  return (
    <div className="h-full overflow-hidden bg-kd-bg flex flex-col">

      {/* Scrollable content — one centered column, capped for wide monitors */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto h-full flex flex-col px-4 pt-4 pb-2">

          {/* Identity row */}
          <div className="flex items-baseline gap-3 flex-wrap mb-1 shrink-0">
            <span className="text-lg font-serif font-bold text-primary leading-none">
              {indexMeta?.name ?? '…'}
            </span>
            <span
              className="text-lg font-mono font-semibold"
              style={{ color: (pctChng ?? 0) >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}
            >
              {bar.close?.toLocaleString('en-IN')}
            </span>
            {pctChng != null && (
              <span
                className="text-xs font-mono"
                style={{ color: pctChng >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}
              >
                {pctChng >= 0 ? '+' : ''}{pctChng.toFixed(2)}%
              </span>
            )}
            <span className="ml-auto">
              <PulseStudySwitch active="pulse" type="index" id={numId!} />
            </span>
          </div>
          <PulseStudyHint />

          {/* Verdict hero — the point of the page */}
          {snapshot && (
            <div className="mt-2 shrink-0">
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
            </div>
          )}

          {/* Chart — the visual gut-check */}
          <div className="flex-1 min-h-[280px] mt-3">
            <VisualPulseChart
              bars={bars}
              activeIndex={effectiveIdx}
              corrHistory={corrHistory}
              dotsHistory={dotsHistory}
              showConvergenceBand={false}
            />
          </div>

          {/* Legend */}
          <div className="flex gap-4 py-1.5 text-[10px] font-mono text-muted flex-wrap shrink-0">
            <span><span style={{ color: 'var(--accent-gold)' }}>╌</span> Golden Line (SMA 150)</span>
            <span><span style={{ color: 'var(--accent-violet)' }}>●</span> Volume Drive</span>
            <span><span style={{ color: 'var(--accent-indigo)' }}>●</span> Rising Flow</span>
            <span><span style={{ color: 'var(--risk-amber)' }}>●</span> Falling Flow</span>
          </div>
        </div>
      </div>

      {/* Timeline replay — the differentiator, pinned */}
      <div className="shrink-0">
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
