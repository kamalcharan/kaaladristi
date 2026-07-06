/**
 * PulseVerdictBand — the verdict hero. The entire point of the Pulse page.
 * =========================================================================
 * Pulse contract: 4–5 second read, no widgets. The hero renders exactly the
 * verdict layer: one big state word, one short VaNi sentence, three layer
 * chips, the style picker (it changes the verdict, so it lives here), and
 * the Study escape hatch. Fixed compact height — content fits the box, the
 * box never grows to fit content.
 *
 * VaNi slot follows the platform presence pattern: a deterministic verdict
 * sentence always renders (correlation engine, no network); the AI
 * instrument insight replaces it on the latest bar, clamped to its first
 * two sentences — the full narration lives on Study. Scrubbing shows the
 * deterministic sentence for that bar; replay never fires LLM calls.
 */

import React from 'react';
import type { CorrelationState, TradingStyle } from '@/services/visualPulseEngine';

// ── Layer verdict vocabulary (same thresholds as CorrelationCard) ──────────

function getLayerVerdict(score: number, type: 'astro' | 'tech' | 'sm'): { verdict: string; color: string } {
  if (type === 'astro') {
    if (score >= 6) return { verdict: 'Favorable', color: 'var(--risk-green)' };
    if (score >= 3) return { verdict: 'Supportive', color: 'var(--accent-gold)' };
    if (score <= -3) return { verdict: 'Adverse', color: 'var(--risk-red)' };
    return { verdict: 'Quiet', color: 'var(--text-muted)' };
  }
  if (type === 'tech') {
    if (score >= 5) return { verdict: 'Confirmed', color: 'var(--risk-green)' };
    if (score >= 2) return { verdict: 'Building', color: 'var(--accent-gold)' };
    if (score <= -3) return { verdict: 'Weak', color: 'var(--risk-red)' };
    return { verdict: 'Neutral', color: 'var(--text-muted)' };
  }
  if (score >= 5) return { verdict: 'Leading', color: 'var(--risk-green)' };
  if (score >= 2) return { verdict: 'Active', color: 'var(--accent-gold)' };
  if (score <= -3) return { verdict: 'Exiting', color: 'var(--risk-red)' };
  return { verdict: 'Absent', color: 'var(--text-muted)' };
}

/** First N sentences of a text — the Pulse slot never shows an essay.
 *  Also strips list markers ("(1)", "1.", "•") the insight prompt sometimes
 *  emits, so the clamp reads as a sentence, not a fragment of a numbered list. */
function clampSentences(text: string, n: number): string {
  const clean = text.replace(/(^|\s)\(?\d+[).]\s+/g, '$1').replace(/(^|\s)[•·-]\s+/g, '$1').trim();
  const matches = clean.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches || matches.length <= n) return clean;
  return matches.slice(0, n).join('').trim();
}

const STYLES: TradingStyle[] = ['Conservative', 'Balanced', 'Aggressive'];
const STYLE_COLORS: Record<TradingStyle, string> = {
  Conservative: 'var(--accent-indigo)',
  Balanced: 'var(--accent-gold)',
  Aggressive: 'var(--risk-red)',
};

// ── Hero ────────────────────────────────────────────────────────────────────

export interface PulseVerdictBandProps {
  corrState: CorrelationState;
  astroScore: number;
  techScore: number;
  smScore: number;
  selectedStyle: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
  /** Trade date of the bar the verdict describes */
  date: string;
  /** True when the latest bar is active (not scrubbed into the past) */
  isNow: boolean;
  isFading?: boolean;
  /** AI instrument insight for the LATEST bar — shown only when isNow */
  narrative: string | null;
  narrativeLoading?: boolean;
  onStudyClick: () => void;
}

export default function PulseVerdictBand({
  corrState, astroScore, techScore, smScore,
  selectedStyle, onStyleChange,
  date, isNow, isFading,
  narrative, narrativeLoading,
  onStudyClick,
}: PulseVerdictBandProps) {
  const layers = [
    { name: 'Astro', ...getLayerVerdict(astroScore, 'astro'), score: astroScore },
    { name: 'Technical', ...getLayerVerdict(techScore, 'tech'), score: techScore },
    { name: 'Smart $', ...getLayerVerdict(smScore, 'sm'), score: smScore },
  ];

  // Deterministic verdict sentence — always available, no network.
  const fallback = `${corrState.tagline}. Astro ${layers[0].verdict.toLowerCase()}, `
    + `technicals ${layers[1].verdict.toLowerCase()}, smart money ${layers[2].verdict.toLowerCase()}.`;
  const showAi = isNow && !!narrative;
  const vaniText = showAi ? clampSentences(narrative!, 2) : fallback;

  return (
    <div
      className="rounded-xl border border-kd-border overflow-hidden shrink-0"
      style={{
        background: `linear-gradient(120deg, color-mix(in srgb, ${corrState.color} 9%, var(--kd-surface)), var(--kd-surface) 60%)`,
        opacity: isFading ? 0.35 : 1,
        transition: 'opacity 0.15s ease, background 0.5s ease',
      }}
    >
      {/* Row 1 — verdict word + VaNi sentence */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 px-4 pt-3.5 pb-2.5">
        <div className="shrink-0 sm:w-[210px]">
          <div
            className="font-serif font-black leading-none text-[30px]"
            style={{ color: corrState.color, transition: 'color 0.4s ease' }}
          >
            {corrState.state}
          </div>
          <div className="text-xs text-secondary mt-1 leading-snug">
            {corrState.tagline}
          </div>
        </div>
        <div className="flex-1 min-w-0 sm:border-l sm:border-kd-border sm:pl-5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-accent-indigo text-[11px] leading-none select-none">✦</span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-accent-indigo">VaNi</span>
            {!showAi && narrativeLoading && isNow && (
              <span className="text-[9px] text-muted animate-pulse">consulting…</span>
            )}
          </div>
          <p
            className="text-[13px] text-secondary leading-relaxed overflow-hidden"
            style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
          >
            {vaniText}
          </p>
        </div>
      </div>

      {/* Row 2 — layer chips · style · date · Study */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-t border-kd-border bg-kd-bg/30">
        {layers.map((l) => (
          <span
            key={l.name}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono"
            style={{
              color: l.color,
              background: `color-mix(in srgb, ${l.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${l.color} 25%, transparent)`,
            }}
          >
            <span className="text-muted">{l.name}</span>
            {l.verdict} {l.score > 0 ? '+' : ''}{l.score}
          </span>
        ))}

        <span className="flex-1" />

        <span className="inline-flex gap-1">
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => onStyleChange(s)}
              className="px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold tracking-wide cursor-pointer transition-all"
              style={{
                border: `1px solid ${selectedStyle === s
                  ? `color-mix(in srgb, ${STYLE_COLORS[s]} 44%, transparent)`
                  : 'var(--kd-border)'}`,
                background: selectedStyle === s
                  ? `color-mix(in srgb, ${STYLE_COLORS[s]} 12%, transparent)`
                  : 'transparent',
                color: selectedStyle === s ? STYLE_COLORS[s] : 'var(--text-muted)',
              }}
            >
              {s.slice(0, 4)}
            </button>
          ))}
        </span>

        <span className="font-mono text-[10px] text-muted">
          {date}{!isNow && ' · replay'}
        </span>

        <button
          onClick={onStudyClick}
          className="font-mono text-[11px] font-semibold cursor-pointer bg-transparent border-none p-0"
          style={{ color: 'var(--gold, #d4a84b)' }}
        >
          Study this →
        </button>
      </div>
    </div>
  );
}
