import { AlertTriangle } from 'lucide-react';
import type { SnapshotEvent, SnapshotAspect } from '@/types';
import { cn } from '@/lib/utils';

interface EventsBannerProps {
  events: SnapshotEvent[];
  aspects: SnapshotAspect[];
}

function formatEvent(e: SnapshotEvent): string {
  const type = e.event_type.replace(/_/g, ' ');
  if (e.event_type === 'retrograde_start' || e.event_type === 'retrograde') {
    return `${e.planet} Retrograde`;
  }
  if (e.event_type === 'sign_change') {
    return `${e.planet} enters ${e.to_value ?? 'new sign'}`;
  }
  if (e.event_type === 'gandanta') {
    return `${e.planet} in Gandanta`;
  }
  if (e.event_type === 'combustion') {
    return `${e.planet} Combust`;
  }
  return `${e.planet} ${type}`;
}

function formatAspect(a: SnapshotAspect): string {
  const symbol = a.aspect_type === 'conjunction' ? '☌'
    : a.aspect_type === 'opposition' ? '☍'
    : a.aspect_type === 'trine' ? '△'
    : a.aspect_type === 'square' ? '□'
    : a.aspect_type === 'sextile' ? '⚹'
    : a.aspect_type;
  const exactLabel = a.exact ? ' (exact)' : '';
  return `${a.planet_1} ${symbol} ${a.planet_2}${exactLabel}`;
}

export default function EventsBanner({ events, aspects }: EventsBannerProps) {
  const exactAspects = aspects.filter(a => a.exact);
  const items: string[] = [
    ...events.map(formatEvent),
    ...exactAspects.map(formatAspect),
  ];

  if (items.length === 0) return null;

  const hasHighSeverity = events.some(e => e.severity === 'high') || exactAspects.length > 0;

  return (
    <div className={cn(
      'flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm',
      hasHighSeverity
        ? 'bg-risk-red/5 border-risk-red/20 text-risk-red'
        : 'bg-risk-amber/5 border-risk-amber/20 text-risk-amber'
    )}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium">{item}</span>
            {i < items.length - 1 && <span className="text-white/20">·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
