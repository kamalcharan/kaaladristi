/**
 * Filings (`/filings`) — the browsable corporate-announcement corpus.
 *
 * ⚠ Categories come from `desc_raw` (NSE's own subject line: 117 values, zero
 * NULLs), never from our `family` column — see constants/filingCategories.ts
 * for why that distinction is load-bearing.
 *
 * ⚠ The "High Priority" tab is MEASURED, not asserted. It carries results and
 * the three legal/distress classes that showed real forward drift, and
 * deliberately omits "Orders Won" — which pops +2.07% on Day 0 and gives back
 * 3.20% over the next month. The intuitive high-priority list is a losing one.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, AlertTriangle, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, PageHeader, Tabs, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useFilings } from '@/hooks/useFilings';
import { FILINGS_PAGE_SIZE, type FilingTab, type FilingSortKey, type FilingRow } from '@/services/filings';
import {
  FILING_GROUPS, MUTED_GROUP_IDS, DEFAULT_GROUP_IDS,
  groupForDesc, groupLabel,
} from '@/constants/filingCategories';

const TABS = [
  { id: 'all', label: 'All Filings' },
  { id: 'priority', label: 'High Priority' },
  { id: 'call', label: 'Conference Call' },
  { id: 'results', label: 'Results' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDay(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`;
}

/** The dissemination TIME, in IST. Mid-session is the interesting case. */
function fmtTime(ts: string | null): string {
  if (!ts) return '';
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  });
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function SortHeader({
  label, col, sort, ascending, onSort, className,
}: {
  label: string; col: FilingSortKey; sort: FilingSortKey; ascending: boolean;
  onSort: (c: FilingSortKey) => void; className?: string;
}) {
  const active = sort === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider',
        'hover:text-primary transition-colors',
        active ? 'text-[var(--accent)]' : 'text-muted',
        className,
      )}
    >
      {label}
      <ArrowUpDown className="w-3 h-3 shrink-0" />
      {active && <span className="text-[10px]">{ascending ? '↑' : '↓'}</span>}
    </button>
  );
}

function FilingRowItem({ row }: { row: FilingRow }) {
  const navigate = useNavigate();
  const gid = groupForDesc(row.descRaw);
  const time = fmtTime(row.disseminatedAt);
  const clickable = row.equityId != null;

  return (
    <div
      className={cn(
        'grid grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[104px_minmax(0,1.3fr)_minmax(0,1fr)]',
        'gap-x-3 gap-y-1 px-3 py-2.5 border-b border-kd-border last:border-b-0',
        clickable && 'cursor-pointer hover:bg-kd-elevated transition-colors',
      )}
      onClick={clickable
        ? () => navigate(`/chart/equity/${row.equityId}?name=${encodeURIComponent(row.companyName)}`)
        : undefined}
    >
      {/* Day 0 + dissemination time */}
      <div className="min-w-0">
        <div className="text-[12px] font-mono text-[var(--text-secondary)]">{fmtDay(row.day0)}</div>
        {time && <div className="text-[11px] font-mono text-muted">{time}</div>}
      </div>

      {/* Company */}
      <div className="min-w-0">
        <div className="text-[13px] text-primary font-medium leading-snug break-words">
          {row.companyName}
        </div>
        {/* Category shows here on phones, where the third column is gone */}
        <div className="sm:hidden mt-0.5">
          <CategoryChip gid={gid} desc={row.descRaw} />
        </div>
      </div>

      {/* Category + subject */}
      <div className="hidden sm:block min-w-0">
        <CategoryChip gid={gid} desc={row.descRaw} />
      </div>
    </div>
  );
}

function CategoryChip({ gid, desc }: { gid: string; desc: string }) {
  const legal = gid === 'legal' || gid === 'auditor';
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className={cn(
          'inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
          legal
            ? 'text-[var(--bear)] bg-[var(--bear-bg)]'
            : 'text-[var(--text-secondary)] bg-kd-elevated',
        )}
      >
        {legal && <AlertTriangle className="w-2.5 h-2.5" />}
        {groupLabel(gid)}
      </span>
      <span className="text-[11px] text-muted leading-snug break-words">{desc}</span>
    </div>
  );
}

export default function FilingsView() {
  const [tab, setTab] = useState<FilingTab>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [groupIds, setGroupIds] = useState<string[]>(DEFAULT_GROUP_IDS);
  const [sort, setSort] = useState<FilingSortKey>('date');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);

  const q = useMemo(() => ({
    tab, search, fromDate, toDate, groupIds, sort, ascending, page,
    pageSize: FILINGS_PAGE_SIZE,
  }), [tab, search, fromDate, toDate, groupIds, sort, ascending, page]);

  const { data, isLoading } = useFilings(q);

  const onSort = (col: FilingSortKey) => {
    if (col === sort) setAscending((a) => !a);
    else { setSort(col); setAscending(col === 'company'); }
    setPage(0);
  };

  const toggleGroup = (id: string) => {
    setGroupIds((cur) => cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]);
    setPage(0);
  };

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / FILINGS_PAGE_SIZE));
  const chipsActive = tab === 'all';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Filings"
        meta="Corporate announcements as the exchange files them — the why behind a bar."
      />

      <Tabs
        tabs={TABS}
        activeId={tab}
        onChange={(id) => { setTab(id as FilingTab); setPage(0); }}
        variant="underline"
      />

      <Card rounded="xxl" className="p-3 sm:p-4 space-y-3">
        {/* Search + dates */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search company name…"
              className={cn(
                'w-full pl-8 pr-3 py-1.5 rounded-md text-[13px]',
                'bg-kd-elevated border border-kd-border text-primary',
                'placeholder:text-muted focus:outline-none focus:border-[var(--accent)]',
              )}
            />
          </div>
          <input
            type="date" value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            className="px-2 py-1.5 rounded-md text-[12px] bg-kd-elevated border border-kd-border text-primary"
          />
          <span className="text-[12px] text-muted">to</span>
          <input
            type="date" value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            className="px-2 py-1.5 rounded-md text-[12px] bg-kd-elevated border border-kd-border text-primary"
          />
        </div>

        {/* Category chips — All tab only. On a filtered tab they would
            silently intersect and show an empty page nobody can explain. */}
        {chipsActive && (
          <div className="flex flex-wrap gap-1.5">
            {FILING_GROUPS.map((g) => {
              const on = groupIds.includes(g.id);
              const muted = MUTED_GROUP_IDS.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  title={muted ? 'Routine compliance filings — off by default' : undefined}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    on
                      ? 'bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]'
                      : 'bg-kd-elevated border-kd-border text-muted hover:text-primary',
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card rounded="xxl" className="overflow-hidden">
        {/* Column headers double as the sort control */}
        <div className={cn(
          'grid grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[104px_minmax(0,1.3fr)_minmax(0,1fr)]',
          'gap-x-3 px-3 py-2 border-b border-kd-border bg-kd-elevated',
        )}>
          <SortHeader label="Day 0" col="date" sort={sort} ascending={ascending} onSort={onSort} />
          <SortHeader label="Company" col="company" sort={sort} ascending={ascending} onSort={onSort} />
          <SortHeader label="Category" col="category" sort={sort} ascending={ascending} onSort={onSort}
            className="hidden sm:flex" />
        </div>

        {isLoading && !data ? (
          <div className="px-3 py-8 text-[12px] text-muted">Loading filings…</div>
        ) : data?.failed ? (
          // A failed read must never render as "no filings" — that is a
          // measurement the page did not make.
          <div className="px-3 py-8">
            <EmptyState
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Could not load filings"
              description="The request failed. This is not an empty result — retry, or check the data pipeline."
            />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="px-3 py-8">
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No filings match these filters"
              description={
                `Nothing was filed in this window under the selected categories. ` +
                `Collection begins 2026-07-10 — earlier dates were never fetched.`
              }
            />
          </div>
        ) : (
          data.rows.map((r) => <FilingRowItem key={r.id} row={r} />)
        )}
      </Card>

      {/* Pager — states the denominator, never a bare page number */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] text-muted font-mono">
            {page * FILINGS_PAGE_SIZE + 1}–{Math.min((page + 1) * FILINGS_PAGE_SIZE, total)} of {total.toLocaleString('en-IN')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button" disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className={cn(
                'p-1.5 rounded-md border border-kd-border',
                page === 0 ? 'text-muted opacity-40' : 'text-primary hover:bg-kd-elevated',
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-muted font-mono px-1">{page + 1} / {pages}</span>
            <button
              type="button" disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
              className={cn(
                'p-1.5 rounded-md border border-kd-border',
                page + 1 >= pages ? 'text-muted opacity-40' : 'text-primary hover:bg-kd-elevated',
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
