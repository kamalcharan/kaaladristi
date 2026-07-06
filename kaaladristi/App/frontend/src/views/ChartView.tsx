import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndicatorDataById, fetchEquityEodById, fetchEquityTimeframeById, type EquityTimeframe } from '@/services/indicatorData';
import TradingChart from '@/components/charts/TradingChart';
import { InstrumentIntelligence } from '@/components/domain';
import PulseStudySwitch from '@/components/domain/PulseStudySwitch';
import StatStrip from '@/components/domain/StockCockpit/StatStrip';
import DeliveryVsTraded from '@/components/domain/StockCockpit/DeliveryVsTraded';
import SectorMembershipCard from '@/components/domain/StockCockpit/SectorMembershipCard';
import { useFrameworkStore } from '@/stores/frameworkStore';
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
  type TradingStyle,
  type PulseSnapshot,
  type PulseBar,
} from '@/services/visualPulseEngine';

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
  const [tf, setTf] = useState<EquityTimeframe>('daily');
  const [isFull, setIsFull] = useState(false);
  const [selectedStyle] = useState<TradingStyle>('Balanced');

  // Study Layer contract (POA Phase 1.5): the cockpit chart honors the SAME
  // framework overlays as the My Space chart — what you turn on in Catalog
  // follows you everywhere. Astro zones render in legacy chart mode too.
  const frameworkOverlays = useFrameworkStore((st) => st.framework?.chart_overlays ?? NO_OVERLAYS);
  const astroBands = useAstroOverlayBands(frameworkOverlays);

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

  // ── Pulse snapshot — feeds the header verdict chip only (Study gives no
  //     verdicts; the chip is the traveling decision context, POA Phase 0.2) ──
  const pulseIdx = pulseBars.length > 0 ? pulseBars.length - 1 : 0;

  const snapshot: PulseSnapshot | null = useMemo(() => {
    if (pulseBars.length === 0) return null;
    return computePulseSnapshot(pulseBars, pulseIdx, dcInferences, selectedStyle);
  }, [pulseBars, pulseIdx, dcInferences, selectedStyle]);

  // ── Equity-specific computations ──
  const rsChange1d = useMemo(() => rsChangeLookback(pulseBars, pulseIdx, 1), [pulseBars, pulseIdx]);
  const rsChange5d = useMemo(() => rsChangeLookback(pulseBars, pulseIdx, 5), [pulseBars, pulseIdx]);
  const rsChange20d = useMemo(() => rsChangeLookback(pulseBars, pulseIdx, 20), [pulseBars, pulseIdx]);

  // Scan all bars for pump/dump signals (not just current bar)
  const pumpDumpResult = useMemo(() => {
    if (!isEquity || pulseBars.length === 0) return null;
    return scanBarsForManipulation(pulseBars, 30);
  }, [isEquity, pulseBars]);

  // Evidence rail renders for equities with data (index rail arrives with
  // index-applicable cards in a later phase)
  const showRail = isEquity && rows.length > 0;

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
          <PulseStudySwitch
            active="study"
            type={isEquity ? 'equity' : 'index'}
            id={numId}
            name={name}
          />
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

        {/* ═══ Stat strip — Price · Momentum · Liquidity · Returns (Phase 1.1) ═══ */}
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
          showRail ? 'flex flex-col lg:grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]' : '',
        )}>
          {/* ── Left Panel: Intelligence + Chart ── */}
          <div className="min-w-0">
            {/* Chart area */}
            <div
              className={cn(
                'glass-card rounded-2xl p-3 mt-2',
                isFull && 'fixed inset-2 z-[300] overflow-auto',
              )}
              style={isFull ? { background: 'var(--kd-bg, #0b0f17)' } : undefined}
            >
              {/* Time range selector */}
              {!isLoading && !isError && rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-3 px-1">
                  {/* D/W/M timeframe (Phase 2.3) — equity only; index weekly
                      aggregates pending DB verification */}
                  {isEquity && (
                    <div className="flex items-center gap-0.5 mr-2 p-0.5 rounded-lg border border-kd-border bg-kd-elevated">
                      {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTf(t)}
                          className={cn(
                            'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                            tf === t
                              ? 'bg-accent-indigo/25 text-accent-indigo'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          )}
                        >
                          {t === 'daily' ? 'D' : t === 'weekly' ? 'W' : 'M'}
                        </button>
                      ))}
                    </div>
                  )}
                  {tf === 'daily' ? (
                    TIME_RANGES.map(r => (
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
                    ))
                  ) : (
                    <span className="text-[9px] text-muted font-mono px-1">
                      full history · {tf} bars
                    </span>
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
                  compact={showRail && !isFull}
                  height={isFull ? Math.max(700, window.innerHeight - 120) : undefined}
                  highlightDate={null}
                  overlays={frameworkOverlays}
                  astroBands={astroBands}
                />
              )}
            </div>

            {rows.length > 0 && (
              <p className="text-[9px] text-muted mt-1 text-right mono">
                {rows.length} days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
              </p>
            )}

            {/* VaNi instrument insight — evidence narration below the chart
                (Phase 1.6; indigo panel style comes from VaNiInsight itself) */}
            {!isLoading && !isError && rows.length > 0 && (
              <div className="mt-2">
                <InstrumentIntelligence id={numId} type={type ?? 'index'} />
              </div>
            )}

          </div>

          {/* ── Right Panel: evidence rail (Phase 1.2–1.4) — Study shows
                evidence, never verdicts ── */}
          {showRail && (
            <div className="min-w-0 flex flex-col gap-2.5 overflow-y-auto pb-4 lg:max-h-[calc(100vh-80px)]"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--kd-border) transparent' }}
            >
              <ScanPresenceCard
                stock={scanPresence.stock}
                matchedScans={scanPresence.matchedScans}
              />
              <SectorMembershipCard equityId={numId} />
              <DeliveryVsTraded rows={rows} />
              <IndustryContextCard
                industry={equityPulse.meta?.industry ?? null}
                context={equityPulse.industryContext}
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


