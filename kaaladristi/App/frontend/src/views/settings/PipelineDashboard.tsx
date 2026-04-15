import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, MinusCircle,
  Loader2, Calendar, Activity, Wifi, WifiOff, Play, RefreshCw,
  ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/dateUtils';
import DataHealthGrid from '@/components/domain/DataHealthGrid';
import PipelineExecution from '@/components/domain/PipelineExecution';
import {
  fetchPipelineHealth, fetchPipelineStatus, fetchBreezeStatus,
  fetchSchedulerStatus, fetchDownloadTypes,
  triggerPipelineRun, triggerBackfill, connectBreeze, triggerStepRerun,
  type PipelineHealth, type PipelineStatus, type BreezeStatus,
  type SchedulerStatus, type DownloadType, type PipelineRun,
} from '@/services/pipelineData';
import { useToast, ToastContainer } from '@/components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-risk-green" />;
    case 'failed':    return <XCircle className="w-3.5 h-3.5 text-risk-red" />;
    case 'skipped':   return <MinusCircle className="w-3.5 h-3.5 text-muted" />;
    case 'running':   return <Loader2 className="w-3.5 h-3.5 text-accent-indigo animate-spin" />;
    default:          return <Clock className="w-3.5 h-3.5 text-muted" />;
  }
}

function StatusDot({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ok: 'bg-risk-green', connected: 'bg-risk-green', completed: 'bg-risk-green', active: 'bg-risk-green',
    error: 'bg-risk-red', failed: 'bg-risk-red', expired: 'bg-risk-amber', breeze_expired: 'bg-risk-amber',
    disconnected: 'bg-[var(--text-muted)]', unknown: 'bg-[var(--text-muted)]', pending: 'bg-[var(--text-muted)]',
  };
  return <div className={cn('w-2 h-2 rounded-full shrink-0', cls[status] ?? 'bg-[var(--text-muted)]')} />;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PipelineDashboard({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const { toasts, toast, dismiss } = useToast();

  const { data: health } = useQuery({ queryKey: ['pipeline_health'], queryFn: fetchPipelineHealth, staleTime: 15_000, retry: 1 });
  const { data: status, isLoading } = useQuery({ queryKey: ['pipeline_status'], queryFn: fetchPipelineStatus, staleTime: 10_000, refetchInterval: 10_000, retry: 1 });
  const { data: breeze } = useQuery({ queryKey: ['breeze_status'], queryFn: fetchBreezeStatus, staleTime: 30_000, retry: 1 });
  const { data: sched } = useQuery({ queryKey: ['scheduler_status'], queryFn: fetchSchedulerStatus, staleTime: 60_000, retry: 1 });
  const { data: downloads } = useQuery({ queryKey: ['download_types'], queryFn: fetchDownloadTypes, staleTime: 60_000, retry: 1 });

  const [forceRun, setForceRun] = useState(false);
  const [runningSource, setRunningSource] = useState<string | null>(null);

  const runMutation = useMutation({
    mutationFn: ({ date, exchange, force }: { date?: string; exchange: string; force?: boolean }) =>
      triggerPipelineRun(date, exchange, force ?? false),
    onSuccess: (data) => {
      toast('success', data.message);
      setForceRun(false);
      setRunningSource(null);
      qc.invalidateQueries({ queryKey: ['pipeline_status'] });
      qc.invalidateQueries({ queryKey: ['download_types'] });
    },
    onError: (err: Error) => {
      toast('error', err.message);
      setRunningSource(null);
    },
  });

  const [showBackfill, setShowBackfill] = useState(false);
  const [bfFrom, setBfFrom] = useState('');
  const [bfTo, setBfTo] = useState('');
  const [bfExchange, setBfExchange] = useState('ALL');

  const backfillMutation = useMutation({
    mutationFn: () => triggerBackfill(bfFrom, bfTo, bfExchange),
    onSuccess: (data) => { toast('success', data.message); setShowBackfill(false); qc.invalidateQueries({ queryKey: ['pipeline_status'] }); },
    onError: (err: Error) => toast('error', err.message),
  });

  const RERUNNABLE_STEPS = new Set(['indicators', 'index_indicators', 'magic_rs', 'flow_intelligence', 'industry_composites', 'market_breadth', 'breadth_roc']);

  const stepRerunMutation = useMutation({
    mutationFn: ({ step, exchange }: { step: string; exchange: string }) =>
      triggerStepRerun(status?.today ?? new Date().toISOString().split('T')[0], step, exchange),
    onSuccess: (data) => {
      toast('success', data.message);
      qc.invalidateQueries({ queryKey: ['pipeline_status'] });
    },
    onError: (err: Error) => toast('error', err.message),
  });

  const [showBreeze, setShowBreeze] = useState(false);
  const [breezeToken, setBreezeToken] = useState('');

  const breezeMutation = useMutation({
    mutationFn: () => connectBreeze(breezeToken),
    onSuccess: () => { toast('success', 'Breeze connected'); setBreezeToken(''); setShowBreeze(false); qc.invalidateQueries({ queryKey: ['breeze_status'] }); },
    onError: (err: Error) => toast('error', err.message),
  });

  // Group today's steps by exchange
  const todayByExchange = useMemo(() => {
    const map = new Map<string, PipelineRun[]>();
    for (const s of (status?.today_steps ?? [])) {
      if (!map.has(s.exchange)) map.set(s.exchange, []);
      map.get(s.exchange)!.push(s);
    }
    return map;
  }, [status?.today_steps]);

  // Group history by date
  const historyByDate = useMemo(() => {
    const map = new Map<string, Map<string, PipelineRun[]>>();
    for (const r of (status?.recent_runs ?? [])) {
      if (!map.has(r.trade_date)) map.set(r.trade_date, new Map());
      const exMap = map.get(r.trade_date)!;
      if (!exMap.has(r.exchange)) exMap.set(r.exchange, []);
      exMap.get(r.exchange)!.push(r);
    }
    return map;
  }, [status?.recent_runs]);

  const historyDates = useMemo(() => [...historyByDate.keys()].sort((a, b) => b.localeCompare(a)), [historyByDate]);

  const isRunning = runMutation.isPending || (health?.active_jobs ?? 0) > 0;

  const inputCls = 'px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-accent-indigo/60 transition-colors';
  const selectCls = 'px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-secondary)] focus:outline-none focus:border-accent-indigo/60 transition-colors';

  const apiDown = !health;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted hover:text-[var(--text-primary)] mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-1">Data Pipeline</h2>
        <p className="text-sm text-secondary">Daily market data sync — NSE, BSE, MCX</p>
      </header>

      {/* API Down Warning */}
      {apiDown && (
        <div className="bg-risk-amber/10 border border-risk-amber/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <WifiOff className="w-4 h-4 text-risk-amber shrink-0" />
          <div>
            <p className="text-xs text-risk-amber font-semibold">Pipeline API not reachable</p>
            <p className="text-[10px] text-muted mt-0.5">Run: <span className="mono text-[var(--text-secondary)]">uvicorn pipeline_api:app --host 0.0.0.0 --port 8100</span></p>
          </div>
        </div>
      )}

      {/* ── Data Health Heatmap ── */}
      <DataHealthGrid />

      {/* ── Live Pipeline Execution ── */}
      <PipelineExecution />

      {/* ── Health + Downloads ── */}
      <div className="glass-card rounded-2xl p-5 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Data Sources</h3>
        <div className="grid gap-1">
          {(downloads ?? []).map(dl => {
            const isSourceRunning = runningSource === dl.type;
            const canRun = !!dl.run_exchange && !apiDown && dl.status !== 'breeze_expired';
            return (
              <div key={dl.type} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-kd-elevated/40 group">
                <StatusDot status={dl.status} />
                <span className="text-[12px] text-[var(--text-primary)] font-medium flex-1">{dl.label}</span>
                <span className="text-[10px] text-muted mono">
                  {dl.last_sync ? fmtDate(dl.last_sync) : 'Never synced'}
                </span>
                {dl.gap_days > 0 && (
                  <span className="text-[10px] text-risk-amber">{dl.gap_days}d behind</span>
                )}
                {dl.status === 'breeze_expired' && (
                  <button onClick={() => setShowBreeze(true)} className="text-[10px] text-accent-indigo hover:underline">
                    Connect
                  </button>
                )}
                {canRun && (
                  <button
                    onClick={() => {
                      setRunningSource(dl.type);
                      runMutation.mutate({ exchange: dl.run_exchange!, force: true });
                    }}
                    disabled={isRunning}
                    title={`Re-run ${dl.label}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-kd-elevated border border-kd-border rounded-lg text-[10px] text-muted hover:text-accent-indigo hover:border-accent-indigo/40 hover:bg-kd-elevated disabled:opacity-30 transition-all"
                  >
                    {isSourceRunning
                      ? <Loader2 className="w-2.5 h-2.5 animate-spin text-accent-indigo" />
                      : <Play className="w-2.5 h-2.5" />
                    }
                    {isSourceRunning ? 'Running...' : 'Run'}
                  </button>
                )}
              </div>
            );
          })}
          {!downloads && !apiDown && (
            <p className="text-xs text-muted py-2">Loading...</p>
          )}
        </div>
      </div>

      {/* ── Breeze Connect ── */}
      {showBreeze && (
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Breeze Connection</h3>
            <button onClick={() => setShowBreeze(false)} className="text-xs text-muted hover:text-[var(--text-primary)]">Close</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <StatusDot status={breeze?.status ?? 'unknown'} />
            <span className="text-[12px] text-[var(--text-secondary)]">
              {breeze?.status === 'connected' ? `Connected (expires ${fmtDateTime(breeze.expires_at)})` : breeze?.status ?? 'Unknown'}
            </span>
          </div>
          {breeze?.last_error && <p className="text-[10px] text-risk-red mb-3">{breeze.last_error}</p>}
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-muted mb-1">Step 1: Login via browser</p>
              <a href={breeze?.login_url ?? '#'} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent-indigo hover:underline">
                Open Breeze Login <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div>
              <p className="text-[11px] text-muted mb-1">Step 2: Paste session token from redirect URL</p>
              <div className="flex gap-2">
                <input type="text" value={breezeToken} onChange={e => setBreezeToken(e.target.value)}
                  placeholder="Session token..." className={cn(inputCls, 'flex-1')} />
                <button onClick={() => breezeMutation.mutate()} disabled={!breezeToken || breezeMutation.isPending}
                  className="px-4 py-2 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-xs font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-40 transition-all">
                  {breezeMutation.isPending ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Scheduler + Actions ── */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Scheduler card */}
        <div className="glass-card rounded-2xl p-4 flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-accent-indigo" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Scheduler</span>
          </div>
          {sched ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusDot status={sched.active ? 'active' : 'error'} />
                <span className="text-[11px] text-[var(--text-secondary)]">{sched.active ? 'Active' : 'Stopped'}</span>
              </div>
              <p className="text-[10px] text-muted">{sched.trigger}</p>
              {sched.next_run && (
                <p className="text-[10px] text-[var(--text-secondary)]">Next: {fmtDateTime(sched.next_run)}</p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-muted">{apiDown ? 'API offline' : 'Loading...'}</p>
          )}
        </div>

        {/* Actions card */}
        <div className="glass-card rounded-2xl p-4 flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-3.5 h-3.5 text-accent-indigo" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runMutation.mutate({ exchange: 'ALL', force: forceRun })}
              disabled={isRunning || apiDown}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40',
                forceRun
                  ? 'bg-risk-amber/20 border border-risk-amber/40 text-risk-amber hover:bg-risk-amber/30'
                  : 'bg-accent-indigo/20 border border-accent-indigo/40 text-accent-indigo hover:bg-accent-indigo/30',
              )}
            >
              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {isRunning ? 'Running...' : forceRun ? 'Force Run' : 'Run Now'}
            </button>
            <button
              onClick={() => setShowBackfill(!showBackfill)}
              disabled={apiDown}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:border-accent-indigo/30 disabled:opacity-40 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Backfill
            </button>
            {!showBreeze && (
              <button
                onClick={() => setShowBreeze(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:border-accent-indigo/30 transition-all"
              >
                <Wifi className="w-3 h-3" /> Breeze
              </button>
            )}
          </div>
          {/* Force re-run toggle */}
          <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
            <div
              onClick={() => setForceRun(v => !v)}
              className={cn(
                'w-8 h-4 rounded-full transition-colors relative',
                forceRun ? 'bg-risk-amber/60' : 'bg-[var(--text-muted)]/40',
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-3 h-3 rounded-full transition-transform bg-kd-surface border border-kd-border',
                forceRun ? 'translate-x-4' : 'translate-x-0.5',
              )} />
            </div>
            <span className="text-[10px] text-muted">
              Force re-run{forceRun && <span className="text-risk-amber ml-1">(will reset today's completed steps)</span>}
            </span>
          </label>
        </div>
      </div>

      {/* ── Backfill Panel ── */}
      {showBackfill && (
        <div className="glass-card rounded-2xl p-5 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Backfill Missing Data</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] text-muted mb-1">From</label>
              <input type="date" value={bfFrom} onChange={e => setBfFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">To</label>
              <input type="date" value={bfTo} onChange={e => setBfTo(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Exchange</label>
              <select value={bfExchange} onChange={e => setBfExchange(e.target.value)} className={selectCls}>
                <option value="ALL">All</option>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>
            <button
              onClick={() => backfillMutation.mutate()}
              disabled={!bfFrom || !bfTo || backfillMutation.isPending}
              className="px-4 py-2 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-xs font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-40 transition-all"
            >
              {backfillMutation.isPending ? 'Starting...' : 'Start Backfill'}
            </button>
            <button onClick={() => setShowBackfill(false)} className="text-xs text-muted hover:text-[var(--text-primary)] px-2 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Today's Progress — NSE | BSE Matrix ── */}
      {todayByExchange.size > 0 && (() => {
        // Build unified step list across exchanges
        const allSteps = new Map<string, { nse?: PipelineRun; bse?: PipelineRun }>();
        for (const [exchange, steps] of todayByExchange.entries()) {
          for (const s of steps) {
            if (!allSteps.has(s.step)) allSteps.set(s.step, {});
            const entry = allSteps.get(s.step)!;
            if (exchange === 'NSE') entry.nse = s;
            else if (exchange === 'BSE') entry.bse = s;
            else entry.nse = s; // N/A steps go to NSE column
          }
        }
        const stepOrder = (r: PipelineRun | undefined) => r?.id ?? 999;
        const sortedSteps = [...allSteps.entries()].sort((a, b) =>
          stepOrder(a[1].nse ?? a[1].bse) - stepOrder(b[1].nse ?? b[1].bse)
        );
        const hasNse = todayByExchange.has('NSE') || todayByExchange.has('N/A');
        const hasBse = todayByExchange.has('BSE');

        const CoverageCell = ({ run }: { run?: PipelineRun }) => {
          if (!run) return <span className="text-[10px] text-muted">—</span>;
          const rows = run.rows_count || 0;
          const cov = (run as any).coverage_pct as number | null;
          const expected = (run as any).rows_expected as number | null;
          return (
            <div className="flex items-center gap-1.5">
              <StepIcon status={run.status} />
              <span className="text-[10px] mono text-[var(--text-secondary)]">
                {rows.toLocaleString('en-IN')}
                {expected ? `/${expected.toLocaleString('en-IN')}` : ''}
              </span>
              {cov != null && (
                <span className={cn(
                  'text-[9px] font-bold',
                  cov >= 90 ? 'text-risk-green' : cov >= 70 ? 'text-risk-amber' : 'text-risk-red',
                )}>
                  ({cov.toFixed(0)}%)
                </span>
              )}
              {run.status === 'failed' && run.error_msg && (
                <span className="text-[9px] text-risk-red truncate max-w-[100px]" title={run.error_msg}>
                  {run.error_msg.slice(0, 30)}
                </span>
              )}
            </div>
          );
        };

        return (
          <div className="glass-card rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-3.5 h-3.5 text-accent-indigo" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Today — {fmtDate(status?.today ?? '')}</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-kd-border">
                  <th className="text-left py-2 px-2 text-[10px] font-bold text-muted uppercase tracking-wider w-40">Step</th>
                  {hasNse && <th className="text-left py-2 px-2 text-[10px] font-bold text-muted uppercase tracking-wider">NSE</th>}
                  {hasBse && <th className="text-left py-2 px-2 text-[10px] font-bold text-muted uppercase tracking-wider">BSE</th>}
                  <th className="text-right py-2 px-2 text-[10px] font-bold text-muted uppercase tracking-wider w-12">Time</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sortedSteps.map(([step, { nse, bse }]) => {
                  const primary = nse ?? bse;
                  return (
                    <tr key={step} className="border-b border-kd-border/30 hover:bg-kd-elevated/20 group/step">
                      <td className="py-1.5 px-2 text-[var(--text-secondary)] font-medium">{step}</td>
                      {hasNse && <td className="py-1.5 px-2"><CoverageCell run={nse} /></td>}
                      {hasBse && <td className="py-1.5 px-2"><CoverageCell run={bse} /></td>}
                      <td className="py-1.5 px-2 text-right text-[10px] text-muted mono">
                        {fmtDuration(primary?.duration_ms ?? null)}
                      </td>
                      <td className="py-1.5 px-1">
                        {RERUNNABLE_STEPS.has(step) && (
                          <button
                            onClick={() => stepRerunMutation.mutate({ step, exchange: nse ? 'NSE' : 'BSE' })}
                            disabled={stepRerunMutation.isPending}
                            className="opacity-0 group-hover/step:opacity-100 p-0.5 rounded text-muted hover:text-accent-indigo transition-all"
                            title={`Re-run ${step}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-kd-border/30 text-[9px] text-muted">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-risk-green" /> Healthy</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-risk-amber" /> Warning</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-risk-red" /> Failed</span>
            </div>
          </div>
        );
      })()}

      {/* ── History ── */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">History (14 days)</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
            <span className="text-xs text-muted">Loading...</span>
          </div>
        ) : historyDates.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">No pipeline runs found</p>
        ) : (
          <div className="space-y-1">
            {historyDates.map(dt => {
              const exMap = historyByDate.get(dt)!;
              return (
                <div key={dt} className="bg-kd-surface border border-kd-border rounded-xl px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] mono text-[var(--text-secondary)] font-medium w-20">{fmtDate(dt)}</span>
                    <span className="text-[10px] text-muted w-6">
                      {new Date(dt + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <div className="flex items-center gap-4 flex-1">
                      {[...exMap.entries()].map(([exchange, steps]) => {
                        const done = steps.filter(s => s.status === 'completed').length;
                        const fail = steps.filter(s => s.status === 'failed').length;
                        const totalRows = steps.reduce((a, s) => a + (s.rows_count || 0), 0);
                        return (
                          <div key={exchange} className="flex items-center gap-1.5">
                            <StatusDot status={fail > 0 ? 'failed' : done === steps.length ? 'completed' : 'pending'} />
                            <span className="text-[10px] text-[var(--text-secondary)]">{exchange}</span>
                            <span className="text-[10px] text-muted mono">{done}/{steps.length}</span>
                            {fail > 0 && <span className="text-[10px] text-risk-red">{fail}✗</span>}
                            <span className="text-[10px] text-muted mono">{totalRows > 0 ? `${totalRows.toLocaleString('en-IN')}r` : ''}</span>
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

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
