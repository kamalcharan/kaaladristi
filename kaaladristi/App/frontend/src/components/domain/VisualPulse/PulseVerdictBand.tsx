/**
 * PulseVerdictBand — the 5-second answer, promoted above the chart
 * =================================================================
 * Pulse contract: this page IS a verdict. The band puts the verdict where
 * the eye lands first, assembled from parts that used to live mid-sidebar:
 *
 *   [ Verdict hero + style picker | layer score bars | VaNi narrative ]
 *
 * The VaNi slot follows the platform-wide presence pattern: a deterministic
 * verdict sentence always renders (built from the correlation engine, no
 * network), and the AI instrument insight replaces it when available for
 * the latest bar. Scrubbing to a past bar shows the deterministic sentence
 * for that bar — historical replay never fires per-date LLM calls.
 *
 * CorrelationCard (the previous home of the hero + bars) remains untouched
 * for the Intraday pages; both VP pages render this band instead.
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

function scoreColor(score: number): string {
  if (score >= 5) return 'var(--risk-green)';
  if (score >= 2) return 'var(--accent-gold)';
  if (score >= 0) return 'var(--accent-indigo)';
  return 'var(--risk-red)';
}

function ScoreBar({ label, verdict, score, max }: { label: string; verdict: string; score: number; max: number }) {
  const pct = Math.max(0, ((score + max) / (2 * max)) * 100);
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-[72px] shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex-1 h-[5px] rounded bg-kd-bg overflow-hidden">
        <div
          className="h-full rounded"
          style={{
            width: `${pct}%`, background: color,
            transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
          }}
        />
      </div>
      <span className="w-[68px] shrink-0 text-right font-mono text-[10px]" style={{ color }}>
        {verdict} {score > 0 ? '+' : ''}{score}
      </span>
    </div>
  );
}

// ── Trading style picker ────────────────────────────────────────────────────

const STYLES: TradingStyle[] = ['Conservative', 'Balanced', 'Aggressive'];
const STYLE_COLORS: Record<TradingStyle, string> = {
  Conservative: 'var(--accent-indigo)',
  Balanced: 'var(--accent-gold)',
  Aggressive: 'var(--risk-red)',
};

// ── Band ────────────────────────────────────────────────────────────────────

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
  const astroLayer = getLayerVerdict(astroScore, 'astro');
  const techLayer = getLayerVerdict(techScore, 'tech');
  const smLayer = getLayerVerdict(smScore, 'sm');
  const total = astroScore + techScore + smScore;
  const gapPct = Math.max(0, Math.min(100, ((total + 30) / 60) * 100));

  // Deterministic verdict sentence — always available, no network. The AI
  // narrative (latest bar only) replaces it when present.
  const fallback = `${corrState.tagline}. Astro ${astroLayer.verdict.toLowerCase()}, `
    + `technicals ${techLayer.verdict.toLowerCase()}, smart money ${smLayer.verdict.toLowerCase()}.`;
  const showAi = isNow && !!narrative;
  const vaniText = showAi ? narrative : fallback;

  return (
    <div
      className="rounded-xl border border-kd-border overflow-hidden mb-2 shrink-0"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${corrState.color} 8%, var(--kd-surface)), var(--kd-surface) 55%)`,
        opacity: isFading ? 0.35 : 1,
        transition: 'opacity 0.15s ease, background 0.5s ease',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-stretch">

        {/* Verdict hero */}
        <div className="md:w-[218px] shrink-0 px-3.5 py-3 border-b md:border-b-0 md:border-r border-kd-border">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted mb-1">
            Pulse Verdict
          </div>
          <div
            className="font-serif font-black leading-none text-[26px]"
            style={{ color: corrState.color, transition: 'color 0.4s ease' }}
          >
            {corrState.state}
          </div>
          <div className="text-[11px] italic text-secondary mt-1 leading-snug">
            {corrState.tagline}
          </div>
          {/* Style picker — changes the verdict, so it lives with the verdict */}
          <div className="flex gap-1 mt-2">
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
          </div>
        </div>

        {/* Layer scores */}
        <div className="flex-1 min-w-0 px-3.5 py-3 flex flex-col justify-center gap-2 border-b md:border-b-0 md:border-r border-kd-border">
          <ScoreBar label="Astro" verdict={astroLayer.verdict} score={astroScore} max={10} />
          <ScoreBar label="Technical" verdict={techLayer.verdict} score={techScore} max={10} />
          <ScoreBar label="Smart $" verdict={smLayer.verdict} score={smScore} max={8} />
          <div className="flex items-center gap-2.5 pt-1.5 border-t border-kd-border">
            <span className="w-[72px] shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted">
              Alignment
            </span>
            <div className="flex-1 h-[5px] rounded bg-kd-bg overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${gapPct}%`, background: corrState.color,
                  transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
                }}
              />
            </div>
            <span
              className="w-[68px] shrink-0 text-right font-mono text-[10px]"
              style={{ color: corrState.state === 'Aligned' ? 'var(--risk-green)' : 'var(--accent-gold)' }}
            >
              {corrState.state === 'Aligned' ? '✓ Reached' : `${total > 0 ? '+' : ''}${total} pts`}
            </span>
          </div>
        </div>

        {/* VaNi slot — platform presence pattern (indigo AI voice) */}
        <div className="md:w-[290px] shrink-0 px-3.5 py-3 flex flex-col bg-accent-indigo/[0.05]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-accent-indigo text-[11px] leading-none select-none">✦</span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-accent-indigo">
              VaNi
            </span>
            {showAi
              ? <span className="text-[8px] text-muted tracking-wide">· वाणी</span>
              : narrativeLoading && isNow
                ? <span className="text-[8px] text-muted tracking-wide animate-pulse">· consulting…</span>
                : null}
          </div>
          <p className="text-[11px] italic text-secondary leading-relaxed flex-1">
            {vaniText}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="font-mono text-[9px] tracking-widest text-muted">
              {date}{!isNow && ' · replay'}
            </span>
            <button
              onClick={onStudyClick}
              className="font-mono text-[10px] font-semibold tracking-wide cursor-pointer bg-transparent border-none p-0"
              style={{ color: 'var(--gold, #d4a84b)' }}
            >
              Study this →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
