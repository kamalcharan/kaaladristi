import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndicatorDataById, fetchEquityEodById, fetchEquityTimeframeById, resampleRows, type EquityTimeframe } from '@/services/indicatorData';
import TradingChart from '@/components/charts/TradingChart';
import VaNiInsight from '@/components/domain/VaNiInsight';
import { useInstrumentInsight } from '@/hooks';
import StatStrip from '@/components/domain/StockCockpit/StatStrip';
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

  const numId = Number(id);
  const rawName = searchParams.get('name') ?? `${type} #${id}`;
  const isIndex = type === 'index';
  const isEquity = type === 'equity';

  // ── Chart data (full history for TradingChart) ──
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range, tf],
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
        {/* ═══ Compact Header Row: Back + Name + Price + Stats ═══ */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
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
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{name}</h1>
          {/* Pulse/Study toggle hidden (2026-07-09): Study is the single merged
              stock view. Pulse route still exists but is no longer linked from
              here. */}
          {/* Verdict chip — the ONLY decision-layer element allowed on Study
              (POA Phase 0.2): the Pulse verdict travels with the user. */}
          {snapshot && (
            <span
              title={`${snapshot.corrState.tagline} — open Pulse for the full verdict`}
              onClick={() => navigate(isEquity ? `/pulse/equity/${numId}` : `/pulse/${numId}`)}
              className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border cursor-pointer"
              style={{
                color: snapshot.corrState.color,
                borderColor: `color-mix(in srgb, ${snapshot.corrState.color} 40%, transparent)`,
                background: `color-mix(in srgb, ${snapshot.corrState.color} 12%, transparent)`,
              }}
            >
              ● Pulse: {snapshot.corrState.state}
            </span>
          )}
          {isEquity && equityPulse.meta?.industry && (
            <span className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded bg-kd-elevated">
              {equityPulse.meta.industry}
            </span>
          )}
          {!isLoading && latest && (
            <>
              <span className="text-xl font-bold mono text-[var(--text-primary)]">
                {currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <div className={cn('flex items-center gap-1', isPositive ? 'text-risk-green' : 'text-risk-red')}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span className="text-xs font-bold mono">
                  {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs ml-auto">
                <StatPill label="H/L" value={`${fmt(latest.high)} / ${fmt(latest.low)}`} />
                <StatPill label="52W" value={`${fmt(low52w)} – ${fmt(high52w)}`} />
                {latest.rsi_14 != null && <StatPill label="RSI" value={latest.rsi_14.toFixed(1)} />}
                {latest.magic_rs_zone && <StatPill label="RS" value={latest.magic_rs_zone} />}
              </div>
              {/* Equity edge-case badges */}
              {isEquity && equityPulse.meta && !equityPulse.meta.is_active && (
                <span className="text-[10px] font-mono text-risk-amber bg-risk-amber/10 px-1.5 py-0.5 rounded">
                  Inactive — last traded {latest.trade_date}
                </span>
              )}
              {isEquity && (() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const daysSince = Math.round((new Date(todayStr).getTime() - new Date(latest.trade_date).getTime()) / 86400000);
                return daysSince > 1 && equityPulse.meta?.is_active ? (
                  <span className="text-[10px] font-mono text-muted">
                    Last updated: {latest.trade_date} ({daysSince}d ago)
                  </span>
                ) : null;
              })()}
            </>
          )}
        </div>

        {/* ═══ Decision Band — the read leads: VaNi narrative + verdict ═══ */}
        {!isLoading && !isError && rows.length > 0 && (aiLoading || aiData?.insight || snapshot) && (
          <div className="flex flex-col lg:flex-row gap-3 lg:items-stretch mb-3">
            <div className="flex-1 min-w-0">
              {/* VaNiInsight brings its own indigo panel styling + chip highlights */}
              <VaNiInsight insight={aiData?.insight} isLoading={aiLoading} highlightChips className="mt-0" />
            </div>
            {snapshot && (
              <div
                className="shrink-0 lg:w-52 rounded-md px-3 py-2.5 flex flex-col justify-center"
                style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
              >
                <div className="text-[9px] uppercase tracking-widest text-muted">Verdict</div>
                <div className="text-lg font-mono font-bold mt-0.5" style={{ color: snapshot.corrState.color }}>
                  ● {snapshot.corrState.state}
                </div>
                <div className="text-[9px] text-muted mt-0.5">{snapshot.corrState.tagline}</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Snapshot — Conviction · Momentum · Liquidity · Returns ═══ */}
        {!isLoading && latest && (
          <StatStrip
            latest={latest}
            mcapCr={equityPulse.meta?.mcap_cr ?? scanPresence.stock?.mcap_cr ?? null}
            isEquity={isEquity}
          />
        )}

        {/* ═══ Equity: Pump/Dump Banner + Magic RS Pills ═══ */}
        {isEquity && pumpDumpResult && (
          <div className="mb-2">
            <PumpDumpBanner result={pumpDumpResult} />
          </div>
        )}
        {isEquity && hasRsData && (
          <div className="mb-3">
            <MultiTimeframePills
              rsChange1d={rsChange1d}
              rsChange5d={rsChange5d}
              rsChange20d={rsChange20d}
              currentRs={pulseBars[effectiveIdx]?.magic_rs ?? null}
              benchmarkLabel="NIFTY 500"
            />
          </div>
        )}

        {/* ═══ RS-Rotation (daily) — Magic RS × its momentum vs NIFTY 500 ═══ */}
        {/* Layout is provisional — placed under the RS pills for now; realign later. */}
        {isEquity && tf === 'daily' && hasRsData && (
          <div className="mb-3">
            <RotationGraph points={rotationPoints} benchmark="NIFTY 500" autoPlay playSeconds={7} />
          </div>
        )}

        {/* ═══ Evidence tiers (equity) · chart-centric (index) ═══ */}
        {isEquity ? (
          <>
            {/* Row A — Flow Heatmap 80% · Industry 20% */}
            {!isLoading && !isError && rows.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-[4fr_1fr] gap-3 mb-3">
                <div className="min-w-0">
                  {tf === 'daily' ? (
                    <StockFlowHeatmap label={name} rows={rows} />
                  ) : (
                    <div className="glass-card rounded-xl p-3 text-[10px] text-muted">
                      Flow heatmap is available on the daily timeframe.
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <IndustryContextCard
                    industry={equityPulse.meta?.industry ?? null}
                    context={equityPulse.industryContext}
                  />
                </div>
              </div>
            )}

            {/* Rows B/C — Order Flow · Smart Money · Big Money(spans) / Delivery(wide) */}
            {snapshot && (
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

            {/* Scan Presence · Member Of */}
            {!isLoading && !isError && rows.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                <ScanPresenceCard stock={scanPresence.stock} matchedScans={scanPresence.matchedScans} />
                <SectorMembershipCard equityId={numId} />
              </div>
            )}

            {/* Chart tier — Chart 70% · (Magic RS / RSI-MFI / Divergence) 30% */}
            <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 mb-3">
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
    </ErrorBoundary>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

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


