import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndicatorDataById, fetchEquityEodById, fetchEquityTimeframeById, resampleRows, type EquityTimeframe } from '@/services/indicatorData';
import TradingChart from '@/components/charts/TradingChart';
import VaNiInsight from '@/components/domain/VaNiInsight';
import { useInstrumentInsight } from '@/hooks';
import StatStrip from '@/components/domain/StockCockpit/StatStrip';
import VerdictHero from '@/components/domain/StockCockpit/VerdictHero';
import StoryMode from '@/components/domain/StockCockpit/StoryMode';
import { buildStoryEvents, KIND_COLORS, type StoryEvent } from '@/services/storyEvents';
import DeliveryVsTraded from '@/components/domain/StockCockpit/DeliveryVsTraded';
import SectorMembershipCard from '@/components/domain/StockCockpit/SectorMembershipCard';
import CockpitIndicatorPanels from '@/components/domain/StockCockpit/CockpitIndicatorPanels';
import BigMoneyCard from '@/components/domain/StockCockpit/BigMoneyCard';
import CockpitOverlayStrip from '@/components/domain/StockCockpit/CockpitOverlayStrip';
import { detectBigMoneyDays } from '@/services/bigMoney';
import { useFrameworkStore } from '@/stores/frameworkStore';
import { useAuthStore } from '@/stores/authStore';
import CatalogDrawer from '@/components/domain/Catalog/CatalogDrawer';
import { useAstroOverlayBands } from '@/hooks/useAstroOverlayBands';
import type { ChartOverlay } from '@/types/framework';

const NO_OVERLAYS: ChartOverlay[] = [];
import { Skeleton, ErrorBoundary } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/types';

// Visual Pulse imports (shared — index + equity)
import { useVisualPulse } from '@/hooks/useVisualPulse';
import { useEquityVisualPulse } from '@/hooks/useEquityVisualPulse';
import { useScanPresence } from '@/hooks/useScanPresence';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';
import {
  computePulseSnapshot,
  computeCorrHistory,
  computeDots,
  type TradingStyle,
  type PulseSnapshot,
  type PulseBar,
  type CorrelationState,
  type DotSignals,
} from '@/services/visualPulseEngine';

// Equity-specific pulse components
import PumpDumpBanner, { scanBarsForManipulation } from '@/components/domain/VisualPulse/equity/PumpDumpBanner';
import ScanPresenceCard from '@/components/domain/VisualPulse/equity/ScanPresenceCard';
import BookmarkToggle from '@/components/domain/BookmarkToggle';
import IndustryContextCard from '@/components/domain/VisualPulse/equity/IndustryContextCard';
import MultiTimeframePills from '@/components/domain/VisualPulse/equity/MultiTimeframePills';
import StockFlowHeatmap from '@/components/domain/StockFlowHeatmap';
// Pulse verdict/evidence cards + timeline player pulled into Study (the full
// workbench). Study now carries the same signal widgets as Pulse, driven by a
// scrubber, so it can stand alone when Pulse mode is retired.
// Correlation is intentionally not rendered on equity Study (owner 2026-07-09);
// it returns for indexes later.
import { OrderFlowCard, SmartMoneyCard, DivergenceCard } from '@/components/domain/VisualPulse';
import type { SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard';
import TimelineSlider from '@/components/domain/VisualPulse/TimelineSlider';
import MagicRsSubchart from '@/components/domain/VisualPulse/MagicRsSubchart';
import RotationGraph, { type RotationPoint } from '@/components/domain/RotationGraph';
import SignalFlipCard from '@/components/domain/StockCockpit/SignalFlipCard';
import SignalLineChart from '@/components/domain/StockCockpit/SignalLineChart';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

/** Compute Magic RS change over N bars */
function rsChangeLookback(bars: PulseBar[], idx: number, lookback: number): number | null {
  if (idx < lookback) return null;
  const current = bars[idx]?.magic_rs;
  const prior = bars[idx - lookback]?.magic_rs;
  if (current == null || prior == null) return null;
  return current - prior;
}

// ── Pulse card helpers (mirrored from EquityVisualPulsePage so Study reads
//    identically; kept local so Study stands alone once Pulse is retired) ──
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

/**
 * Generic chart page with Visual Pulse intelligence panel.
 * Routes:
 *   /chart/index/:id?name=NIFTY%2050
 *   /chart/equity/:id?name=RELIANCE
 */
export default function ChartView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>('1Y');
  const [tf, setTf] = useState<EquityTimeframe>('daily');
  const [isFull, setIsFull] = useState(false);
  const [selectedStyle] = useState<TradingStyle>('Balanced');
  // Timeline scrubber (the Player, pulled in from Pulse). null = pin to latest bar.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Study Layer contract (POA Phase 1.5): the cockpit chart honors the SAME
  // framework overlays as the My Space chart — what you turn on in Catalog
  // follows you everywhere. The framework store is normally hydrated by the
  // Workspace page; a user landing directly on the cockpit would otherwise
  // see zero overlays, so load it here too.
  const { framework, loadFramework } = useFrameworkStore();
  const { profile } = useAuthStore();
  useEffect(() => {
    if (!framework && profile?.id) loadFramework(profile.id);
  }, [framework, profile?.id, loadFramework]);
  const frameworkOverlays = framework?.chart_overlays ?? NO_OVERLAYS;
  const astroBands = useAstroOverlayBands(frameworkOverlays);
  const [overlayDrawerOpen, setOverlayDrawerOpen] = useState(false);
  // Study reorg (2026-07-12): decision-band prose collapsed by default;
  // Member-Of pills demoted to a closed accordion.
  const [readExpanded, setReadExpanded] = useState(false);
  // Stock DeepDive tabs (Slice 3): Analysis | Chart & Replay.
  const [dvTab, setDvTab] = useState<'analysis' | 'chart'>('analysis');
  const [membershipOpen, setMembershipOpen] = useState(false);

  const numId = Number(id);
  const rawName = searchParams.get('name') ?? `${type} #${id}`;
  const isIndex = type === 'index';
  const isEquity = type === 'equity';

  // ── Chart data (full history for TradingChart) ──
  // dateKey: the main chart page is commonly left open through a session —
  // same fix as hooks/useScan.ts, so a day change refetches automatically.
  const { latestDataDate: chartDateKey } = usePipelineStatus();
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range, tf, chartDateKey ?? 'unknown'],
    queryFn: () =>
      isEquity
        ? (tf === 'daily' ? fetchEquityEodById(numId, range) : fetchEquityTimeframeById(numId, tf))
        // Index W/M: no aggregate tables exist — resample full daily history
        // client-side (indices carry no delivery data, so nothing is lost)
        : (tf === 'daily'
            ? fetchIndicatorDataById(numId, range)
            : fetchIndicatorDataById(numId, 'MAX').then((r) => resampleRows(r, tf))),
    staleTime: 120_000,
    enabled: !!numId && (isIndex || isEquity),
  });

  // ── Visual Pulse data — index uses useVisualPulse, equity uses useEquityVisualPulse ──
  const indexPulse = useVisualPulse(isIndex ? numId : null);
  const equityPulse = useEquityVisualPulse(isEquity ? numId : null);
  const scanPresence = useScanPresence(isEquity ? numId : null);

  // VaNi narrative for the Decision Band (slim read, not the full panel).
  const { data: aiData, isLoading: aiLoading } = useInstrumentInsight(numId, type ?? 'index');

  // Unify pulse bars + dc inferences for shared signal computation
  const pulseBars: PulseBar[] = isIndex ? indexPulse.bars : (equityPulse.bars as PulseBar[]);
  const dcInferences = isIndex ? indexPulse.dcInferences : equityPulse.dcInferences;

  // Resolve display name — for BSE numeric symbols, prefer company_name from metadata
  const name = useMemo(() => {
    if (isEquity && equityPulse.meta) {
      const sym = equityPulse.meta.symbol;
      const co = equityPulse.meta.company_name;
      // If the URL name is numeric (BSE code) or matches the raw symbol, show company name
      if (/^\d+$/.test(rawName) && co) return co;
      // If symbol is numeric, show company_name + symbol
      if (/^\d+$/.test(sym) && co) return co;
    }
    return rawName;
  }, [isEquity, equityPulse.meta, rawName]);

  // Stats from latest row
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const currentClose = latest?.close ?? 0;
  const prevClose = prev?.close ?? currentClose;
  const change = currentClose - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const isPositive = change >= 0;

  const last252 = rows.slice(-252);
  const high52w = last252.length > 0 ? Math.max(...last252.map(r => r.high)) : 0;
  const low52w = last252.length > 0 ? Math.min(...last252.map(r => r.low)) : 0;

  const errorMsg = error instanceof Error ? error.message : '';

  // ── Pulse computations (Study workbench) — the scrubber drives snapshot +
  //     every card. activeIndex === null pins to the latest bar. ──
  const effectiveIdx = activeIndex ?? (pulseBars.length > 0 ? pulseBars.length - 1 : 0);

  const dotsHistory: DotSignals[] = useMemo(
    () => pulseBars.map((b, i) => computeDots(b, i > 0 ? pulseBars[i - 1] : null)),
    [pulseBars],
  );

  const corrHistory: CorrelationState[] = useMemo(() => {
    if (pulseBars.length === 0) return [];
    return computeCorrHistory(pulseBars, dcInferences, selectedStyle);
  }, [pulseBars, dcInferences, selectedStyle]);

  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (pulseBars.length === 0) return null;
    return computePulseSnapshot(pulseBars, effectiveIdx, dcInferences, selectedStyle);
  }, [pulseBars, effectiveIdx, dcInferences, selectedStyle]);

  // Card history slices (last N up to the scrubbed bar) — same windows as Pulse
  const smHistory: SmartMoneyBar[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 29);
    return buildSmHistory(pulseBars.slice(start, effectiveIdx + 1), dotsHistory.slice(start, effectiveIdx + 1));
  }, [pulseBars, effectiveIdx, dotsHistory]);

  const rssHistory: number[] = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return buildRssHistory(pulseBars.slice(start, effectiveIdx + 1));
  }, [pulseBars, effectiveIdx]);

  const priceHistory = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return pulseBars.slice(start, effectiveIdx + 1).map((b) => b.close);
  }, [pulseBars, effectiveIdx]);

  const rsiHistory = useMemo(() => {
    const start = Math.max(0, effectiveIdx - 19);
    return pulseBars.slice(start, effectiveIdx + 1).map((b) => b.rsi_14 ?? 50);
  }, [pulseBars, effectiveIdx]);

  const flowNarrative = snapshot ? buildFlowNarrative(snapshot) : '';
  const smNarrative = snapshot ? buildSmNarrative(snapshot) : '';

  // Magic RS widget data (same shape EquityVisualPulsePage builds)
  const magicRsData = useMemo(
    () => pulseBars.map((b) => ({ trade_date: b.trade_date, magic_rs: b.magic_rs, magic_ma: b.magic_ma, magic_rs_zone: b.magic_rs_zone })),
    [pulseBars],
  );
  // Magic RS is a pipeline column vs CNX500 — null for many BSE/thin stocks.
  const hasRsData = useMemo(() => pulseBars.some((b) => b.magic_rs != null), [pulseBars]);

  // ── Equity-specific computations ──
  const rsChange1d = useMemo(() => rsChangeLookback(pulseBars, effectiveIdx, 1), [pulseBars, effectiveIdx]);
  const rsChange5d = useMemo(() => rsChangeLookback(pulseBars, effectiveIdx, 5), [pulseBars, effectiveIdx]);
  const rsChange20d = useMemo(() => rsChangeLookback(pulseBars, effectiveIdx, 20), [pulseBars, effectiveIdx]);

  // RS-Rotation (daily): level = Magic RS, momentum = its 5-bar change.
  const rotationPoints = useMemo<RotationPoint[]>(
    () => pulseBars.map((b, i) => ({
      date: b.trade_date,
      level: b.magic_rs ?? null,
      momentum: rsChangeLookback(pulseBars, i, 5),
    })),
    [pulseBars],
  );

  // Scan all bars for pump/dump signals (not just current bar)
  const pumpDumpResult = useMemo(() => {
    if (!isEquity || pulseBars.length === 0) return null;
    return scanBarsForManipulation(pulseBars, 30);
  }, [isEquity, pulseBars]);


  // Big Money days (Phase 3) — daily equity bars only
  const bigMoneyEvents = useMemo(
    () => (isEquity && tf === 'daily' ? detectBigMoneyDays(rows) : []),
    [isEquity, tf, rows],
  );
  const bigMoneyChartLines = useMemo(
    () => bigMoneyEvents.map((ev) => ({
      trade_date: ev.trade_date,
      price: ev.low,
      label: `₹${ev.delivCr >= 100 ? ev.delivCr.toFixed(0) : ev.delivCr.toFixed(1)} Cr`,
      color: ev.direction === 'entry' ? '#22c55e' : ev.direction === 'exit' ? '#ef4444' : '#d4a84b',
    })),
    [bigMoneyEvents],
  );

  // ── Story mode (Chart & Replay) — timed price-vs-signal events ──
  const [storyOpen, setStoryOpen] = useState(false);
  const bigMoneyDates = useMemo(() => new Set(bigMoneyEvents.map((e) => e.trade_date)), [bigMoneyEvents]);
  const storyEvents = useMemo(
    () => (isEquity && tf === 'daily' ? buildStoryEvents(rows, bigMoneyDates) : []),
    [isEquity, tf, rows, bigMoneyDates],
  );
  // Events are indexed against `rows` (the chart's data) but the playhead
  // indexes `pulseBars` — different arrays. Bridge them by DATE, not index.
  const eventDates = useMemo(() => new Set(storyEvents.map((e) => e.date)), [storyEvents]);
  const playheadDate = pulseBars[effectiveIdx]?.trade_date ?? null;
  const storyBubble = useMemo(() => {
    if (dvTab !== 'chart' || !playheadDate) return null;
    let best: StoryEvent | null = null;
    for (const e of storyEvents) {
      if (e.date === playheadDate && (!best || e.priority > best.priority)) best = e;
    }
    return best ? { date: best.date, tone: best.tone, color: KIND_COLORS[best.kind], title: best.title, detail: best.detail, reactionPct: best.reactionPct } : null;
  }, [storyEvents, playheadDate, dvTab]);

  // Replay playback — walk the playhead forward, dwelling on event bars so the
  // on-candle bubble is readable, then gliding to the next.
  const [playing, setPlaying] = useState(false);
  const playIdxRef = useRef(effectiveIdx);
  useEffect(() => { playIdxRef.current = effectiveIdx; }, [effectiveIdx]);
  useEffect(() => {
    if (!playing || pulseBars.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (cancelled) return;
      const cur = playIdxRef.current;
      if (cur >= pulseBars.length - 1) { setPlaying(false); return; }
      const next = cur + 1;
      playIdxRef.current = next;
      setActiveIndex(next);
      const isEvent = eventDates.has(pulseBars[next]?.trade_date ?? '');
      timer = setTimeout(loop, isEvent ? 2200 : 380);
    };
    timer = setTimeout(loop, 380);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playing, pulseBars, eventDates, setActiveIndex]);

  // Chart block, extracted so the decision-first layout can place it in its own
  // tier (equity: beside Magic RS / RSI / Divergence; index: full width).
  const chartArea = (
    <>
      <div
        className={cn('glass-card rounded-2xl p-3', isFull && 'fixed inset-2 z-[300] overflow-auto')}
        style={isFull ? { background: 'var(--kd-bg, #0b0f17)' } : undefined}
      >
        {!isLoading && !isError && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-3 px-1">
            <div className="flex items-center gap-0.5 mr-2 p-0.5 rounded-lg border border-kd-border bg-kd-elevated">
              {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTf(t)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                    tf === t ? 'bg-accent-indigo/25 text-accent-indigo' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                  )}
                >
                  {t === 'daily' ? 'D' : t === 'weekly' ? 'W' : 'M'}
                </button>
              ))}
            </div>
            {tf === 'daily' ? (
              TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200',
                    range === r
                      ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-kd-elevated',
                  )}
                >
                  {r}
                </button>
              ))
            ) : (
              <span className="text-[9px] text-muted font-mono px-1">full history · {tf} bars</span>
            )}
            <button
              onClick={() => setIsFull((f) => !f)}
              title={isFull ? 'Exit fullscreen' : 'Fullscreen chart'}
              className="ml-auto px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-kd-elevated border border-kd-border transition-all"
            >
              {isFull ? '✕' : '⛶'}
            </button>
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <CockpitOverlayStrip onAdd={() => setOverlayDrawerOpen(true)} />
        )}

        {isLoading ? (
          <div className="space-y-4 p-2">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
            <Skeleton className="h-[100px] w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-risk-red" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Failed to Load</p>
            <p className="text-xs text-secondary max-w-md mb-3">{errorMsg || 'Unexpected error.'}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-xs font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-8 h-8 text-[var(--text-muted)] mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No Price Data</p>
            <p className="text-xs text-secondary">
              <span className="text-[var(--text-primary)] font-medium">{name}</span> has no EOD data.
            </p>
          </div>
        ) : (
          <TradingChart
            data={rows}
            workspaceMode
            height={isFull ? Math.max(700, window.innerHeight - 120) : 480}
            highlightDate={activeIndex != null && pulseBars[effectiveIdx] ? pulseBars[effectiveIdx].trade_date : null}
            overlays={frameworkOverlays}
            astroBands={astroBands}
            bigMoneyEvents={bigMoneyChartLines}
            benchmarkIndexId={isIndex && id ? Number(id) : null}
            benchmarkName={isIndex ? name : null}
            storyBubble={storyBubble}
          />
        )}
      </div>
      {rows.length > 0 && (
        <p className="text-[9px] text-muted mt-1 text-right mono">
          {rows.length} days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
        </p>
      )}
    </>
  );

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        {/* ═══ Hero — exact-replica 2-column top (Stock DeepDive): identity ·
            price · stat pills · VaNi read (left) and the verdict card (right,
            equity). Replaces the old sticky command bar. ═══ */}
        <div className="mb-4">
          {/* Back · type badge · bookmark */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-xs text-muted hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border',
              isIndex
                ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/8'
                : 'text-accent-violet border-accent-violet/30 bg-accent-violet/8',
            )}>
              {isIndex ? 'INDEX' : 'EQUITY'}
            </span>
            {isEquity && <BookmarkToggle equityId={numId} size={16} />}
          </div>

          <div className={cn('grid gap-4 items-start', isEquity ? 'grid-cols-1 lg:grid-cols-[1.35fr_1fr]' : 'grid-cols-1')}>
            {/* LEFT — identity · price · stats · read */}
            <div className="min-w-0 flex flex-col gap-3">
              <div>
                <h1 className="inline text-2xl font-bold tracking-tight text-[var(--text-primary)]">{name}</h1>
                {isEquity && equityPulse.meta?.industry && (
                  <span className="ml-2 text-xs text-muted">NSE · {equityPulse.meta.industry}</span>
                )}
              </div>

              {!isLoading && latest && (() => {
                const r5 = (latest as { ret_5d?: number | null }).ret_5d ?? null;
                const chg = r5 ?? changePct;
                const pos = chg >= 0;
                return (
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl font-bold mono text-[var(--text-primary)]">
                      {currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={cn('flex items-center gap-1 text-sm font-bold mono', pos ? 'text-risk-green' : 'text-risk-red')}>
                      {pos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {pos ? '+' : ''}{chg.toFixed(2)}%
                      <span className="text-muted font-normal ml-1">/ {r5 != null ? '5D' : '1D'}</span>
                    </span>
                  </div>
                );
              })()}

              {!isLoading && latest && (
                <div className="flex flex-wrap gap-2 text-xs items-center">
                  <StatPill label="H/L" value={`${fmt(latest.high)} / ${fmt(latest.low)}`} />
                  <StatPill label="52W" value={`${fmt(low52w)} – ${fmt(high52w)}`} />
                  {latest.rsi_14 != null && <StatPill label="RSI" value={latest.rsi_14.toFixed(1)} />}
                  {latest.magic_rs_zone && <StatPill label="RS" value={latest.magic_rs_zone} />}
                  {isEquity && equityPulse.meta && !equityPulse.meta.is_active && (
                    <span className="text-[10px] font-mono text-risk-amber bg-risk-amber/10 px-1.5 py-0.5 rounded">
                      Inactive — last traded {latest.trade_date}
                    </span>
                  )}
                  {isEquity && (() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const daysSince = Math.round((new Date(todayStr).getTime() - new Date(latest.trade_date).getTime()) / 86400000);
                    return daysSince > 1 && equityPulse.meta?.is_active ? (
                      <span className="text-[10px] font-mono text-muted">Last updated: {latest.trade_date} ({daysSince}d ago)</span>
                    ) : null;
                  })()}
                </div>
              )}

              {/* VaNi Read — now in the hero's left column */}
              {!isLoading && !isError && rows.length > 0 && (aiLoading || aiData?.insight) && (
                <div id="study-read" style={{ scrollMarginTop: 118 }}>
                  {!isEquity && snapshot?.corrState.tagline && (
                    <div className="text-[11px] mb-1.5" style={{ color: snapshot.corrState.color }}>
                      ● <span className="font-semibold">{snapshot.corrState.state}</span>
                      <span className="text-muted"> — {snapshot.corrState.tagline}</span>
                    </div>
                  )}
                  <div className="relative overflow-hidden" style={!readExpanded ? { maxHeight: 130 } : undefined}>
                    <VaNiInsight insight={aiData?.insight} isLoading={aiLoading} highlightChips className="mt-0" />
                    {!readExpanded && !aiLoading && (
                      <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(transparent, var(--bg))' }} />
                    )}
                  </div>
                  {!aiLoading && aiData?.insight && (
                    <button
                      onClick={() => setReadExpanded((e) => !e)}
                      className="mt-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {readExpanded ? '▴ Collapse' : '▾ Read full VaNi analysis'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — verdict card (equity only) */}
            {isEquity && !isLoading && latest && (
              <div className="min-w-0">
                <VerdictHero latest={latest} snapshot={snapshot} />
              </div>
            )}
          </div>

        </div>

        {/* ═══ Tabs — Analysis · Chart & Replay · Data · Results (Stock DeepDive
            Slice 3). Data/Results are placeholders. ═══ */}
        {isEquity && !isLoading && rows.length > 0 && (
          <div className="flex items-center gap-1 mb-3 border-b border-kd-border">
            {([['analysis', 'Analysis'], ['chart', 'Chart & Replay']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setDvTab(id)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  dvTab === id
                    ? 'border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-muted hover:text-[var(--text-primary)]',
                )}
              >
                {label}
              </button>
            ))}
            <span className="px-3 py-2 text-sm text-[var(--text-faint)] cursor-default">Data · soon</span>
            <span className="px-3 py-2 text-sm text-[var(--text-faint)] cursor-default">Results · soon</span>
          </div>
        )}

        {/* ═══ Snapshot — index only. For equities the Conviction · Momentum ·
            Liquidity · Returns detail (StatStrip) moves into the Strength chapter
            below; the VerdictHero gives the 4-pillar glance up top. ═══ */}
        {!isLoading && latest && !isEquity && (
          <StatStrip
            latest={latest}
            mcapCr={equityPulse.meta?.mcap_cr ?? scanPresence.stock?.mcap_cr ?? null}
            isEquity={isEquity}
          />
        )}

        {/* ═══ Equity: Pump/Dump Banner + Magic RS Pills (Analysis tab) ═══ */}
        {isEquity && dvTab === 'analysis' && pumpDumpResult && (
          <div className="mb-2">
            <PumpDumpBanner result={pumpDumpResult} />
          </div>
        )}
        {/* ═══ Chapter: Relative Strength — pills + rotation quadrant + industry
            context together: everything answering "how strong vs market/peers?"
            (RS-Rotation moved DOWN from its provisional prime spot.) ═══ */}
        {isEquity && dvTab === 'analysis' && !isLoading && latest && (
          <section id="study-strength" style={{ scrollMarginTop: 118 }} className="mb-3">
            <SectionLabel>Strength</SectionLabel>
            {hasRsData && (
              <div className="mb-2">
                <MultiTimeframePills
                  rsChange1d={rsChange1d}
                  rsChange5d={rsChange5d}
                  rsChange20d={rsChange20d}
                  currentRs={pulseBars[effectiveIdx]?.magic_rs ?? null}
                  benchmarkLabel="NIFTY 500"
                />
              </div>
            )}
            {/* 2fr/1fr + a STACKED right column (industry + scan presence +
                membership) so the tall quadrant doesn't leave a blank column
                (owner QA 2026-07-12). */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
              <div className="min-w-0">
                {tf === 'daily' && hasRsData ? (
                  <RotationGraph points={rotationPoints} benchmark="NIFTY 500" autoPlay playSeconds={7} />
                ) : (
                  <div className="glass-card rounded-xl p-3 text-[10px] text-muted">
                    RS-Rotation is available on the daily timeframe{hasRsData ? '' : ' (RS not computed for this stock)'}.
                  </div>
                )}
              </div>
              <div className="min-w-0 flex flex-col gap-3">
                <IndustryContextCard
                  industry={equityPulse.meta?.industry ?? null}
                  context={equityPulse.industryContext}
                />
                <ScanPresenceCard stock={scanPresence.stock} matchedScans={scanPresence.matchedScans} />
                <div className="glass-card rounded-xl">
                  <button
                    onClick={() => setMembershipOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                      Index membership
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)]">{membershipOpen ? '▴' : '▾'}</span>
                  </button>
                  {membershipOpen && (
                    <div className="px-1 pb-1">
                      <SectorMembershipCard equityId={numId} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Momentum & Returns evidence — the detailed snapshot (StatStrip,
                reused) now lives with the Strength chapter (Stock DeepDive
                Slice 2); no new component. */}
            <div className="mt-3">
              <StatStrip
                latest={latest}
                mcapCr={equityPulse.meta?.mcap_cr ?? scanPresence.stock?.mcap_cr ?? null}
                isEquity={isEquity}
              />
            </div>
          </section>
        )}

        {/* ═══ Evidence tiers (equity) · chart-centric (index) ═══ */}
        {isEquity ? (
          <>
            {/* ═══ Chapter: Money Flow — one question ("is real money entering?"),
                one frame: heatmap leads full-width, state cards beneath. ═══ */}
            {dvTab === 'analysis' && !isLoading && !isError && rows.length > 0 && (
              <section id="study-flow" style={{ scrollMarginTop: 118 }} className="mb-3">
                <SectionLabel>Money Flow</SectionLabel>
                {tf === 'daily' ? (
                  <StockFlowHeatmap label={name} rows={rows} />
                ) : (
                  <div className="glass-card rounded-xl p-3 text-[10px] text-muted">
                    Flow heatmap is available on the daily timeframe.
                  </div>
                )}
              </section>
            )}

            {/* Rows B/C — Order Flow · Smart Money · Big Money(spans) / Delivery(wide) */}
            {dvTab === 'analysis' && snapshot && (
              <div className="grid grid-cols-1 lg:grid-cols-[37fr_38fr_25fr] gap-3 mb-3">
                <OrderFlowCard
                  bar={snapshot.bar}
                  rss={snapshot.rss}
                  rssHistory={rssHistory}
                  narrative={flowNarrative}
                />
                <SignalFlipCard
                  title="Smart Money"
                  widget={
                    <SmartMoneyCard
                      smHistory={smHistory}
                      sm={snapshot.sm}
                      dots={[snapshot.dots]}
                      narrative={smNarrative}
                    />
                  }
                  chart={
                    <SignalLineChart
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      data={pulseBars as any}
                      series={[
                        { key: 'sniper_inst', color: 'var(--accent-indigo, #6366f1)', label: 'Institution' },
                        { key: 'sniper_hot', color: 'var(--caution, #f59e0b)', label: 'Hot Money' },
                      ]}
                      refLines={[{ y: 35 }]}
                      domain={[0, 50]}
                    />
                  }
                />
                <div className="lg:row-span-2">
                  <BigMoneyCard events={bigMoneyEvents} />
                </div>
                <div className="lg:col-span-2">
                  <DeliveryVsTraded rows={rows} />
                </div>
              </div>
            )}

            {/* ═══ RESERVED CHAPTERS (Study reorg 2026-07-12) — render nothing
                until their data pipelines land; they have addresses so the next
                data drop slots in without another page re-org:
                · #study-fundamentals — revenue/EBITDA sparklines, D/E, promoter
                  Δ + pledge, dividends (quarterly results / yfinance ingest —
                  the Waking Giants Layer-0 fields reused per-stock)
                · #study-events — filings timeline (results, SHP, corporate
                  actions, concalls) + FPB setup/burst + WG phase markers with
                  astro-window shading ═══ */}

            {/* (Scan Presence + Index membership moved INTO the Strength
                chapter's right-column stack — owner QA 2026-07-12.) */}

            {/* Chart & Replay tab — chart tier + the replay scrubber together. */}
            {dvTab === 'chart' && (<>
            {/* Story replay controls — play walks the candles; the current
                signal event pops as an on-candle bubble. */}
            {storyEvents.length > 0 && (
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => {
                    if (!playing) {
                      // Start the story at the first signal event in the window.
                      const pbIdx = new Map(pulseBars.map((b, i) => [b.trade_date, i]));
                      const firstEv = storyEvents.find((e) => pbIdx.has(e.date));
                      const startIdx = firstEv ? (pbIdx.get(firstEv.date) as number) : 0;
                      setActiveIndex(startIdx);
                      playIdxRef.current = startIdx;
                    }
                    setPlaying((p) => !p);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors"
                >
                  {playing ? '❚❚ Pause' : '▷ Play story'}
                </button>
                <button
                  onClick={() => setStoryOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-kd-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
                >
                  ⤢ Story mode
                </button>
                <span className="text-[11px] text-muted font-mono">
                  {storyEvents.length} signal events · price × data story
                </span>
              </div>
            )}
            <div id="study-chart" style={{ scrollMarginTop: 118 }} className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 mb-3">
              <div className="min-w-0">{chartArea}</div>
              <div className="flex flex-col gap-3 min-w-0">
                {snapshot && (hasRsData ? (
                  <SignalFlipCard
                    title="Magic RS"
                    minHeight={180}
                    widget={<MagicRsSubchart data={magicRsData} activeIndex={effectiveIdx} benchmarkLabel="NIFTY 500" />}
                    chart={
                      <SignalLineChart
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data={pulseBars as any}
                        series={[
                          { key: 'magic_rs', color: 'var(--gold, #d4a84b)', label: 'Magic RS' },
                          { key: 'magic_ma', color: 'var(--text-faint, #64748b)', label: 'MA', dashed: true },
                        ]}
                        refLines={[{ y: 0 }]}
                      />
                    }
                  />
                ) : (
                  <div className="rounded-lg bg-kd-card border border-kd-border p-3">
                    <div className="text-[11px] font-serif font-semibold text-primary mb-1">Magic RS</div>
                    <div className="text-[10px] text-muted leading-snug">Not computed for this stock (RS vs NIFTY 500 needs a benchmark series — absent for many BSE/thin names).</div>
                  </div>
                ))}
                {!isLoading && !isError && rows.length > 0 && tf === 'daily' && (
                  <CockpitIndicatorPanels rows={rows} />
                )}
                {snapshot && (
                  <DivergenceCard
                    divergence={snapshot.divergence}
                    rsiHistory={rsiHistory}
                    priceHistory={priceHistory}
                  />
                )}
              </div>
            </div>

            {/* Player — timeline scrubber (Smart Money / Magic RS follow it) */}
            {pulseBars.length > 0 && (
              <div className="mt-1">
                <TimelineSlider
                  total={pulseBars.length}
                  activeIndex={effectiveIdx}
                  bars={pulseBars}
                  corrHistory={corrHistory}
                  onChange={setActiveIndex}
                />
              </div>
            )}
            </>)}
          </>
        ) : (
          /* Index — chart-centric (equity evidence cards don't apply) */
          <div className="min-w-0">{chartArea}</div>
        )}

      </div>

      {/* Overlay picker — the same Workspace-launched drawer (z-200) */}
      <CatalogDrawer
        isOpen={overlayDrawerOpen}
        onClose={() => setOverlayDrawerOpen(false)}
        context="overlay"
      />

      {/* Focused single-view story replay */}
      {isEquity && (
        <StoryMode
          open={storyOpen}
          onClose={() => setStoryOpen(false)}
          bars={rows}
          name={name}
          latest={latest ?? null}
          snapshot={snapshot}
          bigMoneyDates={bigMoneyDates}
        />
      )}
    </ErrorBoundary>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

/** Chapter label — small-caps eyebrow + fading hairline (Study reorg). */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)] whitespace-nowrap">
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--border), transparent)' }} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 bg-kd-elevated border border-kd-border rounded-xl">
      <span className="text-muted">{label}: </span>
      <span className="text-[var(--text-secondary)] mono font-medium">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


