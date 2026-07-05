import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import VaNiFeedback from './VaNi/VaNiFeedback';

interface VaNiInsightProps {
  insight: string | null | undefined;
  isLoading?: boolean;
  className?: string;
  logId?: string;
}

export default function VaNiInsight({ insight, isLoading, className, logId }: VaNiInsightProps) {
  if (!isLoading && !insight) return null;

  return (
    // Distinct "AI voice" treatment (owner decision 2026-07-05): a soft
    // indigo-tinted panel with a left accent bar, applied here so every
    // VaNi insight across the product picks it up. Low-alpha tints of the
    // theme's accent-indigo keep it legible on all three themes.
    <div
      className={cn(
        'mt-3 px-3 py-2.5 rounded-md bg-accent-indigo/[0.06] border border-accent-indigo/15 border-l-2 border-l-accent-indigo/60',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-accent-indigo text-[11px] leading-none select-none">✦</span>
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-accent-indigo">
          VaNi
        </span>
        <span className="text-[8px] text-muted tracking-wide">· वाणी</span>
      </div>

      {/* Body */}
      {isLoading && !insight ? (
        <div className="flex items-center gap-1.5 text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px]">Consulting VaNi…</span>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {insight}
          </p>
          {logId && <VaNiFeedback logId={logId} />}
        </>
      )}
    </div>
  );
}
