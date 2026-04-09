import { useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveIndexes } from '@/hooks';
import type { IndexCatalogItem } from '@/types';

function IndexCard({ item }: { item: IndexCatalogItem }) {
  const navigate = useNavigate();
  const close = item.last_close;

  return (
    <button
      onClick={() => navigate(`/chart/index/${item.id}?name=${encodeURIComponent(item.name)}`)}
      className={cn(
        'shrink-0 w-[140px] px-3 py-2.5 rounded-xl border text-left transition-all',
        'bg-kd-surface border-kd-border hover:border-accent-indigo/40 hover:bg-accent-indigo/5',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-accent-indigo uppercase tracking-wider truncate pr-1">
          {item.name.replace('NIFTY ', '').replace('Nifty ', '')}
        </span>
        <BarChart3 className="w-3 h-3 text-muted shrink-0" />
      </div>
      <div className="text-[13px] font-bold mono text-[var(--text-primary)]">
        {close != null
          ? close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '—'}
      </div>
      {item.category && (
        <div className="text-[9px] text-muted mt-0.5 truncate">{item.category}</div>
      )}
    </button>
  );
}

export default function ActiveIndexScroll() {
  const { data: indexes = [], isLoading } = useActiveIndexes();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[140px] h-[72px] bg-kd-elevated rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (indexes.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-accent-indigo" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Active Indexes</h3>
        <span className="ml-auto text-[10px] text-muted">{indexes.length} active · scroll →</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory">
        {indexes.map(item => (
          <div key={item.id} className="snap-start">
            <IndexCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
