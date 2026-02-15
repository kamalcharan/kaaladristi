import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useIndexChart } from '@/hooks';
import { IndexPriceChart } from '@/components/domain';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MarketSymbol, TimeRange } from '@/types';

const INDEX_LABELS: Record<MarketSymbol, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  FINNIFTY: 'NIFTY FIN SERVICE',
  MIDCPNIFTY: 'NIFTY MIDCAP 50',
  SENSEX: 'S&P BSE SENSEX',
};

export default function MarketsView() {
  const { selectedSymbol } = useAppStore();
  const [range, setRange] = useState<TimeRange>('1Y');
  const { data, isLoading, isError, error } = useIndexChart(selectedSymbol, range);

  const chartData = data?.chartData ?? [];
  const stats = data?.stats ?? null;
  const isPositive = (stats?.change ?? 0) >= 0;
  const indexName = INDEX_LABELS[selectedSymbol];

  return (
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-risk-red mb-4" />
            <p className="text-lg font-semibold text-slate-400 mb-2">Failed to load chart data</p>
            <p className="text-sm text-muted max-w-md">
              {error?.message || 'Could not fetch data from Supabase. Make sure the index has been loaded.'}
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-lg font-semibold text-slate-400 mb-2">No data for {indexName}</p>
            <p className="text-sm text-muted max-w-md">
              Run the yfinance historical downloader to load EOD data for this index.
            </p>
            <code className="mt-4 px-4 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-[11px] text-accent-indigo mono">
              python yfinance_historical.py --mode index --symbol "{indexName}"
            </code>
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

      {/* Data summary */}
      {chartData.length > 0 && (
        <p className="text-[10px] text-muted mt-3 text-right mono">
          {chartData.length} trading days &middot; {chartData[0].date} to {chartData[chartData.length - 1].date}
        </p>
      )}
    </div>
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
