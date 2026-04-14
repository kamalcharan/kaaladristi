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

// Visual Pulse imports
import { useVisualPulse } from '@/hooks/useVisualPulse';
import {
  computePulseSnapshot,
  computeRssSignals,
  computeSmartMoney,
  computeDots,
  type TradingStyle,
  type DotSignals,
  type PulseSnapshot,
} from '@/services/visualPulseEngine';
import {
  CorrelationCard,
  OrderFlowCard,
  SmartMoneyCard,
  DivergenceCard,
  VaNiHeader,
  VaNiSentence,
  AstroStrip,
} from '@/components/domain/VisualPulse';
import type { SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

/**
 * Generic chart page with Visual Pulse intelligence panel.
 * Routes:
 *   /chart/index/:id?name=NIFTY%2050
 *   /chart/equity/:id?name=RELIANCE  (future — no pulse panel)
 */
export default function ChartView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>('1Y');
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>('Balanced');

  const numId = Number(id);
  const name = searchParams.get('name') ?? `${type} #${id}`;
  const isIndex = type === 'index';

  // ── Chart data (full history for TradingChart) ──
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range],
    queryFn: () =>
      type === 'equity'
        ? fetchEquityEodById(numId, range)
        : fetchIndicatorDataById(numId, range),
    staleTime: 120_000,
    enabled: !!numId && (type === 'index' || type === 'equity'),
  });

  // ── Visual Pulse data (last 60 bars + dc_inference — index only) ──
  const { bars: pulseBars, dcInferences } = useVisualPulse(isIndex ? numId : null);

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

  // ── Visual Pulse computations (latest bar only) ──
  const pulseIdx = pulseBars.length > 0 ? pulseBars.length - 1 : 0;

  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (pulseBars.length === 0) return null;
    return computePulseSnapshot(pulseBars, pulseIdx, dcInferences, selectedStyle);
  }, [pulseBars, pulseIdx, dcInferences, selectedStyle]);

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

  const handleStyleChange = useCallback((style: TradingStyle) => {
    setSelectedStyle(style);
  }, []);

  // Show pulse panel only for index with data
  const showPulse = isIndex && pulseBars.length > 0 && snapshot != null;

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
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{name}</h1>
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
            </>
          )}
        </div>

        {/* ═══ Main Grid: starts immediately after header ═══ */}
        <div className={cn(
          'gap-3',
          showPulse ? 'grid grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]' : '',
        )}>
          {/* ── Left Panel: Intelligence + Chart ── */}
          <div className="min-w-0">
            {/* Intelligence Panel */}
            {!isLoading && !isError && rows.length > 0 && (
              <InstrumentIntelligence id={numId} type={type ?? 'index'} />
            )}

            {/* Chart area */}
            <div className="glass-card rounded-2xl p-3 mt-3">
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
                <TradingChart data={rows} />
              )}
            </div>

            {rows.length > 0 && (
              <p className="text-[9px] text-muted mt-1 text-right mono">
                {rows.length} days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
              </p>
            )}

            {/* Astro Strip (below chart, inside left column) */}
            {isIndex && dcInferences.length > 0 && (
              <div className="glass-card rounded-2xl p-3 mt-3">
                <AstroStrip
                  dcInferences={dcInferences}
                  activeDate={latest?.trade_date ?? ''}
                />
              </div>
            )}
          </div>

          {/* ── Right Panel: Visual Pulse Cards (index only) ── */}
          {showPulse && snapshot && (
            <div className="min-w-0 flex flex-col gap-2.5 sticky top-0 max-h-screen overflow-y-auto pb-4"
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
  else if (sm.smExiting) parts.push('Smart money declining — distribution risk.');
  else parts.push('Smart money flat.');

  if (sm.hasSVD5) parts.push('SVD signal in last 5 bars — institutional volume confirmed.');
  if (sm.hasSYD) parts.push('SYD present — distribution caution.');
  if (sm.pumpSignal) parts.push('Smart declining while fast rising — pump signature.');

  if (sm.relationship === 'Aligned') parts.push('Both layers aligned.');
  else if (sm.relationship === 'Diverging') parts.push('Layers diverging — elevated risk.');

  return parts.join(' ');
}
