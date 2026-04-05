import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchIndexChartDataById } from '@/services/eodData';
import { IndexPriceChart } from '@/components/domain';
import { Skeleton, ErrorBoundary } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/types';

/**
 * Generic chart page — reuses the same layout as /markets.
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

  // For now only index is supported — equity/commodity will follow same pattern
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chart', type, numId, range],
    queryFn: () => fetchIndexChartDataById(numId, range),
    staleTime: 120_000,
    enabled: !!numId && type === 'index',
  });

  const chartData = data?.chartData ?? [];
  const stats = data?.stats ?? null;
  const isPositive = (stats?.change ?? 0) >= 0;

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
        ) : stats ? (
          <div className="glass-card rounded-3xl p-6 mb-6">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">{name}</p>
                <div className="flex items-baseline gap-4">
                  <span className="text-3xl font-bold mono text-white">
                    {stats.currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <div className={cn('flex items-center gap-1.5', isPositive ? 'text-risk-green' : 'text-risk-red')}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-sm font-bold mono">
                      {isPositive ? '+' : ''}{stats.change.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm font-bold mono">
                      ({isPositive ? '+' : ''}{stats.changePct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <StatPill label="Day H/L" value={`${fmt(stats.dayHigh)} / ${fmt(stats.dayLow)}`} />
                <StatPill label="52W High" value={fmt(stats.high52w)} />
                <StatPill label="52W Low" value={fmt(stats.low52w)} />
                <StatPill label="Prev Close" value={fmt(stats.previousClose)} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Chart area */}
        <div className="glass-card rounded-3xl p-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-12 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-risk-red" />
              </div>
              <p className="text-lg font-semibold text-white mb-2">Failed to Load Chart Data</p>
              <p className="text-sm text-secondary max-w-md mb-4 leading-relaxed">
                {error instanceof Error ? error.message : 'An unexpected error occurred.'}
              </p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : chartData.length === 0 ? (
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
            <IndexPriceChart
              data={chartData}
              range={range}
              onRangeChange={setRange}
              isPositive={isPositive}
            />
          )}
        </div>

        {chartData.length > 0 && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {chartData.length} trading days &middot; {chartData[0].date} to {chartData[chartData.length - 1].date}
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
