import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Activity, WifiOff, X, ChevronDown, ChevronUp, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchDiscoveryStatus, cancelDiscovery } from '@/pages/RuleEngine/discoveryService';
import { useBackendStatus } from '@/hooks';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101');

interface ConfidenceState {
  running: boolean;
  started_at: string | null;
  finished_at: string | null;
  signals_scored: number;
  rules_upserted: number;
  error: string | null;
}

async function fetchConfidenceStatus(): Promise<ConfidenceState> {
  const res = await fetch(`${PIPELINE_API}/api/confidence/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function elapsed(startedAt: string | null): string {
  if (!startedAt) return '';
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full h-1 bg-kd-border rounded-full overflow-hidden">
      <div
        className="h-full bg-risk-amber rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function JobMonitor() {
  const backendStatus = useBackendStatus();
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second to update elapsed time display
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const { data: discovery } = useQuery({
    queryKey: ['job-monitor', 'discovery'],
    queryFn: fetchDiscoveryStatus,
    refetchInterval: 2000,
    retry: 1,
    staleTime: 0,
  });

  const { data: confidence } = useQuery({
    queryKey: ['job-monitor', 'confidence'],
    queryFn: fetchConfidenceStatus,
    refetchInterval: 3000,
    retry: 1,
    staleTime: 0,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelDiscovery,
  });

  const discoveryRunning = discovery?.running ?? false;
  const confidenceRunning = confidence?.running ?? false;
  const anyRunning = discoveryRunning || confidenceRunning;
  const isOffline = backendStatus === 'offline';

  // Auto-expand when a job starts
  useEffect(() => {
    if (anyRunning) setExpanded(true);
  }, [anyRunning]);

  // Nothing to show when online and idle
  if (!isOffline && !anyRunning && !expanded) return null;

  const pill = isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-risk-red/15 border border-risk-red/30 text-risk-red/80 text-xs font-medium cursor-pointer"
      onClick={() => setExpanded(v => !v)}>
      <WifiOff className="w-3.5 h-3.5" />
      Backend offline
    </div>
  ) : anyRunning ? (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-risk-amber/15 border border-risk-amber/30 text-risk-amber text-xs font-medium cursor-pointer animate-pulse"
      onClick={() => setExpanded(v => !v)}>
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {discoveryRunning
        ? `Discovery · ${discovery!.rules_done}/${discovery!.rules_total} rules`
        : `Confidence scoring · ${confidence!.signals_scored} scored`}
      {expanded ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />}
    </div>
  ) : (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-kd-elevated border border-kd-border text-muted text-xs cursor-pointer"
      onClick={() => setExpanded(v => !v)}>
      <Activity className="w-3.5 h-3.5" />
      System idle
      <X className="w-3 h-3 ml-1" onClick={e => { e.stopPropagation(); setExpanded(false); }} />
    </div>
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {expanded && (
        <div className="w-80 rounded-xl border border-kd-border bg-kd-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-kd-border/60 bg-kd-elevated/60">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-muted" />
              <span className="text-xs font-medium text-secondary">System Monitor</span>
            </div>
            <button onClick={() => setExpanded(false)} className="text-muted hover:text-secondary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Backend status */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Backend</span>
              {isOffline ? (
                <span className="flex items-center gap-1.5 text-xs text-risk-red/80">
                  <span className="w-2 h-2 rounded-full bg-risk-red animate-pulse" />
                  Offline
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-risk-green/70">
                  <span className="w-2 h-2 rounded-full bg-risk-green/70" />
                  Online
                </span>
              )}
            </div>

            {/* Discovery job */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Discovery</span>
                {discoveryRunning ? (
                  <span className="flex items-center gap-1 text-[11px] text-risk-amber">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running · {elapsed(discovery?.started_at ?? null)}
                  </span>
                ) : discovery?.finished_at ? (
                  <span className={cn('flex items-center gap-1 text-[11px]',
                    (discovery.errors?.length ?? 0) > 0 ? 'text-risk-red/70' : 'text-risk-green/70')}>
                    {(discovery.errors?.length ?? 0) > 0
                      ? <XCircle className="w-3 h-3" />
                      : <CheckCircle className="w-3 h-3" />}
                    Done
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Idle</span>
                )}
              </div>

              {discoveryRunning && discovery && (
                <>
                  <ProgressBar done={discovery.rules_done} total={discovery.rules_total} />
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted">Rules</p>
                      <p className="text-secondary font-mono">{discovery.rules_done} / {discovery.rules_total}</p>
                    </div>
                    <div>
                      <p className="text-muted">Signals inserted</p>
                      <p className="text-secondary font-mono">{discovery.signals_inserted.toLocaleString()}</p>
                    </div>
                    {discovery.current_rule_code && (
                      <div className="col-span-2">
                        <p className="text-muted">Current rule</p>
                        <p className="text-accent-indigo/80 font-mono truncate">{discovery.current_rule_code}</p>
                      </div>
                    )}
                  </div>
                  {!cancelMutation.isPending && !discovery.cancel_requested && (
                    <button
                      onClick={() => cancelMutation.mutate()}
                      className="w-full mt-1 px-3 py-1.5 text-xs text-risk-red/70 border border-risk-red/30 bg-risk-red/10 rounded-lg hover:bg-risk-red/20 transition-all"
                    >
                      Cancel Discovery
                    </button>
                  )}
                  {(cancelMutation.isPending || discovery.cancel_requested) && (
                    <p className="text-[11px] text-risk-amber text-center">Cancel requested — finishing current rule…</p>
                  )}
                </>
              )}

              {!discoveryRunning && discovery?.finished_at && (
                <div className="text-[11px] text-muted space-y-0.5">
                  <p>{discovery.signals_inserted.toLocaleString()} signals inserted · {discovery.rules_done} rules</p>
                  {(discovery.errors?.length ?? 0) > 0 && (
                    <p className="text-risk-red/70">{discovery.errors.length} error(s)</p>
                  )}
                  <p>Finished {new Date(discovery.finished_at).toLocaleTimeString()}</p>
                </div>
              )}
            </div>

            {/* Confidence job */}
            <div className="space-y-2 pt-3 border-t border-kd-border/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Confidence</span>
                {confidenceRunning ? (
                  <span className="flex items-center gap-1 text-[11px] text-risk-amber">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running · {elapsed(confidence?.started_at ?? null)}
                  </span>
                ) : confidence?.finished_at ? (
                  <span className={cn('flex items-center gap-1 text-[11px]',
                    confidence.error ? 'text-risk-red/70' : 'text-risk-green/70')}>
                    {confidence.error
                      ? <XCircle className="w-3 h-3" />
                      : <CheckCircle className="w-3 h-3" />}
                    Done
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Idle</span>
                )}
              </div>

              {confidenceRunning && confidence && (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted">Signals scored</p>
                    <p className="text-secondary font-mono">{confidence.signals_scored.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted">Rules updated</p>
                    <p className="text-secondary font-mono">{confidence.rules_upserted}</p>
                  </div>
                </div>
              )}

              {!confidenceRunning && confidence?.finished_at && !confidence.error && (
                <p className="text-[11px] text-muted">
                  {confidence.signals_scored.toLocaleString()} signals scored · {confidence.rules_upserted} rules updated
                </p>
              )}

              {confidence?.error && (
                <p className="text-[11px] text-risk-red/70 truncate" title={confidence.error}>{confidence.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {pill}
    </div>
  );
}
