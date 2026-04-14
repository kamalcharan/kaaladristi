import React from 'react';
import type { DivergenceSignal } from '@/services/visualPulseEngine';

// ── Freshness Config ────────────────────────────────────────────

const FRESHNESS_EMOJI: Record<string, string> = {
  hot: '\uD83D\uDD25',      // fire
  recent: '\u2705',          // check
  stale: '\u26A0\uFE0F',    // warning
  old: '\uD83D\uDCA4',      // zzz
};

const FRESHNESS_LABEL: Record<string, string> = {
  hot: 'Hot — active now',
  recent: 'Recent — still relevant',
  stale: 'Stale — fading signal',
  old: 'Old — historical only',
};

const TYPE_COLORS: Record<string, string> = {
  RegularBullish: 'var(--risk-green)',
  RegularBearish: 'var(--risk-red)',
  HiddenBullish: 'var(--accent-gold)',
  HiddenBearish: 'var(--risk-amber)',
};

// ── Dual Sparkline ──────────────────────────────────────────────

function DualSparkline({ prices, rsis }: { prices: number[]; rsis: number[] }) {
  const n = Math.min(prices.length, rsis.length);
  if (n < 3) return null;

  const w = 200, hTop = 24, hBot = 24, gap = 4;
  const totalH = hTop + gap + hBot;

  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;

  const rMin = Math.min(...rsis);
  const rMax = Math.max(...rsis);
  const rRange = rMax - rMin || 1;

  const toX = (i: number) => (i / (n - 1)) * w;
  const toPY = (v: number) => hTop - ((v - pMin) / pRange) * hTop;
  const toRY = (v: number) => hTop + gap + hBot - ((v - rMin) / rRange) * hBot;

  const pPoints = prices.slice(0, n).map((v, i) => `${toX(i)},${toPY(v)}`).join(' ');
  const rPoints = rsis.slice(0, n).map((v, i) => `${toX(i)},${toRY(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${totalH}`} width="100%" height={totalH}>
      {/* Price line */}
      <polyline points={pPoints} fill="none" stroke="var(--text-secondary)"
        strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* RSI line */}
      <polyline points={rPoints} fill="none" stroke="var(--accent-indigo)"
        strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Labels */}
      <text x={0} y={10} fill="var(--text-muted)" fontSize={7}
        fontFamily="var(--font-mono, monospace)">Price</text>
      <text x={0} y={hTop + gap + 10} fill="var(--text-muted)" fontSize={7}
        fontFamily="var(--font-mono, monospace)">RSI</text>
    </svg>
  );
}

// ── Divergence Card ─────────────────────────────────────────────

interface DivergenceCardProps {
  divergence: DivergenceSignal;
  rsiHistory: number[];
  priceHistory: number[];
}

export default function DivergenceCard({ divergence, rsiHistory, priceHistory }: DivergenceCardProps) {
  const hasDiv = divergence.type != null;
  const color = hasDiv ? (TYPE_COLORS[divergence.type!] ?? 'var(--text-muted)') : 'var(--text-muted)';

  return (
    <div style={{
      background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--kd-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase', letterSpacing: 3, color: 'var(--text-muted)',
        }}>RSI Divergence</span>
        {hasDiv && (
          <span style={{
            padding: '2px 8px', borderRadius: 10,
            fontSize: 8, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            color,
          }}>
            {divergence.type!.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        )}
      </div>

      <div style={{ padding: '10px 14px' }}>
        {hasDiv ? (
          <>
            {/* Type + Freshness */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{FRESHNESS_EMOJI[divergence.freshness]}</span>
              <div>
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 600, color,
                }}>
                  {divergence.barsAgo === 0 ? 'Active now' : `${divergence.barsAgo} bars ago`}
                </div>
                <div style={{
                  fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-muted)',
                }}>{FRESHNESS_LABEL[divergence.freshness]}</div>
              </div>
            </div>

            {/* Sparklines */}
            <DualSparkline prices={priceHistory} rsis={rsiHistory} />

            {/* Explanation */}
            <div style={{
              marginTop: 8, fontSize: 10, fontStyle: 'italic',
              color: 'var(--text-secondary)', lineHeight: 1.5,
            }}>{divergence.label}</div>
          </>
        ) : (
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-muted)', fontStyle: 'italic',
            padding: '8px 0',
          }}>No divergence detected in last 50 bars</div>
        )}
      </div>
    </div>
  );
}
