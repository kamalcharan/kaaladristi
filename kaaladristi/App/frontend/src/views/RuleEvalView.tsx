import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateInferences } from '@/services/dcInference';
import type { InferenceEvalRow } from '@/services/dcInference';
import { MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import { fmtDate } from '@/lib/dateUtils';
import { ErrorBoundary } from '@/components/ui';

// ── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  worked:       { bg: 'bg-risk-green/15',    text: 'text-risk-green',    border: 'border-risk-green/35',    label: 'Worked'    },
  partial:      { bg: 'bg-risk-amber/15',    text: 'text-risk-amber',    border: 'border-risk-amber/35',    label: 'Partial'   },
  failed:       { bg: 'bg-risk-red/15',      text: 'text-risk-red',      border: 'border-risk-red/35',      label: 'Failed'    },
  inconclusive: { bg: 'bg-slate-800/60',     text: 'text-slate-500',     border: 'border-white/10',         label: 'No Signal' },
  running:      { bg: 'bg-risk-amber/10',    text: 'text-risk-amber',    border: 'border-risk-amber/25',    label: 'Running'   },
  pending:      { bg: 'bg-accent-indigo/10', text: 'text-accent-indigo', border: 'border-accent-indigo/25', label: 'Pending'   },
  turned:       { bg: 'bg-teal-500/10',      text: 'text-teal-400',      border: 'border-teal-400/30',      label: 'Turned'    },
};

const SUMMARY_PILLS = [
  ['worked',       'Worked',    'text-risk-green border-risk-green/30 bg-risk-green/10'],
  ['partial',      'Partial',   'text-risk-amber border-risk-amber/30 bg-risk-amber/10'],
  ['failed',       'Failed',    'text-risk-red border-risk-red/30 bg-risk-red/10'],
  ['inconclusive', 'No Signal', 'text-slate-400 border-white/10 bg-slate-800/50'],
  ['running',      'Running',   'text-risk-amber border-risk-amber/30 bg-risk-amber/10'],
  ['pending',      'Pending',   'text-accent-indigo border-accent-indigo/20 bg-accent-indigo/10'],
  ['turned',       'Turned',    'text-teal-400 border-teal-400/30 bg-teal-500/10'],
] as [string, string, string][];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sign(n: number) { return n >= 0 ? '+' : ''; }

function fmtPct(n: number | null, fallback = '—') {
  if (n == null) return fallback;
  return `${sign(n)}${n.toFixed(2)}%`;
}

function formatDateRange(start: string, end: string | null) {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OutcomeBadge({ result }: { result: InferenceEvalRow }) {
  const { outcome, final_return_pct, peak_return_pct, trough_return_pct, market_impact } = result;
  const s = OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.inconclusive;
  const isPos = market_impact?.includes('positive') || market_impact === 'bullish';
  const isNeg = market_impact?.includes('negative') || market_impact === 'bearish';
  const swingVal = isPos ? peak_return_pct : isNeg ? trough_return_pct : null;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold shrink-0',
      s.bg, s.text, s.border,
    )}>
      {s.label}
      {outcome !== 'pending' && final_return_pct != null && (
        <span className="mono font-normal opacity-85">
          {fmtPct(final_return_pct)}
          {swingVal != null && Math.abs(swingVal) > Math.abs(final_return_pct) + 0.1 && (
            <span className="opacity-60"> ↑{fmtPct(swingVal)}</span>
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

function ImpactBadge({ impact }: { impact: string | null }) {
  if (!impact) return <span className="text-[10px] text-slate-500">Turning Date</span>;
  const s = MARKET_STATUS_MAP.get(impact);
  const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-px rounded text-[9px] font-semibold border uppercase tracking-wide',
      c.bg, c.text, c.border,
    )}>
      {s?.label ?? impact}
    </span>
  );
}

function EvalRow({ r }: { r: InferenceEvalRow }) {
  const isTurning = r.market_impact === null;

  return (
    <div className={cn(
      'flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 rounded-xl bg-[#0f172a] border border-kd-border transition-all hover:border-white/15',
    )}>
      {/* Outcome badge — anchors left */}
      <div className="shrink-0 pt-0.5">
        <OutcomeBadge result={r} />
      </div>

      {/* Event name + date */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate leading-tight">
          {r.astro_event}
        </p>
        <p className="text-[10px] text-slate-500 mono mt-0.5">
          {formatDateRange(r.start_date, r.end_date)}
        </p>
      </div>

      {/* Impact + return detail */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <ImpactBadge impact={r.market_impact} />

        {/* Numbers */}
        {r.outcome !== 'pending' && r.prev_close != null && (
          <div className="text-[10px] mono text-slate-400 flex items-center gap-2">
            <span title="Close return">C {fmtPct(r.final_return_pct)}</span>
            {r.peak_return_pct != null && (
              <span title="Peak swing" className="text-slate-500">↑{fmtPct(r.peak_return_pct)}</span>
            )}
            {r.trough_return_pct != null && (
              <span title="Trough swing" className="text-slate-500">↓{fmtPct(r.trough_return_pct)}</span>
            )}
          </div>
        )}

        {/* Turning date trend */}
        {isTurning && r.eval_status === 'completed' && (r.pre_trend_pct != null || r.post_trend_pct != null) && (
          <div className="text-[10px] mono text-slate-400">
            <span title="Pre-event trend">Pre {fmtPct(r.pre_trend_pct)}</span>
            <span className="mx-1 text-slate-600">→</span>
            <span title="Post-event trend">Post {fmtPct(r.post_trend_pct)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function RuleEvalView() {
  const [index]                   = useState('NIFTY 50');
  const [minor, setMinor]         = useState(0.5);
  const [major, setMajor]         = useState(1.0);
  const [lookback, setLookback]   = useState(5);
  const [filterOutcome, setFilterOutcome] = useState('');

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

  const rows = data ?? [];

  const filtered = useMemo(
    () => filterOutcome ? rows.filter(r => r.outcome === filterOutcome) : rows,
    [rows, filterOutcome],
  );

  const inputCls = 'w-20 px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-white text-center mono focus:outline-none focus:border-accent-indigo/60 transition-colors';
  const labelCls = 'block text-[10px] uppercase tracking-widest font-bold text-muted mb-1.5';

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Rule Evaluation</h1>
          <p className="text-secondary font-medium">
            Did each DC inference rule work? Checked against real {index} price data.
          </p>
        </header>

        {/* Controls */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className={labelCls}>Index</label>
              <span className="px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 mono block">
                {index}
              </span>
            </div>

            <div>
              <label className={labelCls}>Minor threshold</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="0.1" max="5" step="0.1"
                  value={minor}
                  onChange={e => setMinor(Number(e.target.value))}
                  className={inputCls}
                />
                <span className="text-xs text-muted">%</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Major threshold</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="0.1" max="10" step="0.1"
                  value={major}
                  onChange={e => setMajor(Number(e.target.value))}
                  className={inputCls}
                />
                <span className="text-xs text-muted">%</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Lookback days</label>
              <input
                type="number" min="1" max="30" step="1"
                value={lookback}
                onChange={e => setLookback(Number(e.target.value))}
                className={inputCls}
              />
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

          {/* Summary strip */}
          {rows.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-kd-border">
              <button
                onClick={() => setFilterOutcome('')}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                  !filterOutcome
                    ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/40'
                    : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/20',
                )}
              >
                All {rows.length}
              </button>
              {SUMMARY_PILLS.map(([key, label, cls]) => {
                const count = rows.filter(r => r.outcome === key).length;
                if (!count) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterOutcome(f => f === key ? '' : key)}
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

        {/* Content */}
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
            <p className="text-base font-semibold text-white">Evaluation Failed</p>
            <p className="text-sm text-muted max-w-sm">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <p className="text-[11px] text-muted mono">
              Run: <span className="text-slate-400">python3 backend/apply_migration_017.py</span>
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted">No inference entries found.</p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            {filtered.map(r => (
              <EvalRow key={r.inference_id} r={r} />
            ))}
            {filtered.length === 0 && filterOutcome && (
              <div className="text-center py-12">
                <p className="text-sm text-muted">No entries with outcome "{filterOutcome}".</p>
              </div>
            )}
          </div>
        )}

        {rows.length > 0 && !isLoading && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {rows.length} rules · {index} · minor {minor}% · major {major}%
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}
