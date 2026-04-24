import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, AlertTriangle, CheckCircle2, Activity, XCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast, ToastContainer } from '@/components/ui';
import {
  runFullDiscovery,
  runMissingDiscovery,
  cancelDiscovery,
  runCleanDiscovery,
  fetchDiscoveryStatus,
  fetchSignalCounts,
  type DiscoveryStatus,
} from './discoveryService';

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCards({ status }: { status: DiscoveryStatus | undefined }) {
  const s = status?.summary;
  const items = [
    {
      label: 'Total Rules',
      value: s ? s.rules_with_signals + s.rules_without_signals : null,
      color: 'text-secondary',
    },
    {
      label: 'With Signals',
      value: s?.rules_with_signals ?? null,
      color: 'text-risk-green',
    },
    {
      label: 'Without Signals',
      value: s?.rules_without_signals ?? null,
      color: s && s.rules_without_signals > 0 ? 'text-risk-amber' : 'text-secondary',
    },
    {
      label: 'Total Signals',
      value: s?.total_signals ?? null,
      color: 'text-accent-indigo',
      fmt: (v: number) => v.toLocaleString(),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, color, fmt }) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl border border-kd-border bg-kd-elevated/40 text-center"
        >
          <span className={cn('text-2xl font-semibold tabular-nums', color)}>
            {value == null ? '—' : (fmt ? fmt(value) : value)}
          </span>
          <span className="text-[11px] text-muted font-mono">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressSection({
  status,
  onCancel,
  cancelling,
}: {
  status: DiscoveryStatus;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const pct =
    status.rules_total > 0
      ? Math.round((status.rules_done / status.rules_total) * 100)
      : 0;

  const isCancelRequested = status.cancel_requested;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-risk-amber">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="font-medium">
            {isCancelRequested ? 'Cancelling…' : 'Discovery running…'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted font-mono text-xs">
            {status.rules_done} / {status.rules_total} rules
          </span>
          <button
            onClick={onCancel}
            disabled={cancelling || isCancelRequested}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-risk-red/40 text-risk-red/80 bg-risk-red/10 hover:bg-risk-red/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <XCircle className="w-3.5 h-3.5" />
            {isCancelRequested ? 'Cancelling' : 'Cancel'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-kd-elevated overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isCancelRequested ? 'bg-risk-red/60' : 'bg-risk-amber',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted font-mono">
        <span>
          {status.current_rule_code
            ? `Processing: ${status.current_rule_code}`
            : 'Starting…'}
        </span>
        <span className="text-accent-indigo">
          {status.signals_inserted.toLocaleString()} signals inserted
        </span>
      </div>
    </div>
  );
}

// ── Last run summary ──────────────────────────────────────────────────────────

function LastRunSummary({ status }: { status: DiscoveryStatus }) {
  if (!status.finished_at) return null;

  const duration =
    status.started_at && status.finished_at
      ? Math.round(
          (new Date(status.finished_at).getTime() -
            new Date(status.started_at).getTime()) / 1000
        )
      : null;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-elevated/30 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="w-4 h-4 text-risk-green/70 shrink-0" />
        <span className="text-secondary font-medium">Last run completed</span>
        {duration != null && (
          <span className="text-muted text-xs font-mono ml-auto">{duration}s</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Rules processed', value: status.rules_done },
          { label: 'Signals inserted', value: status.signals_inserted.toLocaleString() },
          { label: 'Errors', value: status.errors.length },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-sm font-semibold text-secondary tabular-nums">{value}</p>
            <p className="text-[10px] text-muted font-mono">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Error list ────────────────────────────────────────────────────────────────

function ErrorList({ errors }: { errors: DiscoveryStatus['errors'] }) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-mono text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-risk-amber" />
        Errors ({errors.length})
      </p>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-risk-red/20 bg-risk-red/5 divide-y divide-risk-red/10">
        {errors.map((e, i) => (
          <div key={i} className="px-3 py-2 flex items-start gap-2">
            <span className="font-mono text-[11px] text-risk-red/80 shrink-0 mt-0.5">
              {e.rule_code}
            </span>
            <span className="text-[11px] text-muted leading-snug">{e.error}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiscoveryPanel() {
  const { toasts, toast, dismiss } = useToast();
  const qc = useQueryClient();
  const [cleanConfirm, setCleanConfirm] = useState(false);

  // Status — poll every 2s while running
  const { data: status } = useQuery({
    queryKey: ['rule-engine', 'discovery-status'],
    queryFn: fetchDiscoveryStatus,
    staleTime: 0,
    refetchInterval: (query) =>
      (query.state.data as DiscoveryStatus | undefined)?.running ? 2000 : 10_000,
  });

  const isRunning = status?.running ?? false;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['rule-engine', 'discovery-status'] });

  const handleError = (err: Error) => toast('error', err.message);

  const runAllMutation = useMutation({
    mutationFn: runFullDiscovery,
    onSuccess: () => { toast('success', 'Full discovery started'); invalidate(); },
    onError: handleError,
  });

  const runMissingMutation = useMutation({
    mutationFn: runMissingDiscovery,
    onSuccess: () => { toast('success', 'Missing-rules discovery started'); invalidate(); },
    onError: handleError,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelDiscovery,
    onSuccess: () => { toast('success', 'Cancel requested — finishing current rule…'); invalidate(); },
    onError: handleError,
  });

  const cleanMutation = useMutation({
    mutationFn: runCleanDiscovery,
    onSuccess: (data) => {
      toast('success', `Cleared ${data.signals_deleted.toLocaleString()} signals — discovery started`);
      setCleanConfirm(false);
      invalidate();
    },
    onError: (err: Error) => { handleError(err); setCleanConfirm(false); },
  });

  const btnBase =
    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <>
      <div className="space-y-5">
        {/* Summary */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">Signal Coverage</h2>
          <SummaryCards status={status} />
        </section>

        {/* Actions */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">Run Discovery</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => runAllMutation.mutate()}
              disabled={isRunning || runAllMutation.isPending}
              className={cn(
                btnBase,
                'text-accent-indigo border-accent-indigo/30 bg-accent-indigo/10 hover:bg-accent-indigo/20',
              )}
            >
              <Play className="w-4 h-4" />
              Run Full Discovery
            </button>

            <button
              onClick={() => runMissingMutation.mutate()}
              disabled={isRunning || runMissingMutation.isPending}
              className={cn(
                btnBase,
                'text-risk-amber border-risk-amber/30 bg-risk-amber/10 hover:bg-risk-amber/20',
              )}
            >
              <Play className="w-4 h-4" />
              Run Missing Only
            </button>

            {/* Clean & Regenerate — two-step confirm */}
            {!cleanConfirm ? (
              <button
                onClick={() => setCleanConfirm(true)}
                disabled={isRunning}
                className={cn(
                  btnBase,
                  'text-risk-red/80 border-risk-red/30 bg-risk-red/10 hover:bg-risk-red/20',
                )}
              >
                <Trash2 className="w-4 h-4" />
                Clean &amp; Regenerate
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cleanMutation.mutate()}
                  disabled={cleanMutation.isPending}
                  className={cn(
                    btnBase,
                    'text-risk-red border-risk-red/50 bg-risk-red/20 hover:bg-risk-red/30',
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  {cleanMutation.isPending ? 'Clearing…' : 'Drop all signals & run'}
                </button>
                <button
                  onClick={() => setCleanConfirm(false)}
                  className="text-xs text-muted hover:text-secondary px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {cleanConfirm && (
            <p className="text-xs text-risk-red/70 mt-2 font-mono">
              ⚠ This will DELETE all rows in km_rule_signals and re-run full discovery.
            </p>
          )}
        </section>

        {/* Progress (shown while running) */}
        {isRunning && status && (
          <section>
            <ProgressSection
              status={status}
              onCancel={() => cancelMutation.mutate()}
              cancelling={cancelMutation.isPending}
            />
          </section>
        )}

        {/* Last run summary (shown when not running and a job has completed) */}
        {!isRunning && status && status.finished_at && (
          <section>
            <LastRunSummary status={status} />
          </section>
        )}

        {/* Errors */}
        {status && status.errors.length > 0 && (
          <section>
            <ErrorList errors={status.errors} />
          </section>
        )}

        {/* Help text when idle and no prior job */}
        {!isRunning && !status?.finished_at && (
          <div className="rounded-xl border border-kd-border bg-kd-elevated/20 px-4 py-6 text-center text-muted text-sm">
            <p>No discovery job has run in this session.</p>
            <p className="text-xs mt-1 text-muted/70">
              "Run Missing Only" is faster — skips rules that already have signals.
            </p>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
