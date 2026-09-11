import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import VaNiIntentButton from './VaNiIntentButton';

export interface TrayIntent {
  intentId: string;
  label: string;
}

interface VaNiIntentTrayProps {
  intents: TrayIntent[];
  disabled?: boolean;
  onAsk: (intentId: string, label: string) => void;
  /** Heading over the list. Changes meaning once a brief sits above it. */
  heading?: string;
  /** How many to show before the expander. */
  collapsedCount?: number;
  /** Rendered under the list — the scanner stock-lookup affordance. */
  footer?: React.ReactNode;
}

/**
 * The questions tray — pinned to the bottom of the DOCKED pane.
 *
 * Why pinned rather than inline: the opening brief (panchangam card + the
 * market read) is taller than the pane, so an inline list put every question
 * below the fold — the user landed on a wall of text with no visible way to
 * go deeper. Pinning it also collapses what used to be two near-identical
 * inline lists (the empty state's and the follow-up's) into one surface that
 * simply shows whatever has not been asked yet.
 */
export default function VaNiIntentTray({
  intents,
  disabled = false,
  onAsk,
  heading = 'Go deeper',
  collapsedCount = 2,
  footer,
}: VaNiIntentTrayProps) {
  const [expanded, setExpanded] = useState(false);
  if (!intents.length && !footer) return null;

  const shown = expanded ? intents : intents.slice(0, collapsedCount);
  const hidden = intents.length - shown.length;

  return (
    <div className="shrink-0 border-t border-[var(--accent-indigo)]/15 bg-[var(--bg)]/60 backdrop-blur-sm px-5 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--accent-indigo)]/40">
          {heading}
        </span>
        <div className="flex-1 h-px bg-[var(--accent-indigo)]/10" />
        {(hidden > 0 || expanded) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-[var(--accent-indigo)]/50 hover:text-[var(--accent-indigo)] transition-colors"
          >
            {expanded ? 'less' : `${hidden} more`}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
        {shown.map((i) => (
          <VaNiIntentButton
            key={i.intentId}
            label={i.label}
            disabled={disabled}
            onClick={() => onAsk(i.intentId, i.label)}
          />
        ))}
        {footer}
      </div>
    </div>
  );
}
