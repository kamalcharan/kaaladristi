/**
 * IntradayPage — DristiQ Intraday Cockpit
 * ========================================
 * Cycle 5 — feature-complete:
 *   - Header, top strip, alert strip, panchang band (Cycle 3)
 *   - Confluence dial, conflict engine card, LP placeholder (Cycle 4)
 *   - Panchang/Planets sidebar tables, 4 indicator panels below
 *     chart, guidance footer (Cycle 5)
 *
 * Single setInterval(1Hz) drives all time-aware children via
 * nowMin prop. Reuses VisualPulseChart, AstroStrip, TimelineSlider,
 * CorrelationCard, OrderFlowCard, SmartMoneyCard, DivergenceCard,
 * MagicRsSubchart, VaNiHeader, VaNiSentence verbatim.
 *
 * Spec: docs/dristiq/intraday_page_spec.md
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVisualPulse } from '@/hooks/useVisualPulse';
import { useLastTradingDate } from '@/hooks/useLastTradingDate';
import { useIntraday } from '@/hooks/useIntraday';
import { from } from '@/services/postgrest';
import { useQuery } from '@tanstack/react-query';
import {
  computePulseSnapshot,
  computeCorrHistory,
  computeDots,
  type DotSignals,
  type CorrelationState,
  type TradingStyle,
  type PulseBar,
} from '@/services/visualPulseEngine';
import {
  VisualPulseChart,
  AstroStrip,
  TimelineSlider,
  VaNiHeader,
  VaNiSentence,
} from '@/components/domain/VisualPulse';
import type { SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard';
import {
  currentIstMinutes,
  buildWindow,
  inWindow,
  deriveSessionQuality,
} from '@/services/intradayTime';
import { resolveConflict, type LpDot } from '@/services/conflictEngine';
import { computeConfluence } from '@/services/confluenceScore';
import IntradayHeader from './IntradayHeader';
import MarketClosedBanner from './MarketClosedBanner';
import TopStrip from './TopStrip';
import AlertStrip from './AlertStrip';
import PanchangBand from './PanchangBand';
import ConfluenceDial from './ConfluenceDial';
import ConflictEngineCard from './ConflictEngineCard';
import LPBadge from './LPBadge';
import PanchangSidebar from './PanchangSidebar';
import PlanetsSidebar from './PlanetsSidebar';
import IndicatorPanels from './IndicatorPanels';

function buildSmHistory(bars: PulseBar[], dotsHistory: DotSignals[]): SmartMoneyBar[] {
  return bars.map((b, i) => ({
    sm: b.sniper_inst ?? 0,
    fm: b.sniper_hot ?? 0,
    isSVD: dotsHistory[i]?.isSVD ?? false,
    isSBD: dotsHistory[i]?.isSBD ?? false,
    isSYD: dotsHistory[i]?.isSYD ?? false,
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────

function todayIstIso(): string {
  const ist = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().slice(0, 10);
}

interface IndexMeta { id: number; name: string; }

async function fetchIndexMeta(id: number): Promise<IndexMeta | null> {
  const { data, error } = await from('km_index_symbols')
    .select('id,name')
    .eq('id', id)
    .limit(1)
    .execute();
  if (error || !data || data.length === 0) return null;
  return data[0] as IndexMeta;
}

// ── Sidebar placeholder card ────────────────────────────────────────

function PlaceholderCard({ title, cycle }: { title: string; cycle: string }) {
  return (
    <div style={{
      border: '1px dashed var(--kd-border)',
      borderRadius: 4,
      padding: '10px 12px',
      background: 'var(--kd-panel, color-mix(in srgb, var(--text-primary) 2%, transparent))',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 4,
      }}>{title}</div>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        color: 'var(--text-muted)',
      }}>arrives in {cycle}</div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function IntradayPage() {
  const { indexId } = useParams<{ indexId: string }>();
  const numId = indexId ? parseInt(indexId, 10) : null;

  // Resolve calendar date and trading date
  const today = todayIstIso();
  const { lastTradingDate, isHoliday } = useLastTradingDate(today);

  // Index metadata (name)
  const metaQuery = useQuery({
    queryKey: ['index-meta', numId],
    queryFn: () => fetchIndexMeta(numId!),
    enabled: !!numId,
    staleTime: 60 * 60 * 1000,
  });
  const indexName = metaQuery.data?.name ?? `Index ${numId ?? '?'}`;

  // Bars + DC inferences (reuse existing VP infrastructure)
  const { bars, dcInferences, isLoading, error } = useVisualPulse(numId);

  // ── Slider state (declared early so activeBarDate can use it) ──
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isFading, setIsFading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>('Balanced');

  // Default to latest bar when data loads
  const effectiveIdx = activeIndex ?? (bars.length > 0 ? bars.length - 1 : 0);

  // ── Bar-aware data ──
  // The page is bar-centric: scrubbing the slider re-fetches panchang,
  // plan_score, and astro signal for the active bar's date. The header
  // IST clock stays live; everything else (incl. Rahu/Abhijit pills)
  // reflects "is current time of day inside the ACTIVE BAR's window".
  // When slider is at NOW (most common), activeBarDate === today and
  // everything coincides. Scrubbing back asks "what would my decision
  // look like if I were trading on this past date".
  const activeBarDate = bars[effectiveIdx]?.trade_date ?? lastTradingDate;
  const { panchang, planScore, astroSignal } = useIntraday(activeBarDate);

  // ── Single clock source ──
  const [nowMin, setNowMin] = useState<number>(() => currentIstMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(currentIstMinutes()), 1000);
    return () => clearInterval(t);
  }, []);

  // Window membership against the active bar's windows
  const rahuWin = useMemo(
    () => buildWindow(panchang?.rahu_kala_start ?? null, panchang?.rahu_kala_end ?? null),
    [panchang?.rahu_kala_start, panchang?.rahu_kala_end],
  );
  const abhijitWin = useMemo(
    () => buildWindow(panchang?.abhijit_start ?? null, panchang?.abhijit_end ?? null),
    [panchang?.abhijit_start, panchang?.abhijit_end],
  );
  const inRahu    = inWindow(nowMin, rahuWin);
  const inAbhijit = inWindow(nowMin, abhijitWin);
  const sq = deriveSessionQuality(astroSignal?.net_signal);

  // ── Dev-only LP toggle (Cycle 4 QA — hide once webhook lands) ──
  // Cycles through null → BUY 8 SVD → BUY 8 SYD → SELL -7 → AVOID test
  // for visual coverage of all 7 conflict cases. Lives in dev only.
  const [lpDebug, setLpDebug] = useState<{ score: number | null; dot: LpDot }>(
    { score: null, dot: null },
  );
  const isDev = import.meta.env.DEV;

  // ── Cycle 4 derived state — conflict + confluence ──
  const conflict = useMemo(() => resolveConflict({
    sq,
    inRahu,
    inAbhijit,
    yoga: panchang?.yoga_name ?? null,
    lpScore: lpDebug.score,
    lpDot: lpDebug.dot,
  }), [sq, inRahu, inAbhijit, panchang?.yoga_name, lpDebug.score, lpDebug.dot]);

  const confluence = useMemo(() => computeConfluence({
    lpScore: lpDebug.score,
    sq,
    inRahu,
    inAbhijit,
    planScore: planScore?.plan_score ?? 0,
  }), [lpDebug.score, sq, inRahu, inAbhijit, planScore?.plan_score]);

  // Pre-compute dots + correlation history (style-aware)
  const dotsHistory: DotSignals[] = useMemo(() => {
    return bars.map((b, i) => computeDots(b, i > 0 ? bars[i - 1] : null));
  }, [bars]);

  const corrHistory: CorrelationState[] = useMemo(() => {
    if (bars.length === 0) return [];
    return computeCorrHistory(bars, dcInferences, selectedStyle);
  }, [bars, dcInferences, selectedStyle]);

  const snapshot = useMemo(() => {
    if (bars.length === 0) return null;
    return computePulseSnapshot(bars, effectiveIdx, dcInferences, selectedStyle);
  }, [bars, effectiveIdx, dcInferences, selectedStyle]);

  // ── History slices for indicator panels (last 30/20 bars up to active) ──
  const smHistory: SmartMoneyBar[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 29);
    return buildSmHistory(
      bars.slice(start, effectiveIdx + 1),
      dotsHistory.slice(start, effectiveIdx + 1),
    );
  }, [bars, effectiveIdx, dotsHistory]);

  const rssHistory: number[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return bars.slice(start, effectiveIdx + 1).map(b => b.rss_value ?? 0);
  }, [bars, effectiveIdx]);

  const priceHistory: number[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return bars.slice(start, effectiveIdx + 1).map(b => b.close);
  }, [bars, effectiveIdx]);

  const rsiHistory: number[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return bars.slice(start, effectiveIdx + 1).map(b => b.rsi_14 ?? 50);
  }, [bars, effectiveIdx]);

  // Slider change with fade
  const handleSliderChange = useCallback((idx: number) => {
    setIsFading(true);
    setTimeout(() => {
      setActiveIndex(idx);
      setIsFading(false);
    }, 180);
  }, []);

  useEffect(() => { setActiveIndex(null); }, [numId]);

  // ── Loading / Error / Empty ──
  if (!numId) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>Invalid index ID</div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
      }}>Loading Intraday...</div>
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
  const lastClose = bar?.close ?? null;
  const pctChng = bar && bar.open
    ? ((bar.close - bar.open) / bar.open) * 100
    : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: 'auto auto auto auto auto 1fr 58px auto',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--kd-bg)',
    }}>
      {/* Header */}
      <IntradayHeader
        symbolName={indexName}
        lastClose={lastClose}
        pctChng={pctChng}
        tradeDate={activeBarDate}
        isHoliday={isHoliday}
        nowMin={nowMin}
        inRahu={inRahu}
        inAbhijit={inAbhijit}
      />

      {/* Holiday banner (only when isHoliday) */}
      {isHoliday
        ? <MarketClosedBanner fallbackDate={lastTradingDate} />
        : <div style={{ display: 'none' }} />}

      {/* Top strip */}
      <TopStrip
        panchang={panchang}
        astroSignal={astroSignal}
        nowMin={nowMin}
        inRahu={inRahu}
        inAbhijit={inAbhijit}
      />

      {/* Alert strip */}
      <AlertStrip
        panchang={panchang}
        nowMin={nowMin}
        inRahu={inRahu}
        inAbhijit={inAbhijit}
        verdictLabel={conflict.label}
        verdictColor={conflict.color}
      />

      {/* Panchang band */}
      <PanchangBand
        panchang={panchang}
        nowMin={nowMin}
        sq={sq}
      />

      {/* Body — chart left, sidebar right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        minHeight: 0, overflow: 'hidden',
      }}>
        {/* Left pane — chart + astro strip + indicator panels */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          borderRight: '1px solid var(--kd-border)',
        }}>
          {/* Chart area — fixed minimum height so panels can co-exist */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            padding: '12px 16px',
            minHeight: 420,
            flexShrink: 0,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
              color: 'var(--text-faint)', letterSpacing: '0.1em',
              marginBottom: 6,
            }}>
              {indexName} · {bars.length} BARS · Bar {effectiveIdx + 1} {isNow ? '(NOW)' : ''}
            </div>

            <div style={{ flex: 1, minHeight: 320 }}>
              <VisualPulseChart
                bars={bars}
                activeIndex={effectiveIdx}
                corrHistory={corrHistory}
                dotsHistory={dotsHistory}
              />
            </div>

            <AstroStrip dcInferences={dcInferences} activeDate={bar.trade_date} />

            {/* INTRADAY: when km_index_15m is populated, swap VisualPulseChart
                for an intraday 5-min chart and TimelineSlider semantics shift
                from "scrub days" to "scrub today's bars". */}
          </div>

          {/* 4 collapsible indicator panels */}
          <IndicatorPanels
            snapshot={snapshot}
            bars={bars}
            effectiveIdx={effectiveIdx}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            smHistory={smHistory}
            rssHistory={rssHistory}
            priceHistory={priceHistory}
            rsiHistory={rsiHistory}
            symbolName={indexName}
          />
        </div>

        {/* Right sidebar — VaNi + placeholders */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--kd-border)' }}>
            <VaNiHeader
              date={bar.trade_date}
              barPosition={isNow ? 'NOW' : `Bar ${effectiveIdx + 1} / ${bars.length}`}
              isThinking={isFading}
            />
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
            opacity: isFading ? 0.3 : 1,
            transition: 'opacity 0.15s ease',
          }}>
            {snapshot && (
              <VaNiSentence
                narrative={null}
                corrState={snapshot.corrState}
                date={bar.trade_date}
                isFading={isFading}
              />
            )}

            <ConfluenceDial breakdown={confluence} />
            <ConflictEngineCard result={conflict} />
            <PanchangSidebar panchang={panchang} />
            <PlanetsSidebar date={activeBarDate} />
            <LPBadge lpScore={lpDebug.score} lpDot={lpDebug.dot} />

            {/* Dev-only LP signal toggle — for QA of all 7 conflict cases */}
            {isDev && (
              <div style={{
                border: '1px dashed var(--accent-violet)',
                borderRadius: 4, padding: 8, marginTop: 4,
                background: 'color-mix(in srgb, var(--accent-violet) 6%, transparent)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                  color: 'var(--accent-violet)', letterSpacing: '0.1em',
                  marginBottom: 6,
                }}>DEV · MOCK LP SIGNAL</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[
                    { label: 'Off',          score: null, dot: null },
                    { label: 'BUY 8',        score: 8,    dot: null },
                    { label: 'BUY 8 + SVD',  score: 8,    dot: 'SVD' as LpDot },
                    { label: 'BUY 8 + SBD',  score: 8,    dot: 'SBD' as LpDot },
                    { label: 'BUY 8 + SYD',  score: 8,    dot: 'SYD' as LpDot },
                    { label: 'SELL -8',      score: -8,   dot: null },
                    { label: 'NO TRADE 0',   score: 0,    dot: null },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setLpDebug({ score: opt.score, dot: opt.dot })}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                        padding: '3px 6px', borderRadius: 2, cursor: 'pointer',
                        background: lpDebug.score === opt.score && lpDebug.dot === opt.dot
                          ? 'var(--accent-violet)'
                          : 'transparent',
                        color: lpDebug.score === opt.score && lpDebug.dot === opt.dot
                          ? 'var(--kd-bg)'
                          : 'var(--text-muted)',
                        border: '1px solid var(--accent-violet)',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Dev-only sanity strip — verifies Cycle 1 wiring. Hidden in prod. */}
            {isDev && planScore && (
              <div style={{
                marginTop: 4, padding: '6px 8px',
                background: 'var(--kd-panel, color-mix(in srgb, var(--text-primary) 2%, transparent))',
                border: '1px solid var(--kd-border)', borderRadius: 4,
                fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                plan_score={planScore.plan_score.toFixed(2)} ·
                {' '}rules={planScore.contributing_rules} ·
                {' '}calibrated={planScore.is_calibrated ? 'yes' : 'no'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom — TimelineSlider */}
      <TimelineSlider
        total={bars.length}
        activeIndex={effectiveIdx}
        bars={bars}
        corrHistory={corrHistory}
        onChange={handleSliderChange}
      />
      {/* INTRADAY: TimelineSlider semantics change to scrub today's 5-min bars */}

      {/* Guidance footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', flexWrap: 'wrap', gap: 8,
        borderTop: '1px solid var(--kd-border)',
        background: 'var(--kd-panel, rgba(0,0,0,0.2))',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.04em',
      }}>
        <span>
          {conflict.color === 'green' && '▲ ENTER — '}
          {conflict.color === 'red'   && '✕ SKIP — '}
          {conflict.color === 'amber' && '⚠ CAUTION — '}
          {conflict.color === 'teal'  && '◈ WATCH — '}
          <span style={{ color: 'var(--text-muted)' }}>{conflict.action}</span>
        </span>
        <span style={{ color: 'var(--text-faint)' }}>
          EOD Data · Ujjain · Lahiri · Sidereal
        </span>
        <span>
          km_daily_panchang · km_planetary_positions · km_index_eod
        </span>
        {/* INTRADAY: center label changes to "15-Min Data · Live" when wired */}
      </div>
    </div>
  );
}
