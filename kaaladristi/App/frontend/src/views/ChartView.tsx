import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndicatorDataById, fetchEquityEodById } from '@/services/indicatorData';
import TradingChart from '@/components/charts/TradingChart';
import { InstrumentIntelligence } from '@/components/domain';
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
  type DotSignals,
  type CorrelationState,
  type PulseSnapshot,
  type PulseBar,
} from '@/services/visualPulseEngine';
import {
  CorrelationCard,
  OrderFlowCard,
  SmartMoneyCard,
  DivergenceCard,
  VaNiHeader,
  VaNiSentence,
  TimelineSlider,
} from '@/components/domain/VisualPulse';

import type { SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard';

// Equity-specific pulse components
import PumpDumpBanner, { scanBarsForManipulation } from '@/components/domain/VisualPulse/equity/PumpDumpBanner';
import ScanPresenceCard from '@/components/domain/VisualPulse/equity/ScanPresenceCard';
import IndustryContextCard from '@/components/domain/VisualPulse/equity/IndustryContextCard';
import MultiTimeframePills from '@/components/domain/VisualPulse/equity/MultiTimeframePills';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

/** Compute Magic RS change over N bars */
function rsChangeLookback(bars: PulseBar[], idx: number, lookback: number): number | null {
  if (idx < lookback) return null;
  const current = bars[idx]?.magic_rs;
  const prior = bars[idx - lookback]?.magic_rs;
  if (current == null || prior == null) return null;
  return current - prior;
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
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>('Balanced');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const numId = Number(id);
  const rawName = searchParams.get('name') ?? `${type} #${id}`;
  const isIndex = type === 'index';
  const isEquity = type === 'equity';

  // ── Chart data (full history for TradingChart) ──
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range],
    queryFn: () =>
      isEquity
        ? fetchEquityEodById(numId, range)
        : fetchIndicatorDataById(numId, range),
    staleTime: 120_000,
    enabled: !!numId && (isIndex || isEquity),
  });

  // ── Visual Pulse data — index uses useVisualPulse, equity uses useEquityVisualPulse ──
  const indexPulse = useVisualPulse(isIndex ? numId : null);
  const equityPulse = useEquityVisualPulse(isEquity ? numId : null);
  const scanPresence = useScanPresence(isEquity ? numId : null);

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

  // ── Visual Pulse computations (shared for both index + equity) ──
  const pulseIdx = activeIndex ?? (pulseBars.length > 0 ? pulseBars.length - 1 : 0);

  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (pulseBars.length === 0) return null;
    return computePulseSnapshot(pulseBars, pulseIdx, dcInferences, selectedStyle);
  }, [pulseBars, pulseIdx, dcInferences, selectedStyle]);

  const corrHistory: CorrelationState[] = useMemo(() => {
    if (pulseBars.length === 0) return [];
    return computeCorrHistory(pulseBars, dcInferences, selectedStyle);
  }, [pulseBars, dcInferences, selectedStyle]);

  const dotsHistory: DotSignals[] = useMemo(() => {
    return pulseBars.map((b, i) => computeDots(b, i > 0 ? pulseBars[i - 1] : null));
  }, [pulseBars]);

  const smHistory: SmartMoneyBar[] = useMemo(() => {
    const start = Math.max(0, pulseIdx - 29);
    const slice = pulseBars.slice(start, pulseIdx + 1);
    const dotsSlice = dotsHistory.slice(start, pulseIdx + 1);
    return slice.map((b, i) => ({
      sm: b.sniper_inst ?? 0,
      fm: b.sniper_hot ?? 0,
      isSVD: dotsSlice[i]?.isSVD ?? false,
      isSBD: dotsSlice[i]?.isSBD ?? false,
      isSYD: dotsSlice[i]?.isSYD ?? false,
    }));
  }, [pulseBars, pulseIdx, dotsHistory]);

  const rssHistory: number[] = useMemo(() => {
    const start = Math.max(0, pulseIdx - 19);
    return pulseBars.slice(start, pulseIdx + 1).map((b) => b.rss_value ?? 0);
  }, [pulseBars, pulseIdx]);

  const priceHistory = useMemo(() => {
    const start = Math.max(0, pulseIdx - 19);
    return pulseBars.slice(start, pulseIdx + 1).map((b) => b.close);
  }, [pulseBars, pulseIdx]);

  const rsiHistory = useMemo(() => {
    const start = Math.max(0, pulseIdx - 19);
    return pulseBars.slice(start, pulseIdx + 1).map((b) => b.rsi_14 ?? 50);
  }, [pulseBars, pulseIdx]);

  // ── Equity-specific computations ──
  const rsChange1d = useMemo(() => rsChangeLookback(pulseBars, pulseIdx, 1), [pulseBars, pulseIdx]);
  const rsChange5d = useMemo(() => rsChangeLookback(pulseBars, pulseIdx, 5), [pulseBars, pulseIdx]);
  const rsChange20d = useMemo(() => rsChangeLookback(pulseBars, pulseIdx, 20), [pulseBars, pulseIdx]);

  // Scan all bars for pump/dump signals (not just current bar)
  const pumpDumpResult = useMemo(() => {
    if (!isEquity || pulseBars.length === 0) return null;
    return scanBarsForManipulation(pulseBars, 30);
  }, [isEquity, pulseBars]);

  const handleStyleChange = useCallback((style: TradingStyle) => {
    setSelectedStyle(style);
  }, []);

  const handleSliderChange = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  // Show pulse panel for index or equity with data
  const showPulse = pulseBars.length > 0 && snapshot != null;

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

        {/* ═══ Equity: Pump/Dump Banner + Magic RS Pills ═══ */}
        {isEquity && pumpDumpResult && (
          <div className="mb-2">
            <PumpDumpBanner result={pumpDumpResult} />
          </div>
        )}
        {isEquity && pulseBars.length > 0 && (
          <div className="mb-3">
            <MultiTimeframePills
              rsChange1d={rsChange1d}
              rsChange5d={rsChange5d}
              rsChange20d={rsChange20d}
              currentRs={pulseBars[pulseIdx]?.magic_rs ?? null}
              benchmarkLabel="NIFTY 500"
            />
          </div>
        )}

        {/* ═══ Main Grid: starts immediately after header ═══ */}
        <div className={cn(
          'gap-3',
          showPulse ? 'flex flex-col lg:grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]' : '',
        )}>
          {/* ── Left Panel: Intelligence + Chart ── */}
          <div className="min-w-0">
            {/* Intelligence Panel — hidden when Visual Pulse cards are showing */}
            {!showPulse && !isLoading && !isError && rows.length > 0 && (
              <InstrumentIntelligence id={numId} type={type ?? 'index'} />
            )}

            {/* Chart area */}
            <div className="glass-card rounded-2xl p-3 mt-2">
              {/* Time range selector */}
              {!isLoading && !isError && rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-3 px-1">
                  {TIME_RANGES.map(r => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200',
                        range === r
                          ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-kd-elevated'
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
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
                <TradingChart data={rows} compact={showPulse} highlightDate={pulseBars[pulseIdx]?.trade_date ?? null} />
              )}
            </div>

            {rows.length > 0 && (
              <p className="text-[9px] text-muted mt-1 text-right mono">
                {rows.length} days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
              </p>
            )}

          </div>

          {/* ── Right Panel: Visual Pulse Cards ── */}
          {showPulse && snapshot && (
            <div className="min-w-0 flex flex-col gap-2.5 overflow-y-auto pb-4 lg:max-h-[calc(100vh-80px)]"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--kd-border) transparent' }}
            >
              {/* VaNi Header */}
              <div className="glass-card rounded-xl p-2.5">
                <VaNiHeader
                  date={snapshot.bar.trade_date}
                  barPosition="Latest"
                />
              </div>

              {/* VaNi Narrative */}
              <VaNiSentence
                narrative={null}
                corrState={snapshot.corrState}
                date={snapshot.bar.trade_date}
              />

              {/* Equity-specific cards */}
              {isEquity && (
                <>
                  <ScanPresenceCard
                    stock={scanPresence.stock}
                    matchedScans={scanPresence.matchedScans}
                  />
                  <IndustryContextCard
                    industry={equityPulse.meta?.industry ?? null}
                    context={equityPulse.industryContext}
                  />
                </>
              )}

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
                narrative={buildFlowNarrative(snapshot)}
              />

              {/* Smart Money */}
              <SmartMoneyCard
                smHistory={smHistory}
                sm={snapshot.sm}
                dots={[snapshot.dots]}
                narrative={buildSmNarrative(snapshot)}
              />

              {/* Divergence */}
              <DivergenceCard
                divergence={snapshot.divergence}
                rsiHistory={rsiHistory}
                priceHistory={priceHistory}
              />
            </div>
          )}
        </div>

        {/* ═══ Timeline Slider (full width) ═══ */}
        {showPulse && (
          <div className="mt-3 glass-card rounded-2xl overflow-hidden">
            <TimelineSlider
              total={pulseBars.length}
              activeIndex={pulseIdx}
              bars={pulseBars}
              corrHistory={corrHistory}
              onChange={handleSliderChange}
            />
          </div>
        )}
      </div>
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

// ── Card narratives (flow + smart money) ────────────────────────

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
