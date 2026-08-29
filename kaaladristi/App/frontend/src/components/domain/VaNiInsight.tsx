import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import VaNiFeedback from './VaNi/VaNiFeedback';

interface VaNiInsightProps {
  insight: string | null | undefined;
  isLoading?: boolean;
  className?: string;
  logId?: string;
  /**
   * When true, highlight key data points in the generated text with inline
   * colored chips — signed % (teal ↑ / red ↓), delivery multipliers (Nx),
   * institutional readings (N/50), and UPPER_SNAKE status flags (amber).
   * Rendering-only heuristic (regex over the text); does NOT touch VaNi
   * generation. Off by default so every other usage renders plain text.
   */
  highlightChips?: boolean;
  /**
   * Truncate the body to `collapsedHeight`px with a fade + a "Read full VaNi
   * analysis" toggle, expanding to the full text on click. Promoted out of
   * ChartView.tsx, which hand-rolled this exact wrapper locally — now any
   * caller gets it for free instead of re-implementing it per page. Off by
   * default so every other usage (Dashboard/Panchang/Breadth cards) is
   * unaffected.
   */
  collapsible?: boolean;
  /** Collapsed height in px. Only used when `collapsible` is true. */
  collapsedHeight?: number;
  /**
   * Color the bottom fade-out fades TO — must match whatever's actually
   * behind this card (the page background in most uses). Only used when
   * `collapsible` is true.
   */
  fadeTo?: string;
  /** Shows a small "⚡ cached" badge in the header — promoted out of RuleInsightCard.tsx. */
  cached?: boolean;
}

// Heuristic chip highlighter — see highlightChips prop.
const CHIP_RE =
  /([A-Z]{2,}(?:_[A-Z]+)+)|([+-]\d[\d,]*\.?\d*\s*%)|(\d[\d,]*\.?\d*\s*x\b)|(\d[\d,]*\.?\d*\s*\/\s*50)/g;

function chip(text: string, color: string, key: number) {
  return (
    <span
      key={key}
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        padding: '1px 5px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}

function renderWithChips(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  CHIP_RE.lastIndex = 0;
  while ((m = CHIP_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [full, flag, pct, mult, inst] = m;
    if (flag) {
      out.push(chip(full, 'var(--risk-amber)', key++)); // status flag → neutral
    } else if (pct) {
      out.push(chip(full, full.trim().startsWith('-') ? 'var(--bear)' : 'var(--bull)', key++));
    } else if (mult) {
      out.push(chip(full, 'var(--bull)', key++)); // delivery multiplier → positive
    } else if (inst) {
      const val = parseFloat(inst);
      out.push(chip(full, val < 15 ? 'var(--bear)' : val < 30 ? 'var(--risk-amber)' : 'var(--bull)', key++));
    }
    last = m.index + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function VaNiInsight({
  insight, isLoading, className, logId, highlightChips,
  collapsible, collapsedHeight = 130, fadeTo = 'var(--bg)', cached,
}: VaNiInsightProps) {
  const [expanded, setExpanded] = useState(false);
  if (!isLoading && !insight) return null;

  const showToggle = collapsible && !isLoading && !!insight;
  const collapsed = collapsible && !expanded;

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
        {cached && <span className="ml-auto text-[10px] text-muted">⚡ cached</span>}
      </div>

      {/* Body */}
      {isLoading && !insight ? (
        <div className="flex items-center gap-1.5 text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px]">Consulting VaNi…</span>
        </div>
      ) : (
        <>
          <div
            className={collapsible ? 'relative overflow-hidden' : undefined}
            style={collapsed ? { maxHeight: collapsedHeight } : undefined}
          >
            {/* whitespace-pre-line: prompts ask for "2 short paragraphs"
                (\n\n-separated) but plain HTML collapses that into one
                unbroken block — the paragraph structure was always being
                generated, just never rendered. */}
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {highlightChips && insight ? renderWithChips(insight) : insight}
            </p>
            {collapsed && (
              <div
                className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
                style={{ background: `linear-gradient(transparent, ${fadeTo})` }}
              />
            )}
          </div>
          {showToggle && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              {expanded ? '▴ Collapse' : '▾ Read full VaNi analysis'}
            </button>
          )}
          {logId && <VaNiFeedback logId={logId} />}
        </>
      )}
    </div>
  );
}
