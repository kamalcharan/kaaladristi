import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaNiStore } from '@/stores/vaniStore';
import type { VaNiEntity } from '@/stores/vaniStore';

interface VaNiTriggerProps {
  entity: VaNiEntity;
  className?: string;
}

export default function VaNiTrigger({ entity, className }: VaNiTriggerProps) {
  const { openWithEntity } = useVaNiStore();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openWithEntity(entity);
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
  );
}
