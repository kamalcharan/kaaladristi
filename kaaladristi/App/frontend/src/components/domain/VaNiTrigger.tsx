import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VaNiEntity } from '@/stores/vaniStore';
import { useStockAskStore } from '@/stores/stockAskStore';

interface VaNiTriggerProps {
  entity: VaNiEntity;
  className?: string;
}

// Used to open the global drawer (openWithEntity) — owner, 2026-09-02: "why
// am i still getting slide for the onboard vani, we have discussed this a
// few times". Same "existing VaNi space, not a right drawer" complaint
// already fixed for the on-page screener pills, never applied to this
// per-stock trigger (one on every scan table row). Now opens a small
// popover anchored to the clicked button instead — see StockAskPopover.tsx,
// mounted once globally (Layout.tsx) and driven by stockAskStore so only
// one instance is ever open at a time, regardless of how many rows render
// a trigger of their own.
export default function VaNiTrigger({ entity, className }: VaNiTriggerProps) {
  const isOpen = useStockAskStore((s) => s.isOpenFor(entity));
  const open = useStockAskStore((s) => s.open);
  const close = useStockAskStore((s) => s.close);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (isOpen) {
          close();
          return;
        }
        open(entity, e.currentTarget);
      }}
      title={`Ask VaNi about ${entity.symbol}`}
      className={cn(
        'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all',
        isOpen
          ? 'bg-[var(--accent-indigo)]/30 border border-[var(--accent-indigo)]/50 text-[var(--accent-indigo)]'
          : 'bg-[var(--accent-indigo)]/10 border border-[var(--accent-indigo)]/20 text-[var(--accent-indigo)]/60 hover:bg-[var(--accent-indigo)]/25 hover:border-[var(--accent-indigo)]/40 hover:text-[var(--accent-indigo)]',
        className,
      )}
    >
      <Sparkles className="w-3 h-3" />
    </button>
  );
}
