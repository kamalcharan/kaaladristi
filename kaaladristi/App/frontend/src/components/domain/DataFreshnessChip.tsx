/**
 * DataFreshnessChip — Global data freshness indicator
 * =====================================================
 * Shows in the top nav bar. Four states:
 *   ● green  — "Data as on: 15 Apr 2026"
 *   ⏳ amber — "Data as on: 15 Apr · Today processing"
 *   ⚠ amber  — "Data as on: 14 Apr · 1 day delayed"
 *   ✗ red    — "Data as on: 8 Apr · Stale (7 days)"
 *
 * Tap → navigates to Settings (Pipeline page).
 */

import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePipelineStatus, type PipelineStatusLevel } from '@/hooks/usePipelineStatus';

const STATUS_CONFIG: Record<PipelineStatusLevel, {
  dotColor: string;
  textColor: string;
  suffix: (daysOld: number) => string;
}> = {
  current: {
    dotColor: 'bg-risk-green',
    textColor: 'text-risk-green',
    suffix: () => '',
  },
  pending: {
    dotColor: 'bg-risk-amber',
    textColor: 'text-risk-amber',
    suffix: () => 'Today processing',
  },
  delayed: {
    dotColor: 'bg-risk-amber',
    textColor: 'text-risk-amber',
    suffix: (d) => `${d} day${d > 1 ? 's' : ''} delayed`,
  },
  stale: {
    dotColor: 'bg-risk-red',
    textColor: 'text-risk-red',
    suffix: (d) => `Stale (${d}d)`,
  },
};

export default function DataFreshnessChip() {
  const navigate = useNavigate();
  const pipeline = usePipelineStatus();

  if (pipeline.isLoading || !pipeline.latestDataDate) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" />
        <span className="text-[10px] text-muted font-mono hidden sm:inline">Loading...</span>
      </div>
    );
  }

  const config = STATUS_CONFIG[pipeline.status];
  const suffix = config.suffix(pipeline.daysOld);

  // Short date for mobile: "15 Apr", full for desktop: "15 Apr 2026"
  const [y, m, d] = pipeline.latestDataDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = `${parseInt(d)} ${months[parseInt(m) - 1]}`;
  const fullDate = `${shortDate} ${y}`;

  return (
    <button
      onClick={() => navigate('/settings')}
      title="Last successful pipeline run. Click for details."
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-kd-elevated/40 transition-colors group shrink-0"
    >
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dotColor)} />
      <span className="text-[10px] font-mono text-muted group-hover:text-secondary transition-colors">
        <span className="hidden sm:inline">Data as on: {fullDate}</span>
        <span className="sm:hidden">{shortDate}</span>
      </span>
      {suffix && (
        <span className={cn('text-[9px] font-mono font-bold hidden sm:inline', config.textColor)}>
          · {suffix}
        </span>
      )}
    </button>
  );
}
