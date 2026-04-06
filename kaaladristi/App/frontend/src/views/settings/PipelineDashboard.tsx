import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, MinusCircle,
  Loader2, Calendar, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchPipelineRuns, fetchTradingCalendar } from '@/services/pipelineData';
import { fmtDate } from '@/lib/dateUtils';
import type { PipelineRun, TradingCalendarDay } from '@/services/pipelineData';

// ── Step icon + color ────────────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-risk-green" />;
    case 'failed':    return <XCircle className="w-3.5 h-3.5 text-risk-red" />;
    case 'skipped':   return <MinusCircle className="w-3.5 h-3.5 text-slate-500" />;
    case 'running':   return <Loader2 className="w-3.5 h-3.5 text-accent-indigo animate-spin" />;
    default:          return <Clock className="w-3.5 h-3.5 text-slate-600" />;
  }
}

function DayIcon({ status }: { status: string }) {
  const cls: Record<string, string> = {
    completed: 'bg-risk-green',
    failed: 'bg-risk-red',
    no_data: 'bg-slate-600',
    holiday: 'bg-slate-600',
    pending: 'bg-slate-700',
    weekend: 'bg-slate-800',
  };
  return <div className={cn('w-2.5 h-2.5 rounded-full', cls[status] ?? 'bg-slate-700')} />;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function groupByDate(runs: PipelineRun[]): Map<string, Map<string, PipelineRun[]>> {
  // date → exchange → steps[]
  const map = new Map<string, Map<string, PipelineRun[]>>();
  for (const r of runs) {
    if (!map.has(r.trade_date)) map.set(r.trade_date, new Map());
    const exMap = map.get(r.trade_date)!;
    if (!exMap.has(r.exchange)) exMap.set(r.exchange, []);
    exMap.get(r.exchange)!.push(r);
  }
  return map;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PipelineDashboard({ onBack }: { onBack: () => void }) {
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['pipeline_runs'],
    queryFn: () => fetchPipelineRuns(30),
    staleTime: 30_000,
  });

  const { data: calendar = [], isLoading: calLoading } = useQuery({
    queryKey: ['trading_calendar'],
    queryFn: () => fetchTradingCalendar(30),
    staleTime: 60_000,
  });

  const isLoading = runsLoading || calLoading;

  // Group runs by date + exchange
  const grouped = useMemo(() => groupByDate(runs), [runs]);

  // Sorted unique dates (most recent first)
  const dates = useMemo(() =>
    [...grouped.keys()].sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  // Calendar map for quick lookup
  const calMap = useMemo(() => {
    const m = new Map<string, TradingCalendarDay>();
    for (const c of calendar) m.set(`${c.trade_date}:${c.exchange}`, c);
    return m;
  }, [calendar]);

  // Summary stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRuns = grouped.get(todayStr);

  // Overall counts
  const totalCompleted = calendar.filter(c => c.status === 'completed').length;
  const totalFailed = calendar.filter(c => c.status === 'failed').length;

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
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Data Pipeline</h2>
        <p className="text-sm text-secondary">
          Daily market data sync — NSE, BSE, MCX
        </p>
      </header>

      {/* Today's status card */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent-indigo" />
            <span className="text-sm font-semibold text-white">Today — {fmtDate(todayStr)}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-risk-green">{totalCompleted} completed</span>
            {totalFailed > 0 && <span className="text-risk-red">{totalFailed} failed</span>}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
            <span className="text-xs text-muted">Loading pipeline status...</span>
          </div>
        ) : todayRuns ? (
          <div className="space-y-3">
            {[...todayRuns.entries()].map(([exchange, steps]) => (
              <ExchangeSteps key={exchange} exchange={exchange} steps={steps} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted py-4 text-center">No pipeline runs today</p>
        )}
      </div>

      {/* CLI commands */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-accent-indigo" />
          <span className="text-sm font-semibold text-white">Run Pipeline</span>
        </div>
        <div className="space-y-1.5 text-[11px] mono">
          <p className="text-muted">From <span className="text-slate-400">App/backend/</span> run:</p>
          <p className="text-accent-indigo">python daily_pipeline.py</p>
          <p className="text-accent-indigo">python daily_pipeline.py --exchange ALL --date 2026-04-01</p>
          <p className="text-accent-indigo">python daily_pipeline.py --status</p>
        </div>
      </div>

      {/* History */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Pipeline History (30 days)</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
            <span className="text-xs text-muted">Loading...</span>
          </div>
        ) : dates.length === 0 ? (
          <p className="text-xs text-muted py-8 text-center">No pipeline runs found</p>
        ) : (
          <div className="space-y-1">
            {dates.map(dt => {
              const exMap = grouped.get(dt)!;
              return (
                <div key={dt} className="bg-[#0f172a] border border-kd-border rounded-xl px-4 py-2.5">
                  {/* Date header */}
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] mono text-slate-300 font-medium w-24">
                      {fmtDate(dt)}
                    </span>
                    <span className="text-[10px] text-slate-500 w-8">
                      {new Date(dt + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>

                    {/* Exchange summaries inline */}
                    <div className="flex items-center gap-4 flex-1">
                      {[...exMap.entries()].map(([exchange, steps]) => {
                        const done = steps.filter(s => s.status === 'completed').length;
                        const fail = steps.filter(s => s.status === 'failed').length;
                        const totalRows = steps.reduce((a, s) => a + (s.rows_count || 0), 0);
                        const totalMs = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);
                        const calKey = `${dt}:${exchange}`;
                        const cal = calMap.get(calKey);
                        const dayStatus = cal?.status ?? 'pending';

                        return (
                          <div key={exchange} className="flex items-center gap-2">
                            <DayIcon status={dayStatus} />
                            <span className="text-[11px] text-slate-400 font-medium">{exchange}</span>
                            <span className="text-[10px] text-slate-500 mono">
                              {done}/{steps.length} steps
                            </span>
                            {fail > 0 && (
                              <span className="text-[10px] text-risk-red">{fail} failed</span>
                            )}
                            {totalRows > 0 && (
                              <span className="text-[10px] text-slate-600 mono">
                                {totalRows.toLocaleString('en-IN')} rows
                              </span>
                            )}
                            {totalMs > 0 && (
                              <span className="text-[10px] text-slate-600 mono">
                                {formatDuration(totalMs)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exchange Steps Detail ────────────────────────────────────────────────────

function ExchangeSteps({ exchange, steps }: { exchange: string; steps: PipelineRun[] }) {
  const sortedSteps = [...steps].sort((a, b) => (a.id || 0) - (b.id || 0));
  const totalRows = steps.reduce((a, s) => a + (s.rows_count || 0), 0);
  const totalMs = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white">{exchange}</span>
        <span className="text-[10px] text-slate-500 mono">
          {totalRows.toLocaleString('en-IN')} rows &middot; {formatDuration(totalMs)}
        </span>
      </div>
      <div className="grid gap-1">
        {sortedSteps.map(s => (
          <div key={s.step} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-900/40">
            <StepIcon status={s.status} />
            <span className="text-[11px] text-slate-300 w-20">{s.step}</span>
            <span className="text-[10px] text-slate-500 mono flex-1">
              {s.rows_count ? `${s.rows_count.toLocaleString('en-IN')} rows` : ''}
            </span>
            <span className="text-[10px] text-slate-600 mono w-14 text-right">
              {formatDuration(s.duration_ms)}
            </span>
            {s.error_msg && (
              <span className="text-[10px] text-risk-red truncate max-w-[200px]" title={s.error_msg}>
                {s.error_msg}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
