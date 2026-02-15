import { getRegimeIntel } from '@/lib/regimeIntel';
import { cn } from '@/lib/utils';

interface RegimeContextProps {
  regime: string;
}

interface RowProps {
  label: string;
  value: string;
  level?: 'high' | 'moderate' | 'low' | 'minimal';
}

const levelColor: Record<string, string> = {
  high: 'text-risk-green',
  moderate: 'text-accent-cyan',
  low: 'text-risk-amber',
  minimal: 'text-risk-red',
};

function Row({ label, value, level }: RowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-kd-border last:border-0">
      <span className="text-xs text-muted font-medium shrink-0">{label}</span>
      <span className={cn('text-xs text-right leading-relaxed', level ? levelColor[level] : 'text-slate-300')}>
        {value}
      </span>
    </div>
  );
}

export default function RegimeContext({ regime }: RegimeContextProps) {
  const intel = getRegimeIntel(regime);

  return (
    <div className="space-y-1">
      <Row label="Behavior" value={intel.behaviorExpectation} />
      <Row label="Counter-moves" value={intel.counterMove} />
      <Row label="Deployment" value={intel.deploymentIntensity} level={intel.deploymentLevel} />
      <Row label="Breakout sustainability" value={intel.breakoutSustainability} />
      <Row label="Persistence" value={intel.persistence} />
      <Row label="Participation" value={intel.participationIntensity} level={intel.deploymentLevel} />
    </div>
  );
}
