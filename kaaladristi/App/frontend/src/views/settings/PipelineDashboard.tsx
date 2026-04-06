import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, MinusCircle,
  Loader2, Calendar, Activity, Wifi, WifiOff, Play, RefreshCw,
  ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/dateUtils';
import {
  fetchPipelineHealth, fetchPipelineStatus, fetchBreezeStatus,
  fetchSchedulerStatus, fetchDownloadTypes,
  triggerPipelineRun, triggerBackfill, connectBreeze,
  type PipelineHealth, type PipelineStatus, type BreezeStatus,
  type SchedulerStatus, type DownloadType, type PipelineRun,
} from '@/services/pipelineData';
import { useToast, ToastContainer } from '@/components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-risk-green" />;
    case 'failed':    return <XCircle className="w-3.5 h-3.5 text-risk-red" />;
    case 'skipped':   return <MinusCircle className="w-3.5 h-3.5 text-slate-500" />;
    case 'running':   return <Loader2 className="w-3.5 h-3.5 text-accent-indigo animate-spin" />;
    default:          return <Clock className="w-3.5 h-3.5 text-slate-600" />;
  }
}

function StatusDot({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ok: 'bg-risk-green', connected: 'bg-risk-green', completed: 'bg-risk-green', active: 'bg-risk-green',
    error: 'bg-risk-red', failed: 'bg-risk-red', expired: 'bg-risk-amber', breeze_expired: 'bg-risk-amber',
    disconnected: 'bg-slate-600', unknown: 'bg-slate-600', pending: 'bg-slate-700',
  };
  return <div className={cn('w-2 h-2 rounded-full shrink-0', cls[status] ?? 'bg-slate-600')} />;
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

  const runMutation = useMutation({
    mutationFn: ({ date, exchange }: { date?: string; exchange: string }) => triggerPipelineRun(date, exchange),
    onSuccess: (data) => { toast('success', data.message); qc.invalidateQueries({ queryKey: ['pipeline_status'] }); },
    onError: (err: Error) => toast('error', err.message),
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

  const inputCls = 'px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-white focus:outline-none focus:border-accent-indigo/60 transition-colors';
  const selectCls = 'px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 focus:outline-none focus:border-accent-indigo/60 transition-colors';

  const apiDown = !health;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Data Pipeline</h2>
        <p className="text-sm text-secondary">Daily market data sync — NSE, BSE, MCX</p>
      </header>

      {/* API Down Warning */}
      {apiDown && (
        <div className="bg-risk-amber/10 border border-risk-amber/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <WifiOff className="w-4 h-4 text-risk-amber shrink-0" />
          <div>
            <p className="text-xs text-risk-amber font-semibold">Pipeline API not reachable</p>
            <p className="text-[10px] text-muted mt-0.5">Run: <span className="mono text-slate-400">uvicorn pipeline_api:app --host 0.0.0.0 --port 8100</span></p>
          </div>
        </div>
      )}

      {/* ── Health + Downloads ── */}
      <div className="glass-card rounded-2xl p-5 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Data Sources</h3>
        <div className="grid gap-2">
          {(downloads ?? []).map(dl => (
            <div key={dl.type} className="flex items-center gap-3 py-1.5">
              <StatusDot status={dl.status} />
              <span className="text-[12px] text-white font-medium flex-1">{dl.label}</span>
              <span className="text-[10px] text-slate-500 mono">
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
            </div>
          ))}
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
            <button onClick={() => setShowBreeze(false)} className="text-xs text-slate-500 hover:text-white">Close</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <StatusDot status={breeze?.status ?? 'unknown'} />
            <span className="text-[12px] text-slate-300">
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
            <span className="text-xs font-bold text-white">Scheduler</span>
          </div>
          {sched ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusDot status={sched.active ? 'active' : 'error'} />
                <span className="text-[11px] text-slate-300">{sched.active ? 'Active' : 'Stopped'}</span>
              </div>
              <p className="text-[10px] text-muted">{sched.trigger}</p>
              {sched.next_run && (
                <p className="text-[10px] text-slate-400">Next: {fmtDateTime(sched.next_run)}</p>
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
            <span className="text-xs font-bold text-white">Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runMutation.mutate({ exchange: 'ALL' })}
              disabled={isRunning || apiDown}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-xs font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-40 transition-all"
            >
              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {isRunning ? 'Running...' : 'Run Now'}
            </button>
            <button
              onClick={() => setShowBackfill(!showBackfill)}
              disabled={apiDown}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs font-medium text-slate-300 hover:border-white/20 disabled:opacity-40 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Backfill
            </button>
            {!showBreeze && (
              <button
                onClick={() => setShowBreeze(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs font-medium text-slate-300 hover:border-white/20 transition-all"
              >
                <Wifi className="w-3 h-3" /> Breeze
              </button>
            )}
          </div>
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
            <button onClick={() => setShowBackfill(false)} className="text-xs text-slate-500 hover:text-white px-2 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Today's Progress ── */}
      {todayByExchange.size > 0 && (
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-3.5 h-3.5 text-accent-indigo" />
            <span className="text-xs font-bold text-white">Today — {fmtDate(status?.today ?? '')}</span>
          </div>
          <div className="space-y-4">
            {[...todayByExchange.entries()].map(([exchange, steps]) => {
              const sorted = [...steps].sort((a, b) => (a.id || 0) - (b.id || 0));
              const totalRows = steps.reduce((a, s) => a + (s.rows_count || 0), 0);
              const totalMs = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);
              return (
                <div key={exchange}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-white">{exchange}</span>
                    <span className="text-[10px] text-slate-500 mono">
                      {totalRows.toLocaleString('en-IN')} rows &middot; {fmtDuration(totalMs)}
                    </span>
                  </div>
                  <div className="grid gap-0.5">
                    {sorted.map(s => (
                      <div key={s.step} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-900/40">
                        <StepIcon status={s.status} />
                        <span className="text-[11px] text-slate-300 w-20">{s.step}</span>
                        <span className="text-[10px] text-slate-500 mono flex-1">
                          {s.rows_count ? `${s.rows_count.toLocaleString('en-IN')} rows` : ''}
                        </span>
                        <span className="text-[10px] text-slate-600 mono w-12 text-right">{fmtDuration(s.duration_ms)}</span>
                        {s.error_msg && (
                          <span className="text-[10px] text-risk-red truncate max-w-[180px]" title={s.error_msg}>{s.error_msg}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                <div key={dt} className="bg-[#0f172a] border border-kd-border rounded-xl px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] mono text-slate-300 font-medium w-20">{fmtDate(dt)}</span>
                    <span className="text-[10px] text-slate-500 w-6">
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
                            <span className="text-[10px] text-slate-400">{exchange}</span>
                            <span className="text-[10px] text-slate-500 mono">{done}/{steps.length}</span>
                            {fail > 0 && <span className="text-[10px] text-risk-red">{fail}✗</span>}
                            <span className="text-[10px] text-slate-600 mono">{totalRows > 0 ? `${totalRows.toLocaleString('en-IN')}r` : ''}</span>
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
