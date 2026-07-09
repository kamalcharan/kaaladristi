import { useMemo } from 'react';

/**
 * RotationGraph — Relative-Strength Rotation (RRG-style) for a single instrument.
 *
 * Plots relative strength (Magic RS, Y = level) against its momentum
 * (rate-of-change of Magic RS, X) as a dot with a trailing tail, split into four
 * quadrants. Reusable — the caller supplies {date, level, momentum} points; the
 * graph auto-scales around zero.
 *
 * SEBI-safe: observational only. Labels describe measured relative strength and
 * its momentum, never a buy/sell view or price forecast.
 */

export interface RotationPoint {
  date: string;
  level: number | null;      // Magic RS (relative strength)
  momentum: number | null;   // rate-of-change of Magic RS
}

interface RotationGraphProps {
  points: RotationPoint[];   // ascending (oldest → newest)
  tail?: number;             // sessions to plot (default 22)
  benchmark?: string;        // e.g. 'NIFTY 500'
  title?: string;
}

const TEAL = '#2dd4bf';
const QUAD = {
  leading:   { name: 'Leading',   color: 'var(--risk-green)', sub: 'RS positive · rising'  },
  weakening: { name: 'Weakening', color: 'var(--risk-amber)', sub: 'RS positive · slowing' },
  lagging:   { name: 'Lagging',   color: 'var(--risk-red)',   sub: 'RS negative · falling' },
  improving: { name: 'Improving', color: TEAL,                sub: 'RS negative · rising'  },
} as const;
type QuadKey = keyof typeof QUAD;

function quadOf(level: number | null, mom: number | null): QuadKey | null {
  if (level == null || mom == null) return null;
  if (level >= 0) return mom >= 0 ? 'leading' : 'weakening';
  return mom >= 0 ? 'improving' : 'lagging';
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

// Plot geometry (SVG viewBox units)
const P = 40, S = 400, C = P + S / 2;   // padding, size, centre

export default function RotationGraph({
  points,
  tail = 22,
  benchmark = 'NIFTY 500',
  title = 'RS-Rotation',
}: RotationGraphProps) {
  const model = useMemo(() => {
    const win = points.filter(p => p.level != null && p.momentum != null).slice(-tail);
    if (win.length < 3) return null;
    const maxL = Math.max(...win.map(p => Math.abs(p.level!)), 0.001) * 1.15;
    const maxM = Math.max(...win.map(p => Math.abs(p.momentum!)), 0.001) * 1.15;
    const pts = win.map(p => ({
      ...p,
      x: C + (p.momentum! / maxM) * (S / 2),
      y: C - (p.level! / maxL) * (S / 2),
      quad: quadOf(p.level, p.momentum),
    }));
    return { pts };
  }, [points, tail]);

  if (!model) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-[11px] text-muted">Not enough relative-strength history to plot a rotation for this instrument.</p>
      </div>
    );
  }

  const { pts } = model;
  const today = pts[pts.length - 1];
  const q = today.quad ? QUAD[today.quad] : null;
  const trailPoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
          <span className="text-[10px] text-muted">Magic RS × its momentum · last {pts.length} sessions · observational</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: TEAL, border: `1px solid color-mix(in srgb, ${TEAL} 34%, transparent)`, background: `color-mix(in srgb, ${TEAL} 8%, transparent)` }}>
            vs {benchmark}
          </span>
          {q && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: q.color, border: `1px solid color-mix(in srgb, ${q.color} 40%, transparent)`, background: `color-mix(in srgb, ${q.color} 12%, transparent)` }}>
              {q.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[280px]">
          <svg viewBox="0 0 480 480" width="100%" style={{ display: 'block', height: 'auto' }}
            role="img" aria-label={`Relative-strength rotation. Latest reading in the ${q?.name ?? 'n/a'} quadrant.`}>
            {/* quadrant fills */}
            <rect x={C} y={P}   width={S/2} height={S/2} fill="var(--risk-green)" opacity=".06"/>
            <rect x={P} y={P}   width={S/2} height={S/2} fill="var(--risk-amber)" opacity=".07"/>
            <rect x={P} y={C}   width={S/2} height={S/2} fill="var(--risk-red)"   opacity=".06"/>
            <rect x={C} y={C}   width={S/2} height={S/2} fill={TEAL}              opacity=".05"/>

            {/* frame + axes */}
            <rect x={P} y={P} width={S} height={S} fill="none" stroke="color-mix(in srgb, var(--text-primary) 8%, transparent)"/>
            <line x1={C} y1={P} x2={C} y2={P+S} stroke="color-mix(in srgb, var(--text-primary) 16%, transparent)" strokeDasharray="4 4"/>
            <line x1={P} y1={C} x2={P+S} y2={C} stroke="color-mix(in srgb, var(--text-primary) 16%, transparent)" strokeDasharray="4 4"/>

            {/* quadrant labels */}
            <text x={P+S-10} y={P+26} textAnchor="end" fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="var(--risk-green)">LEADING</text>
            <text x={P+S-10} y={P+40} textAnchor="end" fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{QUAD.leading.sub}</text>
            <text x={P+10} y={P+26} fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="var(--risk-amber)">WEAKENING</text>
            <text x={P+10} y={P+40} fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{QUAD.weakening.sub}</text>
            <text x={P+10} y={P+S-16} fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="var(--risk-red)">LAGGING</text>
            <text x={P+10} y={P+S-3} fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{QUAD.lagging.sub}</text>
            <text x={P+S-10} y={P+S-16} textAnchor="end" fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={TEAL}>IMPROVING</text>
            <text x={P+S-10} y={P+S-3} textAnchor="end" fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{QUAD.improving.sub}</text>

            {/* axis captions */}
            <text x={C} y={P-12} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">MAGIC RS ↑ (stronger)</text>
            <text x={C} y={P+S+22} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">(weaker) ↓</text>
            <text x={P+S+8} y={C+3} textAnchor="start" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">RS momentum →</text>
            <text x={P-8} y={C+3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">← slowing</text>

            {/* trail */}
            <polyline points={trailPoints} fill="none" stroke="color-mix(in srgb, var(--text-primary) 28%, transparent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {pts.map((p, i) => {
              const isToday = i === pts.length - 1;
              const t = i / (pts.length - 1);
              const color = p.quad ? QUAD[p.quad].color : 'var(--text-muted)';
              if (isToday) {
                return (
                  <g key={p.date}>
                    <circle cx={p.x} cy={p.y} r={16} fill={color} opacity={0.14}/>
                    <circle cx={p.x} cy={p.y} r={9} fill={color} stroke="var(--kd-bg, #0a0e0c)" strokeWidth="2"/>
                    <text x={p.x} y={p.y + 30} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={color}>LATEST</text>
                  </g>
                );
              }
              return <circle key={p.date} cx={p.x} cy={p.y} r={(2.4 + t * 3.6).toFixed(2)} fill={color} opacity={(0.2 + t * 0.7).toFixed(2)}>
                <title>{`${fmtDate(p.date)} · RS ${p.level!.toFixed(2)} · momentum ${p.momentum!.toFixed(2)}`}</title>
              </circle>;
            })}
          </svg>
        </div>

        {/* Reading + key */}
        <div className="flex-1 min-w-[190px] flex flex-col gap-2.5">
          {q && (
            <div className="rounded-lg p-3" style={{ background: 'var(--card)', border: `1px solid color-mix(in srgb, ${q.color} 26%, transparent)` }}>
              <div className="text-[8px] font-mono uppercase tracking-widest text-faint mb-1">Latest reading</div>
              <div className="text-[16px] font-bold" style={{ color: q.color }}>{q.name}</div>
              <div className="text-[11px] text-muted mt-1 leading-snug">
                Magic RS {today.level!.toFixed(2)} ({today.level! >= 0 ? 'positive' : 'negative'}); its momentum is
                {' '}{today.momentum! >= 0 ? 'rising' : 'slowing'}. Measured against {benchmark} — observational only.
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {(Object.keys(QUAD) as QuadKey[]).map(k => (
              <div key={k} className="flex items-center gap-2 text-[11px] text-muted">
                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: QUAD[k].color }} />
                {QUAD[k].name} — {QUAD[k].sub}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[9px] text-faint mt-3 leading-relaxed">
        Observational relative-strength analytics vs {benchmark} (Magic RS and its recent momentum, historical data only).
        Not investment advice, not a recommendation, and not a forecast of price. Quadrant names describe measured relative
        strength and momentum, not a directional view.
      </div>
    </div>
  );
}
