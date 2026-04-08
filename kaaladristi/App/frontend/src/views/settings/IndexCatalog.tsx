import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ChevronLeft, ChevronRight,
  BarChart3, Loader2, Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchIndexCatalog, toggleIndexActive } from '@/services/indexCatalog';
import { fmtDate } from '@/lib/dateUtils';
import type { IndexCatalogItem } from '@/types';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function IndexCatalog({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTri, setFilterTri] = useState('');
  const [page, setPage] = useState(1);

  const { data: catalog = [], isLoading, isError, error } = useQuery({
    queryKey: ['index_catalog'],
    queryFn: fetchIndexCatalog,
    staleTime: 300_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      toggleIndexActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['index_catalog'] });
    },
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
      if (filterStatus === 'active' && !c.is_active) return false;
      if (filterStatus === 'inactive' && c.is_active) return false;
      if (filterTri === 'tri' && !c.is_tri) return false;
      if (filterTri === 'price' && c.is_tri) return false;
      return true;
    });
  }, [catalog, search, filterCategory, filterStatus, filterTri]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isFiltered = search || filterCategory || filterStatus || filterTri;
  const activeCount = catalog.filter(c => c.is_active).length;

  const selectCls = 'px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 focus:outline-none focus:border-accent-indigo/60 transition-colors';

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Market Data
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Index Data</h2>
        <p className="text-sm text-secondary">
          {activeCount} active of {catalog.length} indexes
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
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className={selectCls}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filterTri}
          onChange={e => { setFilterTri(e.target.value); setPage(1); }}
          className={selectCls}
        >
          <option value="">All Types</option>
          <option value="price">Price Index</option>
          <option value="tri">TRI</option>
        </select>
        {isFiltered && (
          <>
            <button
              onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus(''); setFilterTri(''); setPage(1); }}
              className="px-3 py-2 text-xs text-risk-amber hover:text-white border border-risk-amber/30 hover:border-white/20 rounded-xl transition-all"
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
          <span className="text-sm text-muted">Loading index catalog...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-risk-red mb-1">Failed to load index catalog</p>
          <p className="text-xs text-muted">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-[10px] text-muted mt-3 mono">Run km_migration_011_index_is_active.sql first</p>
        </div>
      ) : (
        <>
          <div className="grid gap-1.5">
            {paged.map((item: IndexCatalogItem) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 bg-[#0f172a] border border-kd-border rounded-xl px-4 py-2.5 transition-all',
                  !item.is_active && 'opacity-50',
                )}
              >
                <button
                  onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.is_active })}
                  title={item.is_active ? 'Deactivate' : 'Activate'}
                  className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all',
                    item.is_active
                      ? 'text-risk-green hover:bg-risk-green/10'
                      : 'text-slate-600 hover:bg-slate-800 hover:text-slate-400',
                  )}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>

                <span className="text-[13px] font-semibold text-white truncate min-w-[180px] flex-1">
                  {item.name}
                </span>

                {item.category && (
                  <span className="text-[10px] px-1.5 py-px rounded bg-slate-800/80 border border-white/5 text-slate-400 font-medium shrink-0 hidden sm:inline">
                    {item.category}
                  </span>
                )}

                {item.is_tri && (
                  <span className="text-[9px] px-1.5 py-px rounded bg-accent-indigo/10 border border-accent-indigo/20 text-accent-indigo font-semibold shrink-0">
                    TRI
                  </span>
                )}

                <span className="text-[10px] text-slate-500 mono shrink-0 w-8">{item.exchange}</span>

                <span className="text-[10px] text-slate-500 mono shrink-0 hidden md:inline w-[200px]">
                  {item.data_from && item.data_to
                    ? `${fmtDate(item.data_from)} → ${fmtDate(item.data_to)}`
                    : '—'}
                </span>

                <span className="text-[10px] text-slate-400 mono font-medium shrink-0 w-14 text-right hidden sm:inline">
                  {item.record_count > 0 ? item.record_count.toLocaleString('en-IN') : '—'}
                </span>

                <span className="text-[11px] text-slate-300 mono font-medium shrink-0 w-20 text-right">
                  {item.last_close
                    ? item.last_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                    : '—'}
                </span>

                {item.record_count > 0 ? (
                  <button
                    onClick={() => navigate(`/chart/index/${item.id}?name=${encodeURIComponent(item.name)}`)}
                    title={`View ${item.name} chart`}
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-slate-500 hover:text-accent-indigo hover:bg-accent-indigo/10 transition-all"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="w-7 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {paged.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-muted">
                {isFiltered ? 'No indexes match your filters.' : 'No indexes found.'}
              </p>
            </div>
          )}

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
            {activeCount} active &middot; {catalog.length} total
          </p>
        </>
      )}
    </div>
  );
}
