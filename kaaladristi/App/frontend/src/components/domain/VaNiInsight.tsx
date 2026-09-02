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
   * behind the collapsed text, which since the v2 masthead redesign is the
   * card's own body surface (`var(--kd-card)`), not the page background —
   * the card is a solid, distinct block now, not a page-blended tint. Only
   * used when `collapsible` is true; no caller currently overrides this.
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
  collapsible, collapsedHeight = 130, fadeTo = 'var(--kd-card)', cached,
}: VaNiInsightProps) {
  const [expanded, setExpanded] = useState(false);
  if (!isLoading && !insight) return null;

  const showToggle = collapsible && !isLoading && !!insight;
  const collapsed = collapsible && !expanded;

  return (
    // v2 "masthead" treatment (owner-approved design pass, 2026-09-01 —
    // see the "VaNi Card Identity" artifact) — replaces the v1 low-alpha
    // tint + left rail, which read as barely-there on a warm parchment
    // theme (Jade Thorn light) and didn't stand out anywhere else either.
    // A masthead band (badge + wordmark, on a tint of the theme's own
    // accent) sits above a plain elevated card body — it reads like a
    // byline: something with a distinct voice signing what it says, at a
    // glance, in any of the product's themes, since every color here is a
    // token (--accent-indigo, --kd-card, --border), never a literal.
    <div
      className={cn(
        'mt-3 rounded-lg overflow-hidden border border-accent-indigo/20 bg-[var(--kd-card)]',
        className,
      )}
    >
      {/* Masthead */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-indigo/[0.13] border-b border-accent-indigo/25">
        <span className="w-[15px] h-[15px] rounded-[4px] bg-accent-indigo flex items-center justify-center shrink-0">
          <span className="text-white text-[8px] leading-none select-none">✦</span>
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-accent-indigo">
          VaNi
        </span>
        <span className="text-[8px] text-accent-indigo/60 tracking-wide">वाणी</span>
        {cached && <span className="ml-auto text-[9.5px] text-accent-indigo/70">⚡ cached</span>}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
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
    </div>
  );
}
