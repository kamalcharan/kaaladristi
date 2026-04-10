import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchCommodityCatalog } from '@/services/commodityCatalog';
import { fmtDate } from '@/lib/dateUtils';
import type { CommodityCatalogItem } from '@/types';

const PAGE_SIZE = 25;

export default function CommodityCatalog({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data: catalog = [], isLoading, isError, error } = useQuery({
    queryKey: ['commodity_catalog'],
    queryFn: fetchCommodityCatalog,
    staleTime: 300_000,
  });

  const categories = useMemo(() =>
    [...new Set(catalog.map(c => c.category).filter(Boolean) as string[])].sort(),
    [catalog]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter((c: CommodityCatalogItem) => {
      if (q && !c.symbol.toLowerCase().includes(q) && !c.name?.toLowerCase().includes(q)) return false;
      if (filterCategory && c.category !== filterCategory) return false;
      return true;
    });
  }, [catalog, search, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isFiltered = search || filterCategory;

  const selectCls = 'px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-secondary)] focus:outline-none focus:border-accent-indigo/60 transition-colors';

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Market Data
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-1">Commodity Data</h2>
        <p className="text-sm text-secondary">
          {catalog.length} symbols — MCX &amp; NCDEX
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search symbol or name..."
            className="w-full pl-9 pr-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo/60 transition-colors"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {isFiltered && (
          <>
            <button
              onClick={() => { setSearch(''); setFilterCategory(''); setPage(1); }}
              className="px-3 py-2 text-xs text-risk-amber hover:text-[var(--text-primary)] border border-risk-amber/30 hover:border-kd-border rounded-xl transition-all"
            >
              Clear
            </button>
            <span className="text-xs text-muted">{filtered.length} of {catalog.length}</span>
          </>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading commodity catalog...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-risk-red mb-1">Failed to load commodity catalog</p>
          <p className="text-xs text-muted">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-[10px] text-muted mt-3 mono">Run km_migration_016_catalog_views.sql first</p>
        </div>
      ) : (
        <>
          <div className="bg-kd-surface border-2 border-kd-border rounded-2xl overflow-hidden">
            {paged.map((item: CommodityCatalogItem) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-kd-border last:border-b-0 hover:bg-kd-elevated/40 transition-colors"
              >
                {/* Symbol */}
                <span className="text-[13px] font-semibold text-[var(--text-primary)] mono w-28 shrink-0 truncate">
                  {item.symbol}
                </span>

                {/* Name */}
                <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1 hidden sm:inline">
                  {item.name ?? '—'}
                </span>

                {/* Category badge */}
                {item.category && (
                  <span className="text-[9px] px-1.5 py-px rounded font-semibold shrink-0 uppercase tracking-wide bg-kd-elevated border border-kd-border text-[var(--text-secondary)]">
                    {item.category}
                  </span>
                )}

                {/* Exchange badge */}
                <span className="text-[9px] px-1.5 py-px rounded bg-risk-amber/10 border border-risk-amber/25 text-risk-amber font-semibold shrink-0 uppercase tracking-wide">
                  {item.exchange}
                </span>

                {/* Date range */}
                <span className="text-[10px] text-muted mono shrink-0 hidden md:inline w-[200px]">
                  {item.data_from && item.data_to
                    ? `${fmtDate(item.data_from)} → ${fmtDate(item.data_to)}`
                    : '—'}
                </span>

                {/* Record count */}
                <span className="text-[10px] text-[var(--text-secondary)] mono font-medium shrink-0 w-14 text-right hidden sm:inline">
                  {item.record_count > 0 ? item.record_count.toLocaleString('en-IN') : '—'}
                </span>

                {/* Last close */}
                <span className="text-[11px] text-[var(--text-secondary)] mono font-medium shrink-0 w-20 text-right">
                  {item.last_close
                    ? item.last_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                    : '—'}
                </span>
              </div>
            ))}

            {paged.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-muted">
                  {isFiltered ? 'No commodities match your filters.' : 'No commodities found. Seed MCX symbols to populate.'}
                </p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-indigo/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-[var(--text-secondary)] mono">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-indigo/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <p className="text-[10px] text-muted mt-3 text-right mono">
            {catalog.length} total
          </p>
        </>
      )}
    </div>
  );
}
