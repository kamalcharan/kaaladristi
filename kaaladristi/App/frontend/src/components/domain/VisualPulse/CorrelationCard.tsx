import React from 'react';
import type { CorrelationState, TradingStyle } from '@/services/visualPulseEngine';

// ── Score Bar ───────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 5) return 'var(--risk-green)';
  if (score >= 2) return 'var(--accent-gold)';
  if (score >= 0) return 'var(--accent-indigo)';
  return 'var(--risk-red)';
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.max(0, ((score + max) / (2 * max)) * 100);
  const color = scoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 64, flexShrink: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: 8,
        letterSpacing: 0.5, color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>{label}</span>
      <div style={{
        flex: 1, height: 5, background: 'var(--kd-bg)', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
        }} />
      </div>
      <span style={{
        width: 32, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11, color,
        transition: 'color 0.4s ease',
      }}>
        {score > 0 ? '+' : ''}{score}
      </span>
    </div>
  );
}

// ── Layer Chip ──────────────────────────────────────────────────

function LayerChip({ name, verdict, score, color }: {
  name: string; verdict: string; score: number; color: string;
}) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8,
      background: `color-mix(in srgb, ${color} 13%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`,
      transition: 'all 0.4s ease',
    }}>
      <div style={{
        fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2,
      }}>{name}</div>
      <div style={{
        fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)',
        color, transition: 'color 0.4s ease',
      }}>{verdict}</div>
      <div style={{
        fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
        color, opacity: 0.88,
      }}>
        {score > 0 ? '+' : ''}{score}
      </div>
    </div>
  );
}

// ── Correlation Card ────────────────────────────────────────────

interface CorrelationCardProps {
  astroScore: number;
  techScore: number;
  smScore: number;
  corrState: CorrelationState;
  selectedStyle: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
}

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
  // sm
  if (score >= 5) return { verdict: 'Leading', color: 'var(--risk-green)' };
  if (score >= 2) return { verdict: 'Active', color: 'var(--accent-gold)' };
  if (score <= -3) return { verdict: 'Exiting', color: 'var(--risk-red)' };
  return { verdict: 'Absent', color: 'var(--text-muted)' };
}

const STYLES: TradingStyle[] = ['Conservative', 'Balanced', 'Aggressive'];
const STYLE_COLORS: Record<TradingStyle, string> = {
  Conservative: 'var(--accent-indigo)',
  Balanced: 'var(--accent-gold)',
  Aggressive: 'var(--risk-red)',
};

export default function CorrelationCard({
  astroScore, techScore, smScore, corrState,
  selectedStyle, onStyleChange,
}: CorrelationCardProps) {
  const total = astroScore + techScore + smScore;
  const astroLayer = getLayerVerdict(astroScore, 'astro');
  const techLayer = getLayerVerdict(techScore, 'tech');
  const smLayer = getLayerVerdict(smScore, 'sm');

  // Gap bar: maps -30..+30 to 0..100%
  const gapPct = ((total + 30) / 60) * 100;

  return (
    <div style={{
      background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
      borderRadius: 12,
      transition: 'border-color 0.5s ease',
    }}>
      {/* Verdict Hero */}
      <div style={{
        padding: '16px 14px 12px', position: 'relative',
        background: `linear-gradient(135deg, color-mix(in srgb, ${corrState.color} 10%, transparent), transparent)`,
        borderBottom: '1px solid var(--kd-border)',
        transition: 'background 0.5s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
              textTransform: 'uppercase', letterSpacing: 3, color: 'var(--text-muted)',
              marginBottom: 4,
            }}>Correlation Verdict</div>
            <div style={{
              fontSize: 28, fontFamily: 'var(--font-serif, serif)', fontWeight: 900,
              lineHeight: 1, color: corrState.color,
              transition: 'color 0.4s ease',
            }}>{corrState.state}</div>
            <div style={{
              fontSize: 11, fontStyle: 'italic', color: 'var(--text-secondary)',
              marginTop: 4, maxWidth: 280, lineHeight: 1.4,
              transition: 'opacity 0.3s ease',
            }}>{corrState.tagline}</div>
          </div>
          {/* Style picker */}
          <div style={{ display: 'flex', gap: 4 }}>
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => onStyleChange(s)}
                style={{
                  padding: '4px 10px', borderRadius: 14,
                  fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                  fontWeight: 600, letterSpacing: 1, cursor: 'pointer',
                  border: `1px solid ${selectedStyle === s
                    ? `color-mix(in srgb, ${STYLE_COLORS[s]} 44%, transparent)`
                    : 'var(--kd-border)'}`,
                  background: selectedStyle === s
                    ? `color-mix(in srgb, ${STYLE_COLORS[s]} 12%, transparent)`
                    : 'transparent',
                  color: selectedStyle === s ? STYLE_COLORS[s] : 'var(--text-muted)',
                  transition: 'all 0.25s',
                }}
              >
                {s.slice(0, 4)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Score Bars */}
      <div style={{ padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ScoreBar label="Astro" score={astroScore} max={10} />
        <ScoreBar label="Technical" score={techScore} max={10} />
        <ScoreBar label="Smart $" score={smScore} max={8} />

        {/* Gap Bar */}
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid var(--kd-border)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 4,
          }}>
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
              textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)',
            }}>Alignment Gap</span>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
              color: corrState.state === 'Aligned' ? 'var(--risk-green)' : 'var(--accent-gold)',
              letterSpacing: 1,
            }}>
              {corrState.state === 'Aligned' ? '✓ Threshold Reached' : `${total} pts`}
            </span>
          </div>
          <div style={{
            height: 6, background: 'var(--kd-bg)', borderRadius: 3,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${Math.max(0, Math.min(100, gapPct))}%`,
              background: corrState.color, borderRadius: 3,
              transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Layer Chips */}
      <div style={{
        padding: '10px 14px 12px',
        borderTop: '1px solid var(--kd-border)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <LayerChip name="Astro" verdict={astroLayer.verdict} score={astroScore} color={astroLayer.color} />
          <LayerChip name="Technical" verdict={techLayer.verdict} score={techScore} color={techLayer.color} />
          <LayerChip name="Smart $" verdict={smLayer.verdict} score={smScore} color={smLayer.color} />
        </div>
      </div>
    </div>
  );
}
