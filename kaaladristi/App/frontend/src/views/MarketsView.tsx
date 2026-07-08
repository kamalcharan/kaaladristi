import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, Database, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useIndicatorChart } from '@/hooks';
import TradingChart from '@/components/charts/TradingChart';
import { Skeleton, ErrorBoundary, PageHeader } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MarketSymbol, TimeRange } from '@/types';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

const INDEX_LABELS: Record<MarketSymbol, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT: 'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
};

export default function MarketsView() {
  const { selectedSymbol } = useAppStore();
  const [range, setRange] = useState<TimeRange>('1Y');
  const { data: indicatorData, isLoading, isError, error, refetch } = useIndicatorChart(selectedSymbol, range);

  const rows = indicatorData ?? [];
  const indexName = INDEX_LABELS[selectedSymbol];

  // Compute stats from latest row
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const currentClose = latest?.close ?? 0;
  const prevClose = prev?.close ?? currentClose;
  const change = currentClose - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const isPositive = change >= 0;

  // 52-week stats
  const last252 = rows.slice(-252);
  const high52w = last252.length > 0 ? Math.max(...last252.map((r) => r.high)) : 0;
  const low52w = last252.length > 0 ? Math.min(...last252.map((r) => r.low)) : 0;

  const errorMsg = error?.message || '';
  const isAuthError = errorMsg.includes('auth') || errorMsg.includes('connect') || errorMsg.includes('credentials');
  const isDataMissing = errorMsg.includes('not found') || errorMsg.includes('seed');

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        <PageHeader eyebrow="Markets" title="Markets" meta="Historical price data & technical indicators" />
        <div className="pt-6">

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
          <div className="glass-card rounded-3xl p-4 sm:p-6 mb-6">
            <div className="flex flex-wrap items-end gap-x-6 sm:gap-x-10 gap-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">{indexName}</p>
                <div className="flex items-baseline gap-4">
                  <span className="text-2xl sm:text-3xl font-bold mono text-[var(--text-primary)]">
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
                  <StatPill
                    label="SuperTrend"
                    value={latest.supertrend_dir === 1 ? 'Uptrend' : 'Downtrend'}
                  />
                )}
                {latest.magic_rs_zone && <StatPill label="MagicRS vs N500" value={latest.magic_rs_zone} />}
                {latest.chartink_score != null && <StatPill label="Chartink" value={`${latest.chartink_score}/3`} />}
              </div>
            </div>
          </div>
        ) : null}

        {/* Chart area */}
        <div className="glass-card rounded-3xl p-4">
          {/* Time range selector */}
          {!isLoading && !isError && rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4 px-2">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200',
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
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-12 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[500px] w-full rounded-2xl" />
              <Skeleton className="h-[120px] w-full rounded-2xl" />
              <Skeleton className="h-[120px] w-full rounded-2xl" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {isAuthError ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-risk-amber/10 border border-risk-amber/30 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-risk-amber" />
                  </div>
                  <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">Connection Issue</p>
                  <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">
                    Unable to connect to the database. Check your PostgREST URL and auth session.
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </>
              ) : isDataMissing ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center mb-6">
                    <Database className="w-8 h-8 text-accent-violet" />
                  </div>
                  <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">Index Not Found</p>
                  <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">
                    The <span className="text-[var(--text-primary)] font-medium">{indexName}</span> index was not found.
                    Run km_seed_masters.sql to seed index symbols.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-risk-red" />
                  </div>
                  <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">Failed to Load Chart Data</p>
                  <p className="text-sm text-secondary max-w-md mb-4">{errorMsg || 'Unexpected error.'}</p>
                  <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </>
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-kd-elevated border border-kd-border flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Price Data</p>
              <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">
                The <span className="text-[var(--text-primary)] font-medium">{indexName}</span> index has no EOD data.
                Run the historical downloader to backfill.
              </p>
              <div className="text-left text-xs space-y-2 bg-kd-elevated border border-kd-border rounded-xl p-4 max-w-md">
                <p className="text-[var(--text-secondary)] font-semibold mb-2">From App/backend/ run:</p>
                <code className="block text-accent-indigo mono">
                  python3 yfinance_historical.py --mode index
                </code>
              </div>
            </div>
          ) : (
            <TradingChart data={rows} />
          )}
        </div>

        {/* Data summary */}
        {rows.length > 0 && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {rows.length} trading days &middot; {rows[0].trade_date} to {rows[rows.length - 1].trade_date}
          </p>
        )}
        </div>
      </div>
    </ErrorBoundary>
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
