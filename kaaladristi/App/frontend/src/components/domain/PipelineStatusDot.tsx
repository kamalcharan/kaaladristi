import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface CoverageSummary {
  trade_date: string;
  overall: 'healthy' | 'warning' | 'partial' | 'failed' | 'unknown';
  steps: { step: string; classification: string }[];
}

const STATUS_CONFIG: Record<string, { color: string; label: string; pulse?: boolean }> = {
  healthy: { color: 'bg-risk-green', label: 'Pipeline OK' },
  warning: { color: 'bg-risk-amber', label: '1 issue', pulse: true },
  partial: { color: 'bg-risk-amber', label: 'Partial data', pulse: true },
  failed:  { color: 'bg-risk-red', label: 'Pipeline failed', pulse: true },
  unknown: { color: 'bg-[var(--text-muted)]', label: 'No data' },
};

export default function PipelineStatusDot() {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8101';
  const navigate = useNavigate();

  const { data } = useQuery<CoverageSummary>({
    queryKey: ['pipeline_coverage_summary'],
    queryFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/coverage-summary`);
      if (!res.ok) return { trade_date: '', overall: 'unknown', steps: [] } as CoverageSummary;
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const overall = data?.overall ?? 'unknown';
  const config = STATUS_CONFIG[overall] ?? STATUS_CONFIG.unknown;

  const failedSteps = (data?.steps ?? []).filter(s => s.classification === 'failed' || s.classification === 'warning');
  const issueCount = failedSteps.length;

  return (
    <button
      onClick={() => navigate('/settings')}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-kd-elevated/40 transition-colors group"
      title={`Pipeline: ${config.label}${issueCount > 0 ? ` (${issueCount} step${issueCount > 1 ? 's' : ''})` : ''}`}
    >
      <div className="relative">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        {config.pulse && (
          <div className={cn('absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-50', config.color)} />
        )}
      </div>
      <span className="text-[10px] text-muted group-hover:text-[var(--text-secondary)] transition-colors hidden sm:inline">
        {overall === 'healthy' ? 'Pipeline' : config.label}
      </span>
    </button>
  );
}
