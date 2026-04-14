import React from 'react';
import type { SmartMoneySignals, DotSignals } from '@/services/visualPulseEngine';

// ── Types ───────────────────────────────────────────────────────

interface SmartMoneyBar {
  sm: number;
  fm: number;
  isSVD: boolean;
  isSBD: boolean;
  isSYD: boolean;
}

// ── Relationship Config ─────────────────────────────────────────

const REL_COLORS: Record<string, string> = {
  'Diverging':      'var(--risk-red)',
  'Smart Leading':  'var(--risk-green)',
  'Aligned':        'var(--accent-indigo)',
  'Absent':         'var(--text-muted)',
  'Fast Only':      'var(--risk-amber)',
  'Mixed':          'var(--text-secondary)',
};

// ── SVG Chart ───────────────────────────────────────────────────

function SmChart({ history }: { history: SmartMoneyBar[] }) {
  const n = history.length;
  if (n < 2) return null;

  const w = 340, h = 80;
  const pad = { l: 4, r: 4, t: 8, b: 8 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const maxY = 50;

  const toX = (i: number) => pad.l + (i / (n - 1)) * pw;
  const toY = (v: number) => pad.t + ph * (1 - Math.min(v, maxY) / maxY);

  const smPoints = history.map((b, i) => `${toX(i)},${toY(b.sm)}`).join(' ');
  const fmPoints = history.map((b, i) => `${toX(i)},${toY(b.fm)}`).join(' ');

  // Area fills
  const smArea = `M ${toX(0)},${toY(0)} ${history.map((b, i) => `L ${toX(i)},${toY(b.sm)}`).join(' ')} L ${toX(n - 1)},${toY(0)} Z`;
  const fmArea = `M ${toX(0)},${toY(0)} ${history.map((b, i) => `L ${toX(i)},${toY(b.fm)}`).join(' ')} L ${toX(n - 1)},${toY(0)} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ background: 'var(--kd-bg)', borderRadius: 4 }}>
      {/* Grid lines */}
      {[10, 25, 40].map((v) => (
        <line key={v} x1={pad.l} y1={toY(v)} x2={w - pad.r} y2={toY(v)}
          stroke="var(--kd-border)" strokeWidth={0.5} />
      ))}

      {/* Area fills */}
      <path d={smArea} fill="var(--risk-red)" opacity={0.06} />
      <path d={fmArea} fill="var(--risk-amber)" opacity={0.06} />

      {/* Lines */}
      <polyline points={smPoints} fill="none" stroke="var(--risk-red)"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={fmPoints} fill="none" stroke="var(--risk-amber)"
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="4 2" />

      {/* Dot markers */}
      {history.map((b, i) => (
        <React.Fragment key={i}>
          {b.isSVD && <circle cx={toX(i)} cy={toY(b.sm) - 6} r={4}
            fill="var(--accent-violet)" opacity={0.9} />}
          {b.isSBD && <circle cx={toX(i)} cy={toY(b.sm) - 4} r={3}
            fill="var(--accent-indigo)" opacity={0.8} />}
          {b.isSYD && <circle cx={toX(i)} cy={toY(b.fm) + 5} r={3.5}
            fill="var(--risk-amber)" opacity={0.9} />}
        </React.Fragment>
      ))}

      {/* Current bar marker */}
      <line x1={toX(n - 1)} y1={pad.t} x2={toX(n - 1)} y2={h - pad.b}
        stroke="var(--accent-gold)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />

      {/* Y-axis labels */}
      {[0, 25, 50].map((v) => (
        <text key={v} x={w - 2} y={toY(v) + 3} textAnchor="end"
          fill="var(--text-muted)" fontSize={7} fontFamily="var(--font-mono, monospace)">{v}</text>
      ))}
    </svg>
  );
}

// ── Dot Timeline ────────────────────────────────────────────────

function DotTimeline({ history }: { history: SmartMoneyBar[] }) {
  const n = history.length;
  const events: { idx: number; type: 'SVD' | 'SBD' | 'SYD'; color: string; size: number }[] = [];

  history.forEach((b, i) => {
    if (b.isSVD) events.push({ idx: i, type: 'SVD', color: 'var(--accent-violet)', size: 12 });
    if (b.isSBD) events.push({ idx: i, type: 'SBD', color: 'var(--accent-indigo)', size: 9 });
    if (b.isSYD) events.push({ idx: i, type: 'SYD', color: 'var(--risk-amber)', size: 9 });
  });

  if (events.length === 0) {
    return (
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0',
      }}>No volume signature events in window</div>
    );
  }

  return (
    <div style={{ height: 32, position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0,
        height: 1, background: 'var(--kd-border)',
      }} />
      {events.map((e, i) => {
        const left = `${(e.idx / (n - 1)) * 100}%`;
        const barsAgo = n - 1 - e.idx;
        return (
          <div key={`${e.type}-${i}`} style={{
            position: 'absolute', left, top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-mono, monospace)', color: e.color,
            }}>{e.type}</span>
            <div style={{
              width: e.size, height: e.size, borderRadius: '50%',
              background: `color-mix(in srgb, ${e.color} 22%, transparent)`,
              border: `1px solid ${e.color}`,
              boxShadow: e.type === 'SVD' ? `0 0 8px ${e.color}` : `0 0 4px ${e.color}`,
            }} />
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-muted)',
            }}>{barsAgo === 0 ? 'now' : `−${barsAgo}`}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Value Block ─────────────────────────────────────────────────

function ValueBlock({ label, value, color, trend }: {
  label: string; value: number | null; color: string; trend?: number;
}) {
  return (
    <div style={{ padding: '6px 10px', textAlign: 'center' }}>
      <div style={{
        fontSize: 12, fontFamily: 'var(--font-mono, monospace)', fontWeight: 500,
        color,
      }}>
        {value?.toFixed(1) ?? '—'}
        {trend != null && (
          <span style={{
            fontSize: 8, marginLeft: 2, whiteSpace: 'nowrap',
            color: trend > 0 ? 'var(--risk-green)' : trend < 0 ? 'var(--risk-red)' : 'var(--text-muted)',
          }}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}{Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

// ── Smart Money Card ────────────────────────────────────────────

interface SmartMoneyCardProps {
  smHistory: SmartMoneyBar[];
  sm: SmartMoneySignals;
  dots: DotSignals[];
  narrative: string;
}

export default function SmartMoneyCard({ smHistory, sm, narrative }: SmartMoneyCardProps) {
  const relColor = REL_COLORS[sm.relationship] ?? 'var(--text-muted)';

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
        }}>Smart Money &middot; Volume Signature</span>
      </div>

      {/* Chart */}
      <div style={{ padding: '8px 14px 4px' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', marginBottom: 4 }}>
          <span><span style={{ color: 'var(--risk-red)' }}>━</span> Smart Money</span>
          <span><span style={{ color: 'var(--risk-amber)' }}>╌</span> Fast Money</span>
        </div>
        <SmChart history={smHistory} />
      </div>

      {/* Values */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
        background: 'var(--kd-border)', borderTop: '1px solid var(--kd-border)',
      }}>
        <div style={{ background: 'var(--kd-surface)' }}>
          <ValueBlock label="Smart Money" value={sm.smartMoney} color="var(--risk-red)" trend={sm.smSlope5} />
        </div>
        <div style={{ background: 'var(--kd-surface)' }}>
          <ValueBlock label="Fast Money" value={sm.fastMoney} color="var(--risk-amber)" trend={sm.fmSlope5} />
        </div>
        <div style={{ background: 'var(--kd-surface)' }}>
          <ValueBlock label="Noise Floor" value={50} color="var(--text-muted)" />
        </div>
      </div>

      {/* Dot Timeline */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--kd-border)' }}>
        <div style={{
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6,
        }}>Volume Signature Events</div>
        <DotTimeline history={smHistory} />
      </div>

      {/* Relationship Badge */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--kd-border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          padding: '3px 10px', borderRadius: 10,
          fontSize: 9, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
          background: `color-mix(in srgb, ${relColor} 22%, transparent)`,
          border: `1px solid color-mix(in srgb, ${relColor} 44%, transparent)`,
          color: relColor,
        }}>{sm.relationship}</span>
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

export type { SmartMoneyBar };
