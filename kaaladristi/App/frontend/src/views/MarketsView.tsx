import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, Database, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useIndexChart, useIndexEodFull } from '@/hooks';
import { LuckyPopChart } from '@/components/domain';
import { Skeleton, ErrorBoundary } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MarketSymbol, TimeRange } from '@/types';

const INDEX_LABELS: Record<MarketSymbol, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT: 'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
};

export default function MarketsView() {
  const { selectedSymbol } = useAppStore();
  const [range, setRange] = useState<TimeRange>('1Y');
  const { data: statsData, isLoading: statsLoading } = useIndexChart(selectedSymbol, range);
  const { data: eodRows, isLoading: eodLoading, isError, error, refetch } = useIndexEodFull(selectedSymbol, range);

  const isLoading = statsLoading || eodLoading;
  const chartData = eodRows ?? [];
  const stats = statsData?.stats ?? null;
  const isPositive = (stats?.change ?? 0) >= 0;
  const indexName = INDEX_LABELS[selectedSymbol];

  // Detect specific error types for better messaging
  const errorMsg = error?.message || '';
  const isAuthError = errorMsg.includes('auth') || errorMsg.includes('connect') || errorMsg.includes('credentials');
  const isDataMissing = errorMsg.includes('not found') || errorMsg.includes('seed');

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Markets</h1>
          <p className="text-secondary font-medium">Historical price data for NSE indices</p>
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
              {/* Price + Change */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">{indexName}</p>
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

              {/* Key stats pills */}
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
              {isAuthError ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-risk-amber/10 border border-risk-amber/30 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-risk-amber" />
                  </div>
                  <p className="text-lg font-semibold text-white mb-2">Connection Issue</p>
                  <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">
                    Unable to connect to the database. This usually means the Supabase project
                    is unreachable or your authentication session has expired.
                  </p>
                  <div className="space-y-3">
                    <div className="text-left text-xs text-muted space-y-1.5 bg-slate-900/60 border border-white/5 rounded-xl p-4 max-w-sm">
                      <p className="text-slate-400 font-semibold mb-2">Troubleshooting:</p>
                      <p>1. Check that VITE_SUPABASE_URL is correct in .env</p>
                      <p>2. Verify your Supabase project is active (not paused)</p>
                      <p>3. Try signing out and back in</p>
                    </div>
                    <button
                      onClick={() => refetch()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                  </div>
                </>
              ) : isDataMissing ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center mb-6">
                    <Database className="w-8 h-8 text-accent-violet" />
                  </div>
                  <p className="text-lg font-semibold text-white mb-2">Index Not Found</p>
                  <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">
                    The <span className="text-white font-medium">{indexName}</span> index was not found
                    in the database. The master symbols need to be seeded first.
                  </p>
                  <div className="text-left text-xs space-y-2 bg-slate-900/60 border border-white/5 rounded-xl p-4 max-w-md">
                    <p className="text-slate-400 font-semibold mb-2">Run these SQL scripts in Supabase:</p>
                    <code className="block text-accent-indigo mono">1. km_clean_rebuild.sql</code>
                    <code className="block text-accent-indigo mono">2. km_seed_masters.sql</code>
                    <code className="block text-accent-indigo mono">3. km_fix_rls_recursion.sql</code>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-risk-red" />
                  </div>
                  <p className="text-lg font-semibold text-white mb-2">Failed to Load Chart Data</p>
                  <p className="text-sm text-secondary max-w-md mb-4 leading-relaxed">
                    {errorMsg || 'An unexpected error occurred while fetching market data.'}
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </>
              )}
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-lg font-semibold text-white mb-2">No Price Data</p>
              <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">
                The <span className="text-white font-medium">{indexName}</span> index exists in the database
                but has no EOD price data loaded yet. Run the historical downloader to backfill.
              </p>
              <div className="text-left text-xs space-y-2 bg-slate-900/60 border border-white/5 rounded-xl p-4 max-w-md">
                <p className="text-slate-400 font-semibold mb-2">From App/backend/ run:</p>
                <code className="block text-accent-indigo mono">
                  python3 yfinance_historical.py --type index --limit 5
                </code>
                <p className="text-muted mt-2">This will download ~20 years of OHLCV data for the top 5 indices.</p>
              </div>
            </div>
          ) : (
            <LuckyPopChart
              data={chartData}
              range={range}
              onRangeChange={setRange}
            />
          )}
        </div>

        {/* Data summary */}
        {chartData.length > 0 && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {chartData.length} trading days &middot; {chartData[0].trade_date} to {chartData[chartData.length - 1].trade_date}
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
