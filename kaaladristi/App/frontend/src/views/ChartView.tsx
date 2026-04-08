import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndicatorDataById, fetchEquityEodById } from '@/services/indicatorData';
import TradingChart from '@/components/charts/TradingChart';
import { Skeleton, ErrorBoundary } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/types';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

/**
 * Generic chart page — reuses TradingChart (same as /markets).
 * Routes:
 *   /chart/index/:id?name=NIFTY%2050
 *   /chart/equity/:id?name=RELIANCE  (future)
 *   /chart/commodity/:id?name=GOLD   (future)
 */
export default function ChartView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>('1Y');

  const numId = Number(id);
  const name = searchParams.get('name') ?? `${type} #${id}`;

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range],
    queryFn: () =>
      type === 'equity'
        ? fetchEquityEodById(numId, range)
        : fetchIndicatorDataById(numId, range),
    staleTime: 120_000,
    enabled: !!numId && (type === 'index' || type === 'equity'),
  });

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

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">{name}</h1>
          <p className="text-secondary font-medium">Historical price data &amp; technical indicators</p>
        </header>

        {/* Stats bar */}
        {isLoading ? (
          <div className="glass-card rounded-3xl p-6 mb-6">
            <div className="flex items-center gap-8">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ) : latest ? (
          <div className="glass-card rounded-3xl p-6 mb-6">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">{name}</p>
                <div className="flex items-baseline gap-4">
                  <span className="text-3xl font-bold mono text-white">
                    {currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <div className={cn('flex items-center gap-1.5', isPositive ? 'text-risk-green' : 'text-risk-red')}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-sm font-bold mono">
                      {isPositive ? '+' : ''}{change.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm font-bold mono">
                      ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <StatPill label="Day H/L" value={`${fmt(latest.high)} / ${fmt(latest.low)}`} />
                <StatPill label="52W High" value={fmt(high52w)} />
                <StatPill label="52W Low" value={fmt(low52w)} />
                <StatPill label="Prev Close" value={fmt(prevClose)} />
                {latest.rsi_14 != null && <StatPill label="RSI" value={latest.rsi_14.toFixed(1)} />}
                {latest.supertrend_dir != null && (
                  <StatPill label="SuperTrend" value={latest.supertrend_dir === 1 ? 'Bullish' : 'Bearish'} />
                )}
                {latest.magic_rs_zone && <StatPill label="MagicRS" value={latest.magic_rs_zone} />}
                {latest.chartink_score != null && <StatPill label="Chartink" value={`${latest.chartink_score}/3`} />}
              </div>
            </div>
          </div>
        ) : null}

        {/* Chart area */}
        <div className="glass-card rounded-3xl p-4">
          {/* Time range selector */}
          {!isLoading && !isError && rows.length > 0 && (
            <div className="flex items-center gap-1.5 mb-4 px-2">
              {TIME_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200',
                    range === r
                      ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4 p-2">
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-12 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[500px] w-full rounded-2xl" />
              <Skeleton className="h-[120px] w-full rounded-2xl" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-risk-red" />
              </div>
              <p className="text-lg font-semibold text-white mb-2">Failed to Load Chart Data</p>
              <p className="text-sm text-secondary max-w-md mb-4">{errorMsg || 'Unexpected error.'}</p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-lg font-semibold text-white mb-2">No Price Data</p>
              <p className="text-sm text-secondary max-w-md leading-relaxed">
                <span className="text-white font-medium">{name}</span> has no EOD data loaded yet.
              </p>
            </div>
          ) : (
            <TradingChart data={rows} />
          )}
        </div>

        {rows.length > 0 && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {rows.length} trading days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 bg-slate-900/50 border border-white/5 rounded-xl">
      <span className="text-muted">{label}: </span>
      <span className="text-slate-300 mono font-medium">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
