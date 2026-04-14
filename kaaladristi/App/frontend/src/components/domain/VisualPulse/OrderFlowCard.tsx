import React from 'react';
import type { PulseBar, RssSignals } from '@/services/visualPulseEngine';

// ── Flow Type Config ────────────────────────────────────────────

const FLOW_CONFIG: Record<string, { color: string; arrow: string }> = {
  FRESH_LONGS:       { color: 'var(--accent-indigo)', arrow: '▶▶' },
  SHORT_COVERING:    { color: 'var(--accent-cyan, #14b8a6)', arrow: '▶' },
  FRESH_SHORTS:      { color: 'var(--risk-red)', arrow: '◀◀' },
  LONG_LIQUIDATION:  { color: 'var(--risk-amber)', arrow: '◀' },
  MIXED:             { color: 'var(--accent-violet)', arrow: '⟺' },
  LOW_VOLUME:        { color: 'var(--text-muted)', arrow: '—' },
};

const RSS_COLORS: Record<string, string> = {
  OVERBOUGHT: 'var(--risk-red)',
  BULLISH: 'var(--risk-green)',
  NEUTRAL: 'var(--accent-gold)',
  BEARISH: 'var(--risk-amber)',
  OVERSOLD: 'var(--text-muted)',
};

// ── Flag Chip ───────────────────────────────────────────────────

function FlagChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10,
      fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 44%, transparent)`,
      color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

// ── RSS Arc Gauge (SVG) ─────────────────────────────────────────

function RssArc({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const dashLen = pct * 75;
  return (
    <svg viewBox="0 0 60 34" width={60} height={34}>
      <path
        d="M 6 30 A 24 24 0 0 1 54 30"
        fill="none" stroke="var(--kd-border)" strokeWidth={4} strokeLinecap="round"
      />
      <path
        d="M 6 30 A 24 24 0 0 1 54 30"
        fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${dashLen} 75`}
        style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
      />
    </svg>
  );
}

// ── RSS Sparkline ───────────────────────────────────────────────

function RssSparkline({ history, color }: { history: number[]; color: string }) {
  if (history.length < 2) return null;
  const w = 352, h = 28;
  const n = history.length;
  const toX = (i: number) => (i / (n - 1)) * w;
  const toY = (v: number) => h - (v / 100) * h;
  const points = history.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const last = history[history.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={28} preserveAspectRatio="none">
      <line x1={0} y1={toY(80)} x2={w} y2={toY(80)}
        stroke="var(--risk-red)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.2} />
      <line x1={0} y1={toY(50)} x2={w} y2={toY(50)}
        stroke="var(--kd-border)" strokeWidth={0.5} opacity={0.3} />
      <line x1={0} y1={toY(20)} x2={w} y2={toY(20)}
        stroke="var(--risk-green)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.2} />
      <polyline points={points} fill="none" stroke={color}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(n - 1)} cy={toY(last)} r={2.5} fill={color} />
    </svg>
  );
}

// ── Volume Bar ──────────────────────────────────────────────────

function VolumeBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value > 2 ? 'var(--risk-green)' : value > 1 ? 'var(--accent-gold)' : 'var(--risk-red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 36, fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
        textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)',
      }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--kd-bg)', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 2,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{
        width: 32, textAlign: 'right', fontSize: 9,
        fontFamily: 'var(--font-mono, monospace)', color,
      }}>{value?.toFixed(2) ?? '—'}</span>
    </div>
  );
}

// ── Order Flow Card ─────────────────────────────────────────────

interface OrderFlowCardProps {
  bar: PulseBar;
  rss: RssSignals;
  rssHistory: number[];
  narrative: string;
}

export default function OrderFlowCard({ bar, rss, rssHistory, narrative }: OrderFlowCardProps) {
  const ft = bar.flow_type ?? 'MIXED';
  const fc = FLOW_CONFIG[ft] ?? FLOW_CONFIG.MIXED;
  const rssColor = RSS_COLORS[rss.zone] ?? 'var(--text-muted)';

  // Collect active flags
  const flags: { label: string; color: string }[] = [];
  if (bar.vacuum_flag === 'VACUUM_UP') flags.push({ label: 'VACUUM ↑', color: 'var(--risk-amber)' });
  if (bar.vacuum_flag === 'VACUUM_DOWN') flags.push({ label: 'VACUUM ↓', color: 'var(--risk-amber)' });
  if (bar.volume_divergence_flag === 'VOLUME_DIV_UP') flags.push({ label: 'VOL DIV ↑', color: 'var(--risk-amber)' });
  if (bar.volume_divergence_flag === 'VOLUME_DIV_DOWN') flags.push({ label: 'VOL DIV ↓', color: 'var(--risk-amber)' });
  if (bar.accum_distrib === 'ACCUMULATION') flags.push({ label: 'ACCUMULATION', color: 'var(--risk-green)' });
  if (bar.accum_distrib === 'DISTRIBUTION') flags.push({ label: 'DISTRIBUTION', color: 'var(--risk-red)' });
  if (rss.isNewHigh) flags.push({ label: 'RSS NEW HIGH', color: 'var(--accent-gold)' });

  return (
    <div style={{
      background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
      borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--kd-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase', letterSpacing: 3, color: 'var(--text-muted)',
        }}>Order Flow &middot; RSS</span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
        }}>{bar.trade_date}</span>
      </div>

      {/* Flow Type */}
      <div style={{ padding: '10px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 16, fontFamily: 'var(--font-serif, serif)', fontWeight: 700,
            color: fc.color, transition: 'color 0.4s ease',
          }}>{ft.replace(/_/g, ' ')}</span>
          <span style={{
            fontSize: 22, opacity: 0.8, color: fc.color, letterSpacing: -4,
          }}>{fc.arrow}</span>
        </div>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2,
        }}>
          Close {bar.close?.toLocaleString()} &middot; RSI {bar.rsi_14?.toFixed(0) ?? '—'}
        </div>
        {flags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {flags.map((f) => <FlagChip key={f.label} label={f.label} color={f.color} />)}
          </div>
        )}
      </div>

      {/* Volume Bars */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--kd-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <VolumeBar label="RVOL" value={bar.rvol ?? 0} max={8} />
        <VolumeBar label="TVOL" value={bar.tvol ?? 0} max={4} />
      </div>

      {/* RSS Section */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--kd-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <span style={{
              fontSize: 14, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
              color: rssColor,
            }}>{rss.value?.toFixed(0) ?? '—'}</span>
            <div style={{
              fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>RSS</div>
          </div>
          <div style={{ width: 1, height: 28, background: 'var(--kd-border)' }} />
          <RssArc value={rss.value ?? 0} color={rssColor} />
          <div style={{
            fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase', color: rssColor,
          }}>
            {rss.zone} {rss.slope > 5 ? '↑' : rss.slope < -5 ? '↓' : '→'}
          </div>
        </div>

        {/* Spread bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{
            width: 48, fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase', color: 'var(--text-muted)', flexShrink: 0,
          }}>Spread</span>
          <div style={{
            flex: 1, height: 4, background: 'var(--kd-bg)', borderRadius: 2,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', left: '50%', width: 1, top: -2, bottom: -2,
              background: 'var(--kd-border)',
            }} />
            {(rss.spread ?? 0) >= 0 ? (
              <div style={{
                position: 'absolute', left: '50%', height: '100%',
                width: `${Math.min(50, Math.abs(rss.spread ?? 0) / 2000 * 50)}%`,
                background: 'var(--risk-green)', borderRadius: 2,
              }} />
            ) : (
              <div style={{
                position: 'absolute', right: '50%', height: '100%',
                width: `${Math.min(50, Math.abs(rss.spread ?? 0) / 2000 * 50)}%`,
                background: 'var(--risk-red)', borderRadius: 2,
              }} />
            )}
          </div>
          <span style={{
            width: 40, textAlign: 'right', fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            color: (rss.spread ?? 0) > 0 ? 'var(--risk-green)'
              : rss.spreadNarrowing ? 'var(--accent-gold)' : 'var(--risk-red)',
          }}>
            {(rss.spread ?? 0) > 0 ? '+' : ''}{rss.spread?.toFixed(0) ?? '—'}
          </span>
        </div>

        {/* Sparkline */}
        <div style={{ marginTop: 6 }}>
          <RssSparkline history={rssHistory} color={rssColor} />
        </div>

        {/* Pump warning */}
        {rss.pumpRisk && (
          <div style={{
            marginTop: 6, padding: '4px 8px', borderRadius: 6,
            fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase',
            background: 'color-mix(in srgb, var(--risk-red) 10%, transparent)',
            color: 'var(--risk-red)',
            border: '1px solid color-mix(in srgb, var(--risk-red) 30%, transparent)',
          }}>
            RSS overbought on broken structure — pump signature
          </div>
        )}
      </div>

      {/* Narrative */}
      <div style={{
        padding: '8px 14px 10px', borderTop: '1px solid var(--kd-border)',
        fontSize: 10, fontStyle: 'italic', color: 'var(--text-secondary)',
        lineHeight: 1.5, minHeight: 36,
      }}>{narrative}</div>
    </div>
  );
}
