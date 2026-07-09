import { useNavigate } from 'react-router-dom';
import { usePipelineStatus, type PipelineStatusLevel } from '@/hooks/usePipelineStatus';

// ── Pill colors per status — matches mockup freshness pill visual ──
const STATUS_CONFIG: Record<PipelineStatusLevel, {
  bg: string;
  color: string;
  dotColor: string;
  suffix: (daysOld: number) => string;
}> = {
  current: {
    bg:       'var(--bull-bg)',
    color:    'var(--bull)',
    dotColor: 'var(--bull)',
    suffix:   () => '',
  },
  pending: {
    bg:       'var(--caution-bg)',
    color:    'var(--caution)',
    dotColor: 'var(--caution)',
    suffix:   () => '· processing',
  },
  delayed: {
    bg:       'var(--caution-bg)',
    color:    'var(--caution)',
    dotColor: 'var(--caution)',
    suffix:   (d) => `· ${d}d delayed`,
  },
  stale: {
    bg:       'var(--bear-bg)',
    color:    'var(--bear)',
    dotColor: 'var(--bear)',
    suffix:   (d) => `· stale (${d}d)`,
  },
};

export default function DataFreshnessChip() {
  const navigate = useNavigate();
  const pipeline = usePipelineStatus();

  if (pipeline.isLoading || !pipeline.latestDataDate) {
    return (
      <div
        className="inline-flex items-center shrink-0"
        style={{
          gap: '7px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-faint)',
          padding: '5px 11px',
          background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
          borderRadius: '100px',
        }}
      >
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ background: 'var(--text-faint)', animation: 'pulse 2.2s infinite' }}
        />
        <span>Loading…</span>
      </div>
    );
  }

  const config = STATUS_CONFIG[pipeline.status];
  const suffix = config.suffix(pipeline.daysOld);

  const [y, m, d] = pipeline.latestDataDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = `Data · ${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;

  return (
    <button
      onClick={() => navigate('/settings')}
      title="Last successful pipeline run. Click for details."
      className="inline-flex items-center shrink-0 cursor-pointer transition-opacity hover:opacity-80"
      style={{
        gap: '7px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: config.color,
        padding: '5px 11px',
        background: config.bg,
        borderRadius: '100px',
        border: 'none',
      }}
    >
      {/* Pulsing dot */}
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ background: config.dotColor, animation: 'pulse 2.2s infinite' }}
      />
      <span>{label}{suffix}</span>
    </button>
  );
}
