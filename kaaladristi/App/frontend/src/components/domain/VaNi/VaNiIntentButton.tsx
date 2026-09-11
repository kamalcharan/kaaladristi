import { MessageCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IntentButtonVariant = 'primary' | 'secondary';

interface VaNiIntentButtonProps {
  label: string;
  variant?: IntentButtonVariant;
  disabled?: boolean;
  /** Swap the leading glyph — the stock-lookup affordance reuses this shell. */
  icon?: React.ReactNode;
  onClick: () => void;
}

/**
 * One question the user can put to VaNi.
 *
 * Extracted from VaNiChatPanel because the panel rendered this same shell in
 * three places (empty state, follow-up list, stock lookup) and the tray now
 * needs a fourth — four hand-maintained copies of one control is how the
 * variants drift.
 */
export default function VaNiIntentButton({
  label,
  variant = 'secondary',
  disabled = false,
  icon,
  onClick,
}: VaNiIntentButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group',
        variant === 'primary'
          ? 'bg-[var(--bg)]/60 border-2 border-[var(--accent-indigo)]/20 hover:border-[var(--accent-indigo)]/50 hover:bg-[var(--bg)]/80'
          : 'bg-[var(--bg)]/30 border border-[var(--accent-indigo)]/10 hover:border-[var(--accent-indigo)]/30 hover:bg-[var(--bg)]/50',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[var(--accent-indigo)]/20 group-hover:bg-[var(--accent-indigo)]/30 transition-colors">
        {icon ?? <MessageCircle className="w-3 h-3 text-[var(--accent-indigo)]" />}
      </div>
      <span className="text-xs font-medium leading-snug text-[var(--text-secondary)] group-hover:text-[var(--accent-indigo)] transition-colors">
        {label}
      </span>
      <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-[var(--accent-indigo)]/30 group-hover:text-[var(--accent-indigo)]/60 transition-colors" />
    </button>
  );
}
