import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import {
  ArrowLeft, Search, ChevronLeft, ChevronRight,
  Loader2, Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchEquityCatalog, toggleEquityActive } from '@/services/equityCatalog';
import { fmtDate } from '@/lib/dateUtils';
import type { EquityExchangeFilter } from '@/types';

const PAGE_SIZE = 50;

const EXCHANGE_OPTIONS: { value: EquityExchangeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NSE', label: 'NSE' },
  { value: 'BSE', label: 'BSE' },
];

export default function EquityCatalog({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [exchange, setExchange] = useState<EquityExchangeFilter>('NSE');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search input — only hit the DB after 300 ms of quiet
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [exchange, debouncedSearch]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['equity_catalog', exchange, debouncedSearch, page],
    queryFn: () => fetchEquityCatalog({ exchange, search: debouncedSearch, page, pageSize: PAGE_SIZE }),
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      toggleEquityActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equity_catalog'] });
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isFiltered = debouncedSearch || exchange !== 'ALL';

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
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-white">Equities</h2>
          {!isLoading && (
            <span className="text-sm text-secondary">
              {total.toLocaleString('en-IN')} symbols
              {isFetching && !isLoading && (
                <Loader2 className="inline ml-2 w-3 h-3 animate-spin" />
              )}
            </span>
          )}
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Exchange switcher — pill group */}
        <div className="flex items-center bg-slate-900/60 border border-kd-border rounded-xl p-0.5 gap-0.5 shrink-0">
          {EXCHANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setExchange(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                exchange === opt.value
                  ? 'bg-accent-indigo text-white shadow-sm'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol (e.g. RELIANCE, HDFC...)"
            className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors"
          />
        </div>

        {isFiltered && debouncedSearch && (
          <button
            onClick={() => { setSearch(''); }}
            className="px-3 py-2 text-xs text-risk-amber hover:text-white border border-risk-amber/30 hover:border-white/20 rounded-xl transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading equity catalog...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-risk-red mb-1">Failed to load equity catalog</p>
          <p className="text-xs text-muted">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-[10px] text-muted mt-3 mono">Run km_migration_016_catalog_views.sql first</p>
        </div>
      ) : (
        <>
          <div className="grid gap-1.5">
            {rows.map(item => (
              <div
                key={`${item.exchange}-${item.id}`}
                className={cn(
                  'flex items-center gap-3 bg-[#0f172a] border border-kd-border rounded-xl px-4 py-2.5 transition-all',
                  !item.is_active && 'opacity-50',
                )}
              >
                {/* Active toggle */}
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

                {/* Symbol */}
                <span className="text-[13px] font-semibold text-white mono w-28 shrink-0 truncate">
                  {item.symbol}
                </span>

                {/* Exchange badge */}
                <span className={cn(
                  'text-[9px] px-1.5 py-px rounded font-semibold shrink-0 uppercase tracking-wide',
                  item.exchange === 'NSE'
                    ? 'bg-accent-indigo/10 border border-accent-indigo/25 text-accent-indigo'
                    : 'bg-risk-amber/10 border border-risk-amber/25 text-risk-amber',
                )}>
                  {item.exchange}
                </span>

                {/* Index membership — show first 2 */}
                <span className="text-[10px] text-slate-500 truncate flex-1 hidden md:inline">
                  {item.index_names?.length
                    ? item.index_names.slice(0, 2).join(' · ')
                      + (item.index_names.length > 2 ? ` +${item.index_names.length - 2}` : '')
                    : '—'}
                </span>

                {/* Date range */}
                <span className="text-[10px] text-slate-500 mono shrink-0 hidden lg:inline w-[200px]">
                  {item.data_from && item.data_to
                    ? `${fmtDate(item.data_from)} → ${fmtDate(item.data_to)}`
                    : '—'}
                </span>

                {/* Record count */}
                <span className="text-[10px] text-slate-400 mono font-medium shrink-0 w-14 text-right hidden sm:inline">
                  {item.record_count > 0 ? item.record_count.toLocaleString('en-IN') : '—'}
                </span>

                {/* Last close */}
                <span className="text-[11px] text-slate-300 mono font-medium shrink-0 w-20 text-right">
                  {item.last_close
                    ? item.last_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                    : '—'}
                </span>
              </div>
            ))}
          </div>

          {rows.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-muted">
                {debouncedSearch
                  ? `No equities match "${debouncedSearch}" on ${exchange === 'ALL' ? 'any exchange' : exchange}.`
                  : `No equities found for ${exchange === 'ALL' ? 'any exchange' : exchange}.`}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted mono">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString('en-IN')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 mono w-16 text-center">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
