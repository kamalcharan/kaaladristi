/**
 * EquityVisualPulsePage — Equity-specific Visual Pulse
 * =====================================================
 * Strip-to-the-studs pass 2026-07-06 (owner: "everything is bothering me").
 * The Pulse contract is a 4–5 second verdict, no widgets — the page is:
 * identity row → pump/dump warning → verdict hero → context line → chart →
 * timeline replay. The evidence cards (Order Flow / Smart Money /
 * Divergence / Magic RS subchart / MTF pills / astro strip) live on the
 * Study cockpit, one click away via the hero's CTA and the switch.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PulseStudySwitch, { PulseStudyHint } from '@/components/domain/PulseStudySwitch';
import { useEquityVisualPulse } from '@/hooks/useEquityVisualPulse';
import {
  computePulseSnapshot,
  computeCorrHistory,
  computeDots,
  type TradingStyle,
  type PulseSnapshot,
  type CorrelationState,
  type DotSignals,
} from '@/services/visualPulseEngine';
import VisualPulseChart from '../VisualPulseChart';
import TimelineSlider from '../TimelineSlider';
import PulseVerdictBand from '../PulseVerdictBand';
import PumpDumpBanner, { scanBarsForManipulation } from './PumpDumpBanner';
import { useScanPresence } from '@/hooks/useScanPresence';
import { useInstrumentInsight } from '@/hooks';

// ── Exchange badge color ────────────────────────────────────────

function exchangeColor(exchange: string | null): string {
  if (exchange === 'NSE') return 'text-accent-cyan';
  if (exchange === 'BSE') return 'text-risk-amber';
  return 'text-muted';
}

const ROTATION_LABEL: Record<string, { label: string; color: string }> = {
  rotating_in:  { label: '↑ Rotating In',  color: 'var(--risk-green)' },
  leading:      { label: 'Leading',        color: 'var(--accent-gold)' },
  rotating_out: { label: '↓ Rotating Out', color: 'var(--risk-red)' },
  stable:       { label: 'Stable',         color: 'var(--text-muted)' },
};

// ── Main Page ───────────────────────────────────────────────────

export default function EquityVisualPulsePage() {
  const { equityId: rawId } = useParams<{ equityId: string }>();
  const equityId = rawId ? parseInt(rawId, 10) : null;
  const navigate = useNavigate();

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

  // AI narrative for the LATEST bar only — one cached call per instrument per
  // day (platform VaNi presence pattern). Scrubbing never fires LLM calls.
  const insightQuery = useInstrumentInsight(equityId ?? 0, 'equity');

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

  // Scan all bars for pump/dump signals (not just current bar)
  const pumpDumpResult = useMemo(() => {
    if (bars.length === 0) return null;
    return scanBarsForManipulation(bars, 30);
  }, [bars]);

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

  // Inactive / stale-data flags
  const isInactive = !meta.is_active;
  const lastTradeDate = bars[bars.length - 1]?.trade_date;
  const todayIso = new Date().toISOString().split('T')[0];
  const daysSinceLastTrade = lastTradeDate
    ? Math.round((new Date(todayIso).getTime() - new Date(lastTradeDate).getTime()) / 86400000)
    : null;
  const isStaleData = daysSinceLastTrade != null && daysSinceLastTrade > 1 && !isInactive;

  const rotation = industryContext ? ROTATION_LABEL[industryContext.category] : null;
  const matchedScans = scanPresence.matchedScans;

  // ── Render ──

  return (
    <div className="h-full overflow-hidden bg-kd-bg flex flex-col">

      {/* Scrollable content — one centered column, capped for wide monitors */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto h-full flex flex-col px-4 pt-4 pb-2">

          {/* Identity row */}
          <div className="flex items-baseline gap-2.5 flex-wrap mb-1 shrink-0">
            <span className={`text-[11px] font-mono font-bold ${exchangeColor(meta.exchange)}`}>
              {meta.exchange}
            </span>
            <span className="text-lg font-serif font-bold text-primary leading-none">
              {meta.symbol}
            </span>
            <span className="text-xs text-secondary truncate max-w-[240px] md:max-w-none">
              {meta.company_name}
            </span>
            <span
              className="text-lg font-mono font-semibold"
              style={{ color: (equityBar?.pct_chng ?? 0) >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}
            >
              ₹{bar.close?.toLocaleString('en-IN')}
            </span>
            {equityBar?.pct_chng != null && (
              <span
                className="text-xs font-mono"
                style={{ color: (equityBar.pct_chng ?? 0) >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}
              >
                {(equityBar.pct_chng ?? 0) >= 0 ? '+' : ''}{(equityBar.pct_chng ?? 0).toFixed(2)}%
              </span>
            )}
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
            <span className="ml-auto">
              <PulseStudySwitch active="pulse" type="equity" id={equityId!} name={meta.symbol} />
            </span>
          </div>
          <PulseStudyHint />

          {/* Pump/Dump warning — a genuine 5-second signal, stays on Pulse */}
          {pumpDumpResult && (
            <div className="mt-1 shrink-0">
              <PumpDumpBanner result={pumpDumpResult} />
            </div>
          )}

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
                onStudyClick={() => navigate(`/chart/equity/${equityId}?name=${encodeURIComponent(meta.symbol)}`)}
              />
            </div>
          )}

          {/* Context line — where this stock sits, in one glance */}
          {(meta.industry || matchedScans.length > 0) && (
            <div className="flex items-center gap-2.5 flex-wrap mt-2 text-[11px] font-mono shrink-0">
              {meta.industry && (
                <Link
                  to={`/industry-transition?expand=${encodeURIComponent(meta.industry)}`}
                  className="text-secondary hover:text-accent-indigo transition-colors"
                >
                  {meta.industry}
                </Link>
              )}
              {rotation && industryContext && (
                <span style={{ color: rotation.color }}>
                  {rotation.label} · {industryContext.percentile}%ile
                  {industryContext.stockRank != null && industryContext.industryStockCount > 0 &&
                    ` · #${industryContext.stockRank} of ${industryContext.industryStockCount} by RS`}
                </span>
              )}
              {matchedScans.length > 0 && (
                <span className="text-muted">
                  · In {matchedScans.length} scan{matchedScans.length !== 1 ? 's' : ''}:{' '}
                  {matchedScans.slice(0, 3).map((s, i) => (
                    <React.Fragment key={s.id}>
                      {i > 0 && ', '}
                      <Link to={`/scanner/${s.id}`} className="text-secondary hover:text-accent-indigo transition-colors">
                        {s.name}{s.vani ? ' ✦' : ''}
                      </Link>
                    </React.Fragment>
                  ))}
                  {matchedScans.length > 3 && ` +${matchedScans.length - 3}`}
                </span>
              )}
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
