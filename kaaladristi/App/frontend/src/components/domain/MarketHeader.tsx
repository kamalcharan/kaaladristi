import { TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { RegimeBadge } from '@/components/domain';
import type { SnapshotMarket, MarketSymbol } from '@/types';

const INDEX_LABELS: Record<MarketSymbol, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  FINNIFTY: 'NIFTY FIN SERVICE',
  MIDCPNIFTY: 'NIFTY MIDCAP 50',
  SENSEX: 'S&P BSE SENSEX',
};

interface MarketHeaderProps {
  symbol: MarketSymbol;
  date: string;
  regime: string;
  market: SnapshotMarket | null;
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MarketHeader({ symbol, date, regime, market }: MarketHeaderProps) {
  const navigate = useNavigate();
  const isPositive = (market?.pct_change ?? 0) >= 0;

  return (
    <header className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-slate-300 mb-2 transition-colors group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Overview
          </button>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {INDEX_LABELS[symbol]}
            </h1>
            <RegimeBadge regime={regime} size="sm" />
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Cycle Date</p>
          <p className="text-lg font-bold font-mono text-slate-200">{date}</p>
        </div>
      </div>

      {/* Price + Stats Strip */}
      {market && (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          {/* Price + Change */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold mono text-white">
              {fmt(market.close ?? 0)}
            </span>
            <div className={cn('flex items-center gap-1.5', isPositive ? 'text-risk-green' : 'text-risk-red')}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-bold mono">
                {isPositive ? '+' : ''}{fmt(market.change ?? 0)}
              </span>
              <span className="text-sm font-bold mono">
                ({isPositive ? '+' : ''}{(market.pct_change ?? 0).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3 text-xs">
            <StatPill label="Open" value={fmt(market.open ?? 0)} />
            <StatPill label="High" value={fmt(market.high ?? 0)} />
            <StatPill label="Low" value={fmt(market.low ?? 0)} />
            <StatPill label="Prev" value={fmt(market.prev_close ?? 0)} />
            {market.w52_high != null && <StatPill label="52W H" value={fmt(market.w52_high)} />}
            {market.w52_low != null && <StatPill label="52W L" value={fmt(market.w52_low)} />}
          </div>
        </div>
      )}
    </header>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1 bg-slate-900/50 border border-white/5 rounded-lg">
      <span className="text-muted">{label}: </span>
      <span className="text-slate-300 mono font-medium">{value}</span>
    </div>
  );
}
