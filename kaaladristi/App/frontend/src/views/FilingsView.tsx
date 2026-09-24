/**
 * Filings (`/filings`) — the browsable corporate-announcement corpus.
 *
 * ⚠ Categories come from `desc_raw` (NSE's own subject line: 117 values, zero
 * NULLs), never from our `family` column — see constants/filingCategories.ts
 * for why that distinction is load-bearing.
 *
 * ⚠ A row EXPANDS; it does not navigate. This is a filings browser, so the
 * primary act on a row is reading the filing — the chart is a secondary link
 * inside the panel. Navigating away on click made the filing's own content
 * unreachable from the one page built to show it.
 *
 * ⚠ The panel never claims to hold the document. `km_filings_raw.raw_text` is
 * NULL on all 31,803 rows (`extract_status = 'pending'` — Sprint 3 has never
 * run), so what it shows is the exchange's own prose (`summary_text`, present
 * on every row) plus a link OUT to the PDF. When that prose adds nothing over
 * the subject line the panel says so rather than rendering an empty box.
 *
 * ⚠ The "High Priority" tab is MEASURED, not asserted. It carries results and
 * the three legal/distress classes that showed real forward drift, and
 * deliberately omits "Orders Won" — which pops +2.07% on Day 0 and gives back
 * 3.20% over the next month. The intuitive high-priority list is a losing one.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowUpDown, AlertTriangle, FileText, ChevronLeft, ChevronRight,
  ChevronDown, ExternalLink, LineChart, X,
} from 'lucide-react';
import { Card, PageHeader, Tabs, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useFilings } from '@/hooks/useFilings';
import { FILINGS_PAGE_SIZE, type FilingTab, type FilingSortKey, type FilingRow } from '@/services/filings';
import {
  FILING_GROUPS, MUTED_GROUP_IDS, DEFAULT_GROUP_IDS,
  groupForDesc, groupLabel, descsForGroup,
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

/** Full dissemination stamp for the detail panel, explicitly labelled IST. */
function fmtStamp(ts: string | null): string {
  if (!ts) return '—';
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return '—';
  const d = dt.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const t = dt.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  });
  return `${d}, ${t} IST`;
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

/** One grid template, shared by the header and every row, so they stay aligned. */
const GRID =
  'grid grid-cols-[92px_minmax(0,1fr)_16px] ' +
  'sm:grid-cols-[104px_minmax(0,1.3fr)_minmax(0,1fr)_16px] gap-x-3';

function FilingRowItem({
  row, onPickSubject, activeSubject,
}: {
  row: FilingRow;
  onPickSubject: (desc: string) => void;
  activeSubject: string | null;
}) {
  const [open, setOpen] = useState(false);
  const gid = groupForDesc(row.descRaw);
  const time = fmtTime(row.disseminatedAt);

  // ⚠ role=button on a div, NOT a <button>. The subject is itself a control
  // (click it to filter to that sub-chip) and a button inside a button is
  // invalid HTML — browsers drop the inner one, so the sub-chip would render
  // and simply not fire. Keyboard parity is restored by hand below.
  return (
    <div className="border-b border-kd-border last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}
        className={cn(
          GRID,
          'w-full text-left gap-y-1 px-3 py-2.5 items-start',
          'cursor-pointer hover:bg-kd-elevated transition-colors',
        )}
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
            <CategoryChip gid={gid} desc={row.descRaw} onPickSubject={onPickSubject}
              active={activeSubject === row.descRaw} />
          </div>
        </div>

        {/* Category + subject */}
        <div className="hidden sm:block min-w-0">
          <CategoryChip gid={gid} desc={row.descRaw} onPickSubject={onPickSubject}
              active={activeSubject === row.descRaw} />
        </div>

        <ChevronDown
          className={cn(
            'w-4 h-4 mt-0.5 shrink-0 text-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      {open && <FilingDetail row={row} />}
    </div>
  );
}

/**
 * What the exchange actually filed. Three facts and two exits — deliberately
 * not a summary of the document, which we do not have.
 */
function FilingDetail({ row }: { row: FilingRow }) {
  const navigate = useNavigate();

  return (
    <div className="px-3 pb-3 pt-1 sm:pl-[116px] space-y-2.5 bg-kd-elevated/40">
      {/* The exchange's own subject line, in full and unabbreviated */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">
          Subject
        </div>
        <div className="text-[12px] text-primary leading-snug break-words">{row.descRaw || '—'}</div>
      </div>

      {/* The prose, when it carries more than the subject line already did */}
      {row.summary ? (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">
            What was filed
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words whitespace-pre-line">
            {row.summary}
          </p>
        </div>
      ) : (
        // Not an error and not an empty box: the feed genuinely repeats the
        // subject line for this filing. Say which of the two it is.
        <p className="text-[11px] text-muted italic leading-relaxed">
          The exchange feed carries no wording beyond the subject line for this
          filing. The document itself has not been read — open it to see more.
        </p>
      )}

      <div className="text-[11px] text-muted font-mono">
        Disseminated {fmtStamp(row.disseminatedAt)}
        {row.day0 && <> · actionable {fmtDay(row.day0)}</>}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {row.docUrl ? (
          <a
            href={row.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium',
              'bg-[var(--accent)]/15 border border-[var(--accent)]/40 text-[var(--accent)]',
              'hover:bg-[var(--accent)]/25 transition-colors',
            )}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open filing
            {row.docSize && <span className="text-[11px] opacity-70">· {row.docSize}</span>}
          </a>
        ) : (
          <span className="text-[11px] text-muted italic">No document link in the feed.</span>
        )}

        {row.equityId != null && (
          <button
            type="button"
            onClick={() => navigate(
              `/chart/equity/${row.equityId}?name=${encodeURIComponent(row.companyName)}`,
            )}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium',
              'bg-kd-elevated border border-kd-border text-primary',
              'hover:border-[var(--accent)]/40 transition-colors',
            )}
          >
            <LineChart className="w-3.5 h-3.5" />
            Chart study
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The category badge plus the SUB-CHIP — NSE's own subject line, and a control.
 *
 * The subject was plain muted text, which meant the one piece of vocabulary
 * that actually distinguishes a QIP from a newspaper advert was visible and
 * unusable. Clicking it filters the page to that exact subject.
 */
function CategoryChip({
  gid, desc, onPickSubject, active,
}: {
  gid: string; desc: string;
  onPickSubject?: (desc: string) => void;
  active?: boolean;
}) {
  const legal = gid === 'legal' || gid === 'auditor';
  return (
    <div className="flex flex-col gap-0.5 min-w-0 items-start">
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
      {onPickSubject && desc ? (
        <button
          type="button"
          // The row wraps this and toggles the detail panel; without this the
          // click would expand the row instead of filtering.
          onClick={(e) => { e.stopPropagation(); onPickSubject(desc); }}
          title={`Show only "${desc}"`}
          className={cn(
            // A CHIP, not underlined text. Rendered as a caption it was
            // indistinguishable from the badge's subtitle — present, clickable
            // and invisible as a control, which is the whole reason the subject
            // vocabulary went unused.
            'inline-flex items-start text-left max-w-full px-1.5 py-0.5 rounded',
            'border text-[11px] leading-snug break-words transition-colors',
            active
              ? 'bg-[var(--accent)]/20 border-[var(--accent)]/50 text-[var(--accent)]'
              : 'bg-transparent border-kd-border text-muted '
                + 'hover:border-[var(--accent)]/40 hover:text-[var(--accent)]',
          )}
        >
          {desc}
        </button>
      ) : (
        <span className="text-[11px] text-muted leading-snug break-words">{desc}</span>
      )}
    </div>
  );
}

export default function FilingsView() {
  const [tab, setTab] = useState<FilingTab>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  // ⚠ EMPTY = "all categories" (minus Administrative), NOT "nothing".
  // It used to start as all 17 non-muted ids, which made every chip look ON
  // and made a click REMOVE a category — so narrowing to Capital Raise meant
  // clicking sixteen chips off. A chip row is read as "pick one", always.
  const [selected, setSelected] = useState<string[]>([]);
  const groupIds = selected.length ? selected : DEFAULT_GROUP_IDS;
  // One exact subject (a sub-chip). Narrower than a category, so it REPLACES
  // the category filter rather than intersecting with it.
  const [subject, setSubject] = useState<string | null>(null);
  const [sort, setSort] = useState<FilingSortKey>('date');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);

  const q = useMemo(() => ({
    tab, search, fromDate, toDate, groupIds, sort, ascending, page,
    subjects: subject ? [subject] : undefined,
    pageSize: FILINGS_PAGE_SIZE,
  }), [tab, search, fromDate, toDate, groupIds, subject, sort, ascending, page]);

  const { data, isLoading } = useFilings(q);

  const onSort = (col: FilingSortKey) => {
    if (col === sort) setAscending((a) => !a);
    else { setSort(col); setAscending(col === 'company'); }
    setPage(0);
  };

  const toggleGroup = (id: string) => {
    setSelected((cur) => cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]);
    // A category and a subject are two rungs of one ladder; keeping both would
    // show a subject filtered by a category it may not belong to.
    setSubject(null);
    setPage(0);
  };

  const pickSubject = (desc: string) => {
    setSubject((cur) => (cur === desc ? null : desc));
    setPage(0);
  };

  // Sub-chips appear once the user has narrowed to ONE category. Eighteen
  // groups' worth of subjects is 117 chips, which is a wall, not a filter.
  const subChips = selected.length === 1 ? descsForGroup(selected[0]) : [];

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
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted">
                {selected.length
                  ? `Showing ${selected.length} of ${FILING_GROUPS.length} categories`
                  : 'Showing all categories — pick one to narrow'}
              </span>
              {(selected.length > 0 || subject) && (
                <button
                  type="button"
                  onClick={() => { setSelected([]); setSubject(null); setPage(0); }}
                  className="text-[var(--accent)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          <div className="flex flex-wrap gap-1.5">
            {FILING_GROUPS.map((g) => {
              const on = selected.includes(g.id);
              const muted = MUTED_GROUP_IDS.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  title={muted
                    ? 'Routine compliance filings — hidden unless you pick this'
                    : undefined}
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

          {/* Sub-chips — NSE's own subject lines inside the picked category.
              This is where a QIP or a preferential issue is actually
              reachable: "Capital Raise" bundles thirteen of them. */}
          {subChips.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5 pl-0.5 border-l-2 border-kd-border ml-0.5">
              {subChips.map((d) => {
                const on = subject === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => pickSubject(d)}
                    className={cn(
                      'ml-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                      on
                        ? 'bg-[var(--accent)]/20 border-[var(--accent)]/50 text-[var(--accent)]'
                        : 'bg-transparent border-kd-border text-muted hover:text-primary',
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          {/* An active subject set from a RESULT ROW has no chip above to show
              it, so it would otherwise filter invisibly. */}
          {subject && subChips.length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-muted">Subject:</span>
              <button
                type="button"
                onClick={() => pickSubject(subject)}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                  'bg-[var(--accent)]/20 border border-[var(--accent)]/50 text-[var(--accent)]',
                )}
              >
                {subject}
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          </div>
        )}
      </Card>

      <Card rounded="xxl" className="overflow-hidden">
        {/* Column headers double as the sort control */}
        <div className={cn(GRID, 'px-3 py-2 border-b border-kd-border bg-kd-elevated')}>
          <SortHeader label="Day 0" col="date" sort={sort} ascending={ascending} onSort={onSort} />
          <SortHeader label="Company" col="company" sort={sort} ascending={ascending} onSort={onSort} />
          <SortHeader label="Category" col="category" sort={sort} ascending={ascending} onSort={onSort}
            className="hidden sm:flex" />
          <span aria-hidden="true" />
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
          data.rows.map((r) => (
            <FilingRowItem key={r.id} row={r} onPickSubject={pickSubject}
              activeSubject={subject} />
          ))
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
