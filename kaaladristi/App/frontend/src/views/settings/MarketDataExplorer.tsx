import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Search, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, BarChart3, Loader2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IndexPriceChart } from '@/components/domain';
import { fetchIndexCatalog } from '@/services/indexCatalog';
import { fetchIndexChartDataById } from '@/services/eodData';
import { fmtDate } from '@/lib/dateUtils';
import type { IndexCatalogItem, TimeRange } from '@/types';

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Inline Chart Panel (same pattern as /markets) ────────────────────────────

function InlineChart({ item, onClose }: { item: IndexCatalogItem; onClose: () => void }) {
  const [range, setRange] = useState<TimeRange>('1Y');

  const { data, isLoading } = useQuery({
    queryKey: ['index_chart', item.id, range],
    queryFn: () => fetchIndexChartDataById(item.id, range),
    staleTime: 120_000,
  });

  const chartData = data?.chartData ?? [];
  const stats = data?.stats ?? null;
  const isPositive = (stats?.change ?? 0) >= 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden mb-4 animate-fade-in">
      {/* Stats bar */}
      <div className="px-5 py-4 border-b border-kd-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-0.5">{item.name}</p>
              {stats ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold mono text-white">
                    {stats.currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <div className={cn('flex items-center gap-1', isPositive ? 'text-risk-green' : 'text-risk-red')}>
                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span className="text-xs font-bold mono">
                      {isPositive ? '+' : ''}{stats.change.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {' '}({isPositive ? '+' : ''}{stats.changePct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="h-8 w-40 bg-slate-800/60 rounded animate-pulse" />
              ) : null}
            </div>
            {stats && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 bg-slate-900/50 border border-white/5 rounded-md">
                  <span className="text-muted">Day H/L: </span>
                  <span className="text-slate-300 mono">{fmt(stats.dayHigh)} / {fmt(stats.dayLow)}</span>
                </span>
                <span className="px-2 py-0.5 bg-slate-900/50 border border-white/5 rounded-md">
                  <span className="text-muted">52W: </span>
                  <span className="text-slate-300 mono">{fmt(stats.low52w)} — {fmt(stats.high52w)}</span>
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
            <span className="text-sm text-muted">Loading chart...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="w-8 h-8 text-slate-600 mb-3" />
            <p className="text-sm text-muted">No EOD data for this index.</p>
          </div>
        ) : (
          <>
            <IndexPriceChart
              data={chartData}
              range={range}
              onRangeChange={setRange}
              isPositive={isPositive}
            />
            <p className="text-[10px] text-muted mt-2 text-right mono">
              {chartData.length} trading days &middot; {chartData[0].date} to {chartData[chartData.length - 1].date}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Index Card ───────────────────────────────────────────────────────────────

function IndexCard({
  item, isActive, onSelect,
}: {
  item: IndexCatalogItem;
  isActive: boolean;
  onSelect: () => void;
}) {
  const hasData = item.record_count > 0;

  return (
    <button
      onClick={hasData ? onSelect : undefined}
      className={cn(
        'w-full text-left bg-[#0f172a] border rounded-xl px-4 py-3 transition-all',
        isActive
          ? 'border-accent-indigo/50 ring-1 ring-accent-indigo/20'
          : 'border-kd-border hover:border-white/15',
        hasData ? 'cursor-pointer' : 'cursor-default opacity-60',
      )}
    >
      {/* Row 1: name + last close */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-white truncate">{item.name}</span>
        {item.last_close ? (
          <span className="text-[12px] mono text-slate-300 font-medium shrink-0">
            {item.last_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-[10px] text-muted">No data</span>
        )}
      </div>

      {/* Row 2: category + exchange + date range + days */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {item.category && (
          <span className="text-[10px] px-1.5 py-px rounded bg-slate-800/80 border border-white/5 text-slate-400 font-medium">
            {item.category}
          </span>
        )}
        <span className="text-[10px] text-slate-500 mono">{item.exchange}</span>
        {item.data_from && item.data_to && (
          <span className="text-[10px] text-slate-500 mono">
            {fmtDate(item.data_from)} → {fmtDate(item.data_to)}
          </span>
        )}
        {hasData && (
          <span className="text-[10px] text-slate-500 mono">
            {item.record_count.toLocaleString('en-IN')} days
          </span>
        )}
        {hasData && (
          <BarChart3 className="w-3 h-3 text-accent-indigo ml-auto shrink-0" />
        )}
      </div>
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MarketDataExplorer({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: catalog = [], isLoading, isError, error } = useQuery({
    queryKey: ['index_catalog'],
    queryFn: fetchIndexCatalog,
    staleTime: 300_000,
  });

  const categories = useMemo(() =>
    [...new Set(catalog.map(c => c.category).filter(Boolean) as string[])].sort(),
    [catalog]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter(c => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (filterCategory && c.category !== filterCategory) return false;
      return true;
    });
  }, [catalog, search, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isFiltered = search || filterCategory;

  const activeItem = activeId ? catalog.find(c => c.id === activeId) ?? null : null;

  const handleSelect = (item: IndexCatalogItem) => {
    setActiveId(activeId === item.id ? null : item.id);
  };

  const selectCls = 'px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 focus:outline-none focus:border-accent-indigo/60 transition-colors';

  return (
    <div>
      {/* Back + header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Settings
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Market Data — Indexes</h2>
        <p className="text-sm text-secondary">
          {catalog.length} indexes &middot; tap any card to view its chart
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search indexes..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
          className={selectCls}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isFiltered && (
          <>
            <button
              onClick={() => { setSearch(''); setFilterCategory(''); setPage(1); }}
              className="px-3 py-2 text-xs text-risk-amber hover:text-white border border-risk-amber/30 hover:border-white/20 rounded-xl transition-all"
            >
              Clear
            </button>
            <span className="text-xs text-muted">{filtered.length} of {catalog.length}</span>
          </>
        )}
      </div>

      {/* Inline chart (expands below filter, above cards — same page) */}
      {activeItem && (
        <InlineChart item={activeItem} onClose={() => setActiveId(null)} />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading index catalog...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-risk-red mb-1">Failed to load index catalog</p>
          <p className="text-xs text-muted">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-[10px] text-muted mt-3 mono">Run km_migration_010_index_catalog_view.sql first</p>
        </div>
      ) : (
        <>
          {/* Card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {paged.map(item => (
              <IndexCard
                key={item.id}
                item={item}
                isActive={activeId === item.id}
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>

          {paged.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-muted">
                {isFiltered ? 'No indexes match your filters.' : 'No indexes found.'}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 mono">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <p className="text-[10px] text-muted mt-3 text-right mono">
            {catalog.length} indexes &middot; materialized view
          </p>
        </>
      )}
    </div>
  );
}
