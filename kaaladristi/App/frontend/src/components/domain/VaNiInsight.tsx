import React from 'react';
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

export default function VaNiInsight({ insight, isLoading, className, logId, highlightChips }: VaNiInsightProps) {
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
            {highlightChips && insight ? renderWithChips(insight) : insight}
          </p>
          {logId && <VaNiFeedback logId={logId} />}
        </>
      )}
    </div>
  );
}
