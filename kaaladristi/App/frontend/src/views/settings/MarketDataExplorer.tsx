import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Search, ChevronLeft, ChevronRight, X,
  TrendingUp, TrendingDown, BarChart3, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IndexPriceChart } from '@/components/domain';
import { fetchIndexCatalog } from '@/services/indexCatalog';
import { fetchIndexChartDataById } from '@/services/eodData';
import { fmtDate } from '@/lib/dateUtils';
import type { IndexCatalogItem, ChartDataPoint, IndexStats, TimeRange } from '@/types';

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ── Chart Modal ──────────────────────────────────────────────────────────────

function ChartModal({
  item,
  onClose,
}: {
  item: IndexCatalogItem;
  onClose: () => void;
}) {
  const [range, setRange] = useState<TimeRange>('1Y');

  const { data, isLoading } = useQuery({
    queryKey: ['index_chart', item.id, range],
    queryFn: () => fetchIndexChartDataById(item.id, range),
    staleTime: 120_000,
  });

  const chartData: ChartDataPoint[] = data?.chartData ?? [];
  const stats: IndexStats | null = data?.stats ?? null;
  const isPositive = (stats?.change ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-[#0f172a] border border-kd-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-kd-border">
          <div>
            <h2 className="text-lg font-bold text-white">{item.name}</h2>
            <p className="text-xs text-muted mt-0.5">
              {item.category} &middot; {item.exchange}
              {item.data_from && item.data_to && (
                <> &middot; {fmtDate(item.data_from)} → {fmtDate(item.data_to)}</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="px-8 py-4 border-b border-kd-border">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <span className="text-2xl font-bold mono text-white">
                  {stats.currentClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <div className={cn('flex items-center gap-1.5 mt-0.5', isPositive ? 'text-risk-green' : 'text-risk-red')}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span className="text-xs font-bold mono">
                    {isPositive ? '+' : ''}{stats.change.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {' '}({isPositive ? '+' : ''}{stats.changePct.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px]">
                <MiniStat label="Day H/L" value={`${fmt(stats.dayHigh)} / ${fmt(stats.dayLow)}`} />
                <MiniStat label="52W High" value={fmt(stats.high52w)} />
                <MiniStat label="52W Low" value={fmt(stats.low52w)} />
                <MiniStat label="Prev Close" value={fmt(stats.previousClose)} />
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-32 gap-3">
              <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
              <span className="text-sm text-muted">Loading chart data...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BarChart3 className="w-10 h-10 text-slate-600 mb-4" />
              <p className="text-sm text-muted">No EOD data available for this index.</p>
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
                {chartData.length} trading days
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1 bg-slate-900/50 border border-white/5 rounded-lg">
      <span className="text-muted">{label}: </span>
      <span className="text-slate-300 mono font-medium">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MarketDataExplorer({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [chartItem, setChartItem] = useState<IndexCatalogItem | null>(null);

  const { data: catalog = [], isLoading, isError, error } = useQuery({
    queryKey: ['index_catalog'],
    queryFn: fetchIndexCatalog,
    staleTime: 300_000, // 5 min — all users share same cached view
  });

  // Unique categories from data
  const categories = useMemo(() =>
    [...new Set(catalog.map(c => c.category).filter(Boolean) as string[])].sort(),
    [catalog]
  );

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter(c => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (filterCategory && c.category !== filterCategory) return false;
      return true;
    });
  }, [catalog, search, filterCategory]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isFiltered = search || filterCategory;

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

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Market Data — Indexes</h2>
          <p className="text-sm text-secondary">
            {catalog.length} indexes &middot; click chart icon to view price history
          </p>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
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
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
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

      {/* Table */}
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
          <div className="bg-[#0f172a] border border-kd-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted border-b border-kd-border">
                  <th className="px-4 py-3 text-left font-bold">Name</th>
                  <th className="px-4 py-3 text-left font-bold">Category</th>
                  <th className="px-4 py-3 text-left font-bold">Exchange</th>
                  <th className="px-4 py-3 text-left font-bold">Data From</th>
                  <th className="px-4 py-3 text-left font-bold">Data To</th>
                  <th className="px-4 py-3 text-right font-bold">Days</th>
                  <th className="px-4 py-3 text-right font-bold">Last Close</th>
                  <th className="px-4 py-3 text-center font-bold">Chart</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(item => (
                  <tr
                    key={item.id}
                    className="border-t border-kd-border/50 hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-[13px] font-semibold text-white">{item.name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-slate-400">{item.category ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-slate-400 mono">{item.exchange}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-slate-400 mono">{item.data_from ? fmtDate(item.data_from) : '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-slate-400 mono">{item.data_to ? fmtDate(item.data_to) : '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] text-slate-300 mono font-medium">
                        {item.record_count > 0 ? item.record_count.toLocaleString('en-IN') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] text-slate-300 mono font-medium">
                        {item.last_close ? item.last_close.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {item.record_count > 0 ? (
                        <button
                          onClick={() => setChartItem(item)}
                          title={`View ${item.name} chart`}
                          className="w-7 h-7 rounded-md flex items-center justify-center mx-auto text-slate-500 hover:text-accent-indigo hover:bg-accent-indigo/10 transition-all"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                      {isFiltered ? 'No indexes match your filters.' : 'No indexes found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
            {catalog.length} indexes &middot; materialized view (refreshed on data sync)
          </p>
        </>
      )}

      {/* Chart Modal */}
      {chartItem && (
        <ChartModal item={chartItem} onClose={() => setChartItem(null)} />
      )}
    </div>
  );
}
