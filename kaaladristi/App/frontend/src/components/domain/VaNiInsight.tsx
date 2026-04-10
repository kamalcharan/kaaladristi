import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * VaNi — the AI intelligence layer of Kāla-Drishti.
 * वाणी (Vāṇī) = voice / speech / Saraswati.
 *
 * Reusable panel rendered below any data card when VaNi has an insight.
 * Tone: Factual · Educational · Non-predictive (per PRD FR-05).
 */

interface VaNiInsightProps {
  insight: string | null | undefined;
  isLoading?: boolean;
  className?: string;
}

export default function VaNiInsight({ insight, isLoading, className }: VaNiInsightProps) {
  if (!isLoading && !insight) return null;

  return (
    <div className={cn('mt-3 pt-3 border-t border-kd-border', className)}>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {/* VaNi sigil — stylised ॐ-inspired dot cluster */}
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
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          {insight}
        </p>
      )}
    </div>
  );
}
