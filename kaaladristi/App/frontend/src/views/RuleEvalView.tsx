import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateInferences } from '@/services/dcInference';
import type { InferenceEvalRow } from '@/services/dcInference';
import { MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import { MONTH_ABBR, fmtDate } from '@/lib/dateUtils';
import { ErrorBoundary } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type PeriodFilter = 'all' | 'week' | 'month' | 'custom';
type SortKey = 'date_desc' | 'date_asc' | 'outcome' | 'return_desc' | 'return_asc';

const OUTCOME_ORDER = ['worked','partial','failed','running','inconclusive','turned','pending'];

// ── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  worked:       { bg: 'bg-risk-green/15',    text: 'text-risk-green',    border: 'border-risk-green/35',    label: 'Worked'    },
  partial:      { bg: 'bg-risk-amber/15',    text: 'text-risk-amber',    border: 'border-risk-amber/35',    label: 'Partial'   },
  failed:       { bg: 'bg-risk-red/15',      text: 'text-risk-red',      border: 'border-risk-red/35',      label: 'Failed'    },
  inconclusive: { bg: 'bg-kd-elevated',       text: 'text-[var(--text-muted)]', border: 'border-kd-border',    label: 'No Signal' },
  running:      { bg: 'bg-risk-amber/10',    text: 'text-risk-amber',    border: 'border-risk-amber/25',    label: 'Running'   },
  pending:      { bg: 'bg-accent-indigo/10', text: 'text-accent-indigo', border: 'border-accent-indigo/25', label: 'Pending'   },
  turned:       { bg: 'bg-accent-cyan/10',    text: 'text-accent-cyan',   border: 'border-accent-cyan/30',   label: 'Turned'    },
};

const SUMMARY_PILLS = [
  ['worked',       'Worked',    'text-risk-green border-risk-green/30 bg-risk-green/10'],
  ['partial',      'Partial',   'text-risk-amber border-risk-amber/30 bg-risk-amber/10'],
  ['failed',       'Failed',    'text-risk-red border-risk-red/30 bg-risk-red/10'],
  ['inconclusive', 'No Signal', 'text-[var(--text-secondary)] border-kd-border bg-kd-elevated'],
  ['running',      'Running',   'text-risk-amber border-risk-amber/30 bg-risk-amber/10'],
  ['pending',      'Pending',   'text-accent-indigo border-accent-indigo/20 bg-accent-indigo/10'],
  ['turned',       'Turned',    'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10'],
] as [string, string, string][];

const PAGE_SIZE = 15;

// ── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: number | string | null | undefined): number | null =>
  v == null ? null : Number(v);

const sign = (v: number) => v >= 0 ? '+' : '';

function fmtPct(v: number | string | null | undefined, fallback = '—'): string {
  const num = n(v);
  if (num == null) return fallback;
  return `${sign(num)}${num.toFixed(2)}%`;
}

function fmtPrice(v: number | null, ref: number): string {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDateRange(start: string, end: string | null) {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

function isoWeekBounds(): [string, string] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return [fmt(mon), fmt(sun)];
}

function isoMonthBounds(year: number, month: number): [string, string] {
  const pad = (v: number) => String(v).padStart(2, '0');
  const last = new Date(year, month, 0).getDate();
  return [`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(last)}`];
}

// ── Swing Visualization Bar ───────────────────────────────────────────────────

function SwingBar({
  peakRet, troughRet, closeRet, minor, major,
}: {
  peakRet: number | null; troughRet: number | null;
  closeRet: number | null; minor: number; major: number;
}) {
  const peak   = n(peakRet);
  const trough = n(troughRet);
  const close  = n(closeRet);

  if (peak == null && trough == null) return null;

  const absMax = Math.max(
    Math.abs(peak   ?? 0),
    Math.abs(trough ?? 0),
    major * 1.5,
    0.5,
  );
  const scale = absMax * 1.1;

  const pct2pos = (v: number) =>
    Math.max(1, Math.min(99, ((v + scale) / (scale * 2)) * 100));

  const mid       = pct2pos(0);
  const miP       = pct2pos(minor);
  const miN       = pct2pos(-minor);
  const maP       = pct2pos(major);
  const maN       = pct2pos(-major);
  const peakPos   = peak   != null ? pct2pos(peak)   : null;
  const troughPos = trough != null ? pct2pos(trough) : null;
  const closePos  = close  != null ? pct2pos(close)  : null;

  const swingL = peakPos != null && troughPos != null
    ? Math.min(peakPos, troughPos) : null;
  const swingW = peakPos != null && troughPos != null
    ? Math.abs(peakPos - troughPos) : null;

  return (
    <div className="relative h-5 select-none mt-1" title={`Trough ${fmtPct(trough)} · Peak ${fmtPct(peak)} · Close ${fmtPct(close)}`}>
      {/* Track */}
      <div className="absolute top-2 bottom-2 left-0 right-0 rounded-full bg-kd-bg/80 border border-kd-border" />

      {/* Major zones */}
      <div className="absolute top-2 bottom-2 bg-risk-green/8 rounded-r-full"
           style={{ left: `${maP}%`, right: 0 }} />
      <div className="absolute top-2 bottom-2 bg-risk-red/8 rounded-l-full"
           style={{ left: 0, right: `${100 - maN}%` }} />
      {/* Minor zones */}
      <div className="absolute top-2 bottom-2 bg-risk-green/5"
           style={{ left: `${miP}%`, right: `${100 - maP}%` }} />
      <div className="absolute top-2 bottom-2 bg-risk-red/5"
           style={{ left: `${maN}%`, right: `${100 - miN}%` }} />

      {/* Threshold lines */}
      <div className="absolute top-1 bottom-1 w-px bg-risk-green/40" style={{ left: `${miP}%` }} />
      <div className="absolute top-1 bottom-1 w-px bg-risk-red/40"   style={{ left: `${miN}%` }} />
      <div className="absolute top-1 bottom-1 w-px bg-risk-green/60" style={{ left: `${maP}%` }} />
      <div className="absolute top-1 bottom-1 w-px bg-risk-red/60"   style={{ left: `${maN}%` }} />

      {/* Zero line */}
      <div className="absolute top-0.5 bottom-0.5 w-px bg-[var(--text-secondary)]/50" style={{ left: `${mid}%` }} />

      {/* Swing range fill */}
      {swingL != null && swingW != null && (
        <div className="absolute top-2 bottom-2 bg-accent-indigo/20 rounded"
             style={{ left: `${swingL}%`, width: `${swingW}%` }} />
      )}

      {/* Trough marker */}
      {troughPos != null && (
        <div className="absolute top-1 bottom-1 w-[3px] rounded-full bg-risk-red/80"
             style={{ left: `${troughPos}%`, transform: 'translateX(-50%)' }} />
      )}
      {/* Peak marker */}
      {peakPos != null && (
        <div className="absolute top-1 bottom-1 w-[3px] rounded-full bg-risk-green/80"
             style={{ left: `${peakPos}%`, transform: 'translateX(-50%)' }} />
      )}
      {/* Close marker (white, thicker) */}
      {closePos != null && (
        <div className="absolute top-0.5 bottom-0.5 w-[3px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.4)]"
             style={{ left: `${closePos}%`, transform: 'translateX(-50%)' }} />
      )}
    </div>
  );
}

// ── OHLC Row ──────────────────────────────────────────────────────────────────

function OHLCRow({ r }: { r: InferenceEvalRow }) {
  const prev  = n(r.prev_close);
  if (prev == null || prev <= 0) return null;

  const high  = r.peak_return_pct   != null ? prev * (1 + n(r.peak_return_pct)!   / 100) : null;
  const low   = r.trough_return_pct != null ? prev * (1 + n(r.trough_return_pct)! / 100) : null;
  const close = r.final_return_pct  != null ? prev * (1 + n(r.final_return_pct)!  / 100) : null;

  return (
    <div className="flex items-center gap-3 text-[10px] mono pt-1.5 mt-1.5 border-t border-kd-border">
      <span className="text-[var(--text-muted)] uppercase tracking-wider font-bold">OHLC</span>
      <span className="text-[var(--text-secondary)]">
        O <span className="text-[var(--text-primary)]">{fmtPrice(prev, prev)}</span>
      </span>
      <span className="text-[var(--text-secondary)]">
        H <span className="text-risk-green">{high != null ? fmtPrice(high, prev) : '—'}</span>
      </span>
      <span className="text-[var(--text-secondary)]">
        L <span className="text-risk-red">{low != null ? fmtPrice(low, prev) : '—'}</span>
      </span>
      <span className="text-[var(--text-secondary)]">
        C <span className="text-[var(--text-primary)] font-semibold">{close != null ? fmtPrice(close, prev) : '—'}</span>
      </span>
      {close != null && (
        <span className={cn(
          'ml-1 font-semibold',
          close > prev ? 'text-risk-green' : close < prev ? 'text-risk-red' : 'text-slate-400',
        )}>
          {fmtPct(r.final_return_pct)}
        </span>
      )}
    </div>
  );
}

// ── Outcome Badge ─────────────────────────────────────────────────────────────

function OutcomeBadge({ result }: { result: InferenceEvalRow }) {
  const { outcome, final_return_pct, peak_return_pct, trough_return_pct, market_impact } = result;
  const s = OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.inconclusive;
  const isPos = market_impact?.includes('positive') || market_impact === 'bullish';
  const isNeg = market_impact?.includes('negative') || market_impact === 'bearish';
  const swingVal = n(isPos ? peak_return_pct : isNeg ? trough_return_pct : null);
  const close = n(final_return_pct);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold shrink-0',
      s.bg, s.text, s.border,
    )}>
      {s.label}
      {outcome !== 'pending' && close != null && (
        <span className="mono font-normal opacity-85">
          {fmtPct(close)}
          {swingVal != null && Math.abs(swingVal) > Math.abs(close) + 0.1 && (
            <span className="opacity-60"> swing {fmtPct(swingVal)}</span>
          )}
        </span>
      )}
      {outcome === 'turned' && result.turn_direction && (
        <span className="mono font-normal opacity-70">
          {result.turn_direction.replace(/_/g, ' ')}
        </span>
      )}
    </span>
  );
}

// ── Impact Badge ──────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: string | null }) {
  if (!impact) return <span className="text-[10px] text-[var(--text-muted)] italic">turning date</span>;
  const s = MARKET_STATUS_MAP.get(impact);
  const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-px rounded text-[9px] font-bold border uppercase tracking-wider',
      c.bg, c.text, c.border,
    )}>
      {s?.label ?? impact}
    </span>
  );
}

// ── Eval Row Card ─────────────────────────────────────────────────────────────

function EvalRow({ r, minor, major }: { r: InferenceEvalRow; minor: number; major: number }) {
  const isTurning = r.market_impact === null;
  const hasPrice  = n(r.prev_close) != null;

  return (
    <div className="px-4 py-3 rounded-xl bg-kd-bg border border-kd-border hover:border-kd-border-active transition-all">

      {/* Row 1 — outcome + event name + date */}
      <div className="flex items-start gap-3">
        <OutcomeBadge result={r} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight">
            {r.astro_event}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mono mt-0.5">
            {formatDateRange(r.start_date, r.end_date)}
          </p>
        </div>
      </div>

      {/* Row 2 — expected → achieved */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Expected</span>
        <ImpactBadge impact={r.market_impact} />
        <span className="text-[var(--text-muted)]">→</span>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Achieved</span>

        {r.eval_status === 'pending' ? (
          <span className="text-[10px] text-[var(--text-muted)] italic">starts {fmtDate(r.start_date)}</span>
        ) : !hasPrice ? (
          <span className="text-[10px] text-[var(--text-muted)] italic">no price data</span>
        ) : (
          <div className="flex items-center gap-2 text-[10px] mono text-[var(--text-secondary)]">
            <span>
              Close <span className={cn(
                'font-semibold',
                n(r.final_return_pct)! > 0 ? 'text-risk-green' :
                n(r.final_return_pct)! < 0 ? 'text-risk-red' : 'text-[var(--text-secondary)]',
              )}>{fmtPct(r.final_return_pct)}</span>
            </span>
            {r.peak_return_pct != null && (
              <span className="text-[var(--text-muted)]" title="Peak swing">↑ {fmtPct(r.peak_return_pct)}</span>
            )}
            {r.trough_return_pct != null && (
              <span className="text-[var(--text-muted)]" title="Trough swing">↓ {fmtPct(r.trough_return_pct)}</span>
            )}
            {isTurning && r.eval_status === 'completed' && (
              <>
                <span className="text-[var(--text-muted)] mx-1">|</span>
                <span title="Pre-event trend">Pre {fmtPct(r.pre_trend_pct)}</span>
                <span className="text-[var(--text-muted)]">→</span>
                <span title="Post-event trend">Post {fmtPct(r.post_trend_pct)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* OHLC row */}
      {hasPrice && r.eval_status !== 'pending' && <OHLCRow r={r} />}

      {/* Swing bar */}
      {hasPrice && r.eval_status !== 'pending' && !isTurning && (
        <SwingBar
          peakRet={r.peak_return_pct}
          troughRet={r.trough_return_pct}
          closeRet={r.final_return_pct}
          minor={minor}
          major={major}
        />
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function RuleEvalView() {
  // Eval params
  const [index]               = useState('NIFTY 50');
  const [minor, setMinor]     = useState(0.5);
  const [major, setMajor]     = useState(1.0);
  const [lookback, setLookback] = useState(5);

  // Filters
  const [filterOutcome, setFilterOutcome] = useState('');
  const [period, setPeriod]   = useState<PeriodFilter>('all');
  const [filterYear, setFilterYear]   = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);

  // Sort + pagination
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [page, setPage]       = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dc_eval', index, minor, major, lookback],
    queryFn: () => evaluateInferences({
      indexName: index,
      minorThreshold: minor,
      majorThreshold: major,
      lookbackDays: lookback,
    }),
    staleTime: 60_000,
  });

  const allRows = data ?? [];

  // Available years and months for "custom" filter
  const availYears = useMemo(
    () => [...new Set(allRows.map(r => r.start_date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [allRows],
  );
  const availMonths = useMemo(() => {
    const base = filterYear
      ? allRows.filter(r => r.start_date.startsWith(String(filterYear)))
      : allRows;
    return [...new Set(base.map(r => Number(r.start_date.slice(5, 7))))].sort((a, b) => a - b);
  }, [allRows, filterYear]);

  // Apply period / date filter
  const dateFiltered = useMemo(() => {
    if (period === 'all') return allRows;
    if (period === 'week') {
      const [from, to] = isoWeekBounds();
      return allRows.filter(r => r.start_date >= from && r.start_date <= to);
    }
    if (period === 'month') {
      const now = new Date();
      const [from, to] = isoMonthBounds(now.getFullYear(), now.getMonth() + 1);
      return allRows.filter(r => r.start_date >= from && r.start_date <= to);
    }
    // custom
    let res = allRows;
    if (filterYear)  res = res.filter(r => r.start_date.startsWith(String(filterYear)));
    if (filterMonth) {
      const m = String(filterMonth).padStart(2, '0');
      res = res.filter(r => r.start_date.slice(5, 7) === m);
    }
    return res;
  }, [allRows, period, filterYear, filterMonth]);

  // Apply outcome filter
  const outcomeFiltered = useMemo(
    () => filterOutcome ? dateFiltered.filter(r => r.outcome === filterOutcome) : dateFiltered,
    [dateFiltered, filterOutcome],
  );

  // Sort
  const sorted = useMemo(() => {
    const arr = [...outcomeFiltered];
    if (sortKey === 'date_asc')     return arr.sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (sortKey === 'date_desc')    return arr.sort((a, b) => b.start_date.localeCompare(a.start_date));
    if (sortKey === 'outcome')      return arr.sort((a, b) => OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome));
    if (sortKey === 'return_desc')  return arr.sort((a, b) => (n(b.final_return_pct) ?? -999) - (n(a.final_return_pct) ?? -999));
    if (sortKey === 'return_asc')   return arr.sort((a, b) => (n(a.final_return_pct) ?? 999)  - (n(b.final_return_pct) ?? 999));
    return arr;
  }, [outcomeFiltered, sortKey]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const selectCls = 'px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-secondary)] focus:outline-none focus:border-accent-indigo/60 transition-colors';
  const inputCls  = 'w-20 px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-primary)] text-center mono focus:outline-none focus:border-accent-indigo/60 transition-colors';
  const labelCls  = 'block text-[10px] uppercase tracking-widest font-bold text-muted mb-1.5';

  const PERIOD_PILLS: [PeriodFilter, string][] = [
    ['all',   'All Time'],
    ['week',  'This Week'],
    ['month', 'This Month'],
    ['custom','Custom'],
  ];

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-2">Rule Evaluation</h1>
          <p className="text-secondary font-medium">
            Did each DC inference rule work? Checked against real {index} price data.
          </p>
        </header>

        {/* ── Controls panel ── */}
        <div className="glass-card rounded-2xl p-5 mb-4 space-y-4">

          {/* Eval params row */}
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className={labelCls}>Index</label>
              <span className="px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-secondary)] mono block">
                {index}
              </span>
            </div>
            <div>
              <label className={labelCls}>Minor %</label>
              <div className="flex items-center gap-1.5">
                <input type="number" min="0.1" max="5" step="0.1"
                  value={minor} onChange={e => setMinor(Number(e.target.value))}
                  className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Major %</label>
              <div className="flex items-center gap-1.5">
                <input type="number" min="0.1" max="10" step="0.1"
                  value={major} onChange={e => setMajor(Number(e.target.value))}
                  className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Lookback days</label>
              <input type="number" min="1" max="30" step="1"
                value={lookback} onChange={e => setLookback(Number(e.target.value))}
                className={inputCls} />
            </div>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-xs font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              Re-evaluate
            </button>
          </div>

          {/* Period + sort row */}
          {allRows.length > 0 && (
            <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-kd-border">
              {/* Period pills */}
              <div>
                <p className={labelCls}>Period</p>
                <div className="flex items-center gap-1.5">
                  {PERIOD_PILLS.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setPeriod(key); resetPage(); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
                        period === key
                          ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/40'
                          : 'bg-kd-elevated text-[var(--text-secondary)] border-kd-border hover:border-kd-border-active hover:text-[var(--text-primary)]',
                      )}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Custom year/month — only when period === 'custom' */}
              {period === 'custom' && (
                <>
                  <div>
                    <label className={labelCls}>Year</label>
                    <select
                      value={filterYear ?? ''}
                      onChange={e => { setFilterYear(e.target.value ? Number(e.target.value) : null); resetPage(); }}
                      className={selectCls}
                    >
                      <option value="">All years</option>
                      {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Month</label>
                    <select
                      value={filterMonth ?? ''}
                      onChange={e => { setFilterMonth(e.target.value ? Number(e.target.value) : null); resetPage(); }}
                      className={selectCls}
                    >
                      <option value="">All months</option>
                      {availMonths.map(m => <option key={m} value={m}>{MONTH_ABBR[m - 1]}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Sort */}
              <div className="ml-auto">
                <label className={labelCls}>Sort by</label>
                <select
                  value={sortKey}
                  onChange={e => { setSortKey(e.target.value as SortKey); resetPage(); }}
                  className={selectCls}
                >
                  <option value="date_desc">Date — newest first</option>
                  <option value="date_asc">Date — oldest first</option>
                  <option value="outcome">Outcome (Worked → Failed)</option>
                  <option value="return_desc">Return — highest first</option>
                  <option value="return_asc">Return — lowest first</option>
                </select>
              </div>
            </div>
          )}

          {/* Outcome filter pills */}
          {allRows.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-kd-border">
              <button
                onClick={() => { setFilterOutcome(''); resetPage(); }}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                  !filterOutcome
                    ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/40'
                    : 'bg-kd-elevated text-[var(--text-secondary)] border-kd-border hover:border-kd-border-active',
                )}
              >
                All {dateFiltered.length}
              </button>
              {SUMMARY_PILLS.map(([key, label, cls]) => {
                const count = dateFiltered.filter(r => r.outcome === key).length;
                if (!count) return null;
                return (
                  <button
                    key={key}
                    onClick={() => { setFilterOutcome(f => f === key ? '' : key); resetPage(); }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                      filterOutcome === key ? cls : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/20',
                    )}
                  >
                    {count} {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
            <span className="text-sm text-muted">Running evaluation against {index}...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-risk-red" />
            </div>
            <p className="text-base font-semibold text-[var(--text-primary)]">Evaluation Failed</p>
            <p className="text-sm text-muted max-w-sm">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <p className="text-[11px] text-muted mono">
              Run: <span className="text-slate-400">python3 backend/apply_migration_017.py</span>
            </p>
          </div>
        ) : allRows.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted">No inference entries found.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-1.5">
              {paged.map(r => (
                <EvalRow key={r.inference_id} r={r} minor={minor} major={major} />
              ))}
              {sorted.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted">No entries match the current filters.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-[11px] text-[var(--text-muted)] mono">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={safePage <= 1}
                    className="px-2.5 py-1.5 text-[11px] border border-kd-border rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-kd-border-active disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-kd-border-active disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-[var(--text-secondary)] mono px-1">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-kd-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-kd-border-active disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={safePage >= totalPages}
                    className="px-2.5 py-1.5 text-[11px] border border-kd-border rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-kd-border-active disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {allRows.length > 0 && !isLoading && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {allRows.length} total · {index} · minor {minor}% · major {major}%
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}
