import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { fetchLastRun } from '@/services/pipeline2';

/**
 * At-a-glance status of the most recent daily_run, pinned to the top of the Data
 * Pipeline page. A single non-critical step failing now downgrades the run to
 * 'partial' (not 'failed'), so this banner — plus the error_msg that leads with
 * the failed step name — is where an admin sees exactly what needs a re-run.
 */
export default function LastRunBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ['pipeline2', 'last-run'],
    queryFn: fetchLastRun,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted px-3 py-2 rounded-lg border border-kd-border/40">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking last run…
      </div>
    );
  }
  if (!data?.exists) return null;

  const status = data.status ?? 'unknown';
  const hasError = !!data.has_error;

  const theme =
    status === 'completed' && !hasError
      ? { color: 'var(--risk-green, #22c55e)', Icon: CheckCircle2 }
      : status === 'failed'
      ? { color: 'var(--risk-red, #ef4444)', Icon: XCircle }
      : { color: 'var(--risk-amber, #f59e0b)', Icon: AlertTriangle };
  const Icon = theme.Icon;

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: `color-mix(in srgb, ${theme.color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${theme.color} 28%, transparent)`,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap" style={{ color: theme.color, fontSize: 12 }}>
        <Icon className="w-4 h-4 shrink-0" />
        <span style={{ fontWeight: 600 }}>Last run: {status}</span>
        {data.trade_date && <span className="text-muted">· {data.trade_date}</span>}
        {data.rows_affected != null && (
          <span className="text-muted">· {data.rows_affected.toLocaleString()} rows</span>
        )}
        {data.completed_at && (
          <span className="text-muted">· {new Date(data.completed_at).toLocaleString()}</span>
        )}
      </div>
      {hasError && data.error_msg && (
        <p className="mt-1 font-mono" style={{ fontSize: 11, color: theme.color, opacity: 0.9, lineHeight: 1.5 }}>
          {data.error_msg}
        </p>
      )}
    </div>
  );
}
