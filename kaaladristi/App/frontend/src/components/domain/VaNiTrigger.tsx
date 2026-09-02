import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VaNiEntity } from '@/stores/vaniStore';
import StockAskPopover from '@/components/domain/VaNi/StockAskPopover';

interface VaNiTriggerProps {
  entity: VaNiEntity;
  className?: string;
}

// Used to open the global drawer (openWithEntity) — owner, 2026-09-02: "why
// am i still getting slide for the onboard vani, we have discussed this a
// few times". Same "existing VaNi space, not a right drawer" complaint
// already fixed for the on-page screener pills, never applied to this
// per-stock trigger (one on every scan table row). Now opens a small
// popover anchored to the clicked button instead — see StockAskPopover.tsx.
export default function VaNiTrigger({ entity, className }: VaNiTriggerProps) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setAnchor((a) => (a ? null : { x: rect.left, y: rect.bottom }));
        }}
        title={`Ask VaNi about ${entity.symbol}`}
        className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all',
          'bg-[var(--accent-indigo)]/10 border border-[var(--accent-indigo)]/20',
          'hover:bg-[var(--accent-indigo)]/25 hover:border-[var(--accent-indigo)]/40',
          'text-[var(--accent-indigo)]/60 hover:text-[var(--accent-indigo)]',
          className,
        )}
      >
        <Sparkles className="w-3 h-3" />
      </button>
      {anchor && (
        <StockAskPopover
          entity={entity}
          anchorX={anchor.x}
          anchorY={anchor.y}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
