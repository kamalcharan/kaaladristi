import { useMemo, useState, useEffect, useRef, useCallback } from 'react';

/**
 * RotationGraph — RRG-style level × momentum rotation with a trailing tail,
 * split into four quadrants. Two variants:
 *   'rs'      — single instrument: Magic RS (level) × its momentum (Leading /
 *               Weakening / Lagging / Improving).
 *   'breadth' — an index/market: breadth participation (level) × breadth ROC
 *               (Expanding / Slowing / Contracting / Turning).
 *
 * The caller supplies {date, level, momentum} points; the graph auto-scales
 * around zero. SEBI-safe: observational only — quadrant names describe measured
 * level and momentum, never a buy/sell view or price forecast. The latest-reading
 * panel is framed as a VaNi response.
 */

export interface RotationPoint {
  date: string;
  level: number | null;
  momentum: number | null;
}

interface RotationGraphProps {
  points: RotationPoint[];
  tail?: number;
  variant?: 'rs' | 'breadth';
  benchmark?: string;   // rs only — the RS benchmark (e.g. 'NIFTY 500')
  title?: string;
  /** Neutral value that divides the level axis (0 for Magic RS, ~50 for breadth score). */
  levelCenter?: number;
  /** Trace the path once on mount (respects prefers-reduced-motion). */
  autoPlay?: boolean;
  /** Playback duration in seconds (default 7). */
  playSeconds?: number;
}

const TEAL = '#2dd4bf';
type Pos = 'hi_up' | 'hi_dn' | 'lo_dn' | 'lo_up';
interface QuadInfo { name: string; color: string; sub: string }

interface VariantCfg {
  subtitle: string;
  levelName: string;
  levelUp: string;
  levelDn: string;
  posPos: string;   // reading word when level ≥ 0
  posNeg: string;   // reading word when level < 0
  quad: Record<Pos, QuadInfo>;
  showBenchmark: boolean;
}

const VARIANTS: Record<'rs' | 'breadth', VariantCfg> = {
  rs: {
    subtitle: 'Magic RS × its momentum',
    levelName: 'Magic RS',
    levelUp: 'MAGIC RS ↑ (stronger)', levelDn: '(weaker) ↓',
    posPos: 'positive', posNeg: 'negative',
    showBenchmark: true,
    quad: {
      hi_up: { name: 'Leading',   color: 'var(--risk-green)', sub: 'RS positive · rising'  },
      hi_dn: { name: 'Weakening', color: 'var(--risk-amber)', sub: 'RS positive · slowing' },
      lo_dn: { name: 'Lagging',   color: 'var(--risk-red)',   sub: 'RS negative · falling' },
      lo_up: { name: 'Improving', color: TEAL,                sub: 'RS negative · rising'  },
    },
  },
  breadth: {
    subtitle: 'Breadth participation × its momentum',
    levelName: 'Breadth',
    levelUp: 'BREADTH ↑ (broad)', levelDn: '(narrow) ↓',
    posPos: 'broad', posNeg: 'narrow',
    showBenchmark: false,
    quad: {
      hi_up: { name: 'Expanding',   color: 'var(--risk-green)', sub: 'broad · rising'   },
      hi_dn: { name: 'Slowing',     color: 'var(--risk-amber)', sub: 'broad · fading'   },
      lo_dn: { name: 'Contracting', color: 'var(--risk-red)',   sub: 'narrow · falling' },
      lo_up: { name: 'Turning',     color: TEAL,                sub: 'narrow · rising'  },
    },
  },
};

function posOf(level: number | null, mom: number | null): Pos | null {
  if (level == null || mom == null) return null;
  if (level >= 0) return mom >= 0 ? 'hi_up' : 'hi_dn';
  return mom >= 0 ? 'lo_up' : 'lo_dn';
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

// Plot geometry (SVG viewBox units)
const P = 40, S = 400, C = P + S / 2;

export default function RotationGraph({
  points,
  tail = 22,
  variant = 'rs',
  benchmark = 'NIFTY 500',
  title = 'RS-Rotation',
  levelCenter = 0,
  autoPlay = false,
  playSeconds = 7,
}: RotationGraphProps) {
  const cfg = VARIANTS[variant];
  const [hover, setHover] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const startedRef = useRef(false);

  const model = useMemo(() => {
    const win = points.filter(p => p.level != null && p.momentum != null).slice(-tail);
    if (win.length < 3) return null;
    const maxL = Math.max(...win.map(p => Math.abs(p.level! - levelCenter)), 0.001) * 1.15;
    const maxM = Math.max(...win.map(p => Math.abs(p.momentum!)), 0.001) * 1.15;
    const pts = win.map(p => ({
      ...p,
      x: C + (p.momentum! / maxM) * (S / 2),
      y: C - ((p.level! - levelCenter) / maxL) * (S / 2),
      pos: posOf(p.level! - levelCenter, p.momentum),
    }));
    return { pts };
  }, [points, tail, levelCenter]);

  const n = model?.pts.length ?? 0;
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const replay = useCallback(() => { if (!reduceMotion && n >= 3) setPlayhead(0); }, [reduceMotion, n]);

  // Autoplay once on mount (opt-in)
  useEffect(() => {
    if (autoPlay && !startedRef.current && n >= 3 && !reduceMotion) { startedRef.current = true; setPlayhead(0); }
  }, [autoPlay, n, reduceMotion]);

  // Advance the playhead along the tail, then settle on the static view
  useEffect(() => {
    if (playhead == null || n === 0) return;
    if (playhead >= n - 1) { const t = setTimeout(() => setPlayhead(null), 1000); return () => clearTimeout(t); }
    const per = Math.max(140, (playSeconds * 1000) / n);
    const t = setTimeout(() => setPlayhead(h => (h == null ? null : h + 1)), per);
    return () => clearTimeout(t);
  }, [playhead, n, playSeconds]);

  if (!model) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-[11px] text-muted">Not enough history to plot a rotation for this instrument.</p>
      </div>
    );
  }

  const { pts } = model;
  const upto = playhead != null ? Math.min(playhead, pts.length - 1) : pts.length - 1;
  const visible = pts.slice(0, upto + 1);
  const tipIndex = playhead != null ? upto : hover;   // auto-tooltip while playing
  const today = pts[pts.length - 1];
  const q = today.pos ? cfg.quad[today.pos] : null;
  const trailPoints = visible.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const posWord = today.level != null && today.level >= levelCenter ? cfg.posPos : cfg.posNeg;
  const momWord = today.momentum != null && today.momentum >= 0 ? 'rising' : 'slowing';

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
          <span className="text-[10px] text-muted">{cfg.subtitle} · last {pts.length} sessions · observational</span>
        </div>
        <div className="flex items-center gap-2">
          {cfg.showBenchmark && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: TEAL, border: `1px solid color-mix(in srgb, ${TEAL} 34%, transparent)`, background: `color-mix(in srgb, ${TEAL} 8%, transparent)` }}>
              vs {benchmark}
            </span>
          )}
          {q && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: q.color, border: `1px solid color-mix(in srgb, ${q.color} 40%, transparent)`, background: `color-mix(in srgb, ${q.color} 12%, transparent)` }}>
              {q.name}
            </span>
          )}
          {!reduceMotion && (
            <button onClick={replay} title="Replay the rotation path"
              className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: 'var(--vani, #9d8ff9)', cursor: 'pointer',
                border: '1px solid color-mix(in srgb, var(--vani, #9d8ff9) 30%, transparent)',
                background: 'color-mix(in srgb, var(--vani, #9d8ff9) 8%, transparent)' }}>
              {playhead != null ? '▶ playing' : '▶ replay'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[280px]">
          <svg viewBox="0 0 480 480" width="100%" style={{ display: 'block', height: 'auto' }}
            role="img" aria-label={`Rotation graph. Latest reading in the ${q?.name ?? 'n/a'} quadrant.`}>
            {/* quadrant fills — corners: TR/TL/BL/BR = hi_up/hi_dn/lo_dn/lo_up */}
            <rect x={C} y={P} width={S/2} height={S/2} fill={cfg.quad.hi_up.color} opacity=".06"/>
            <rect x={P} y={P} width={S/2} height={S/2} fill={cfg.quad.hi_dn.color} opacity=".07"/>
            <rect x={P} y={C} width={S/2} height={S/2} fill={cfg.quad.lo_dn.color} opacity=".06"/>
            <rect x={C} y={C} width={S/2} height={S/2} fill={cfg.quad.lo_up.color} opacity=".05"/>

            <rect x={P} y={P} width={S} height={S} fill="none" stroke="color-mix(in srgb, var(--text-primary) 8%, transparent)"/>
            <line x1={C} y1={P} x2={C} y2={P+S} stroke="color-mix(in srgb, var(--text-primary) 16%, transparent)" strokeDasharray="4 4"/>
            <line x1={P} y1={C} x2={P+S} y2={C} stroke="color-mix(in srgb, var(--text-primary) 16%, transparent)" strokeDasharray="4 4"/>

            {/* quadrant labels */}
            <text x={P+S-10} y={P+26} textAnchor="end" fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={cfg.quad.hi_up.color}>{cfg.quad.hi_up.name.toUpperCase()}</text>
            <text x={P+S-10} y={P+40} textAnchor="end" fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{cfg.quad.hi_up.sub}</text>
            <text x={P+10} y={P+26} fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={cfg.quad.hi_dn.color}>{cfg.quad.hi_dn.name.toUpperCase()}</text>
            <text x={P+10} y={P+40} fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{cfg.quad.hi_dn.sub}</text>
            <text x={P+10} y={P+S-16} fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={cfg.quad.lo_dn.color}>{cfg.quad.lo_dn.name.toUpperCase()}</text>
            <text x={P+10} y={P+S-3} fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{cfg.quad.lo_dn.sub}</text>
            <text x={P+S-10} y={P+S-16} textAnchor="end" fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={cfg.quad.lo_up.color}>{cfg.quad.lo_up.name.toUpperCase()}</text>
            <text x={P+S-10} y={P+S-3} textAnchor="end" fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-faint)">{cfg.quad.lo_up.sub}</text>

            {/* axis captions */}
            <text x={C} y={P-12} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">{cfg.levelUp}</text>
            <text x={C} y={P+S+22} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">{cfg.levelDn}</text>
            <text x={P+S+8} y={C+3} textAnchor="start" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">momentum →</text>
            <text x={P-8} y={C+3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono, monospace)" fill="var(--text-muted)">← slowing</text>

            {/* trail (reveals up to the playhead while animating) */}
            <polyline points={trailPoints} fill="none" stroke="color-mix(in srgb, var(--text-primary) 28%, transparent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {visible.map((p, i) => {
              const isHead = i === upto;
              const t = pts.length > 1 ? i / (pts.length - 1) : 1;
              const color = p.pos ? cfg.quad[p.pos].color : 'var(--text-muted)';
              const on = tipIndex === i;
              if (isHead) {
                const atToday = upto === pts.length - 1;
                return (
                  <g key={p.date}>
                    <circle cx={p.x} cy={p.y} r={16} fill={color} opacity={0.14}/>
                    <circle cx={p.x} cy={p.y} r={9} fill={color} stroke="var(--kd-bg, #0a0e0c)" strokeWidth={on ? 3 : 2}/>
                    {atToday && <text x={p.x} y={p.y + 30} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={color}>LATEST</text>}
                  </g>
                );
              }
              return <circle key={p.date} cx={p.x} cy={p.y} r={(on ? 6.5 : 2.4 + t * 3.6).toFixed(2)}
                fill={color} opacity={(on ? 1 : 0.2 + t * 0.7).toFixed(2)}/>;
            })}

            {/* hit targets (hover disabled while animating) + tooltip */}
            {playhead == null && pts.map((p, i) => (
              <circle key={`hit-${p.date}`} cx={p.x} cy={p.y} r={10} fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
            {tipIndex != null && (() => {
              const p = pts[tipIndex];
              const qc = p.pos ? cfg.quad[p.pos] : null;
              const w = 138, h = 66;
              let tx = p.x + 12, ty = p.y - h - 8;
              if (tx + w > P + S) tx = p.x - w - 12;
              if (ty < P) ty = p.y + 12;
              const L = (n: number) => ty + 16 + n * 14;
              return (
                <g pointerEvents="none">
                  <rect x={tx} y={ty} width={w} height={h} rx={6}
                    fill="var(--card, #101613)" stroke="color-mix(in srgb, var(--text-primary) 18%, transparent)"/>
                  <text x={tx + 10} y={L(0)} fontSize="10" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="var(--text-primary)">{fmtDate(p.date)}</text>
                  <text x={tx + 10} y={L(1)} fontSize="9.5" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={qc?.color ?? 'var(--text-muted)'}>{qc?.name ?? '—'}</text>
                  <text x={tx + 10} y={L(2)} fontSize="9.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-secondary)">{cfg.levelName}  {p.level!.toFixed(2)}</text>
                  <text x={tx + 10} y={L(3)} fontSize="9.5" fontFamily="var(--font-mono, monospace)" fill="var(--text-secondary)">Momentum  {p.momentum! >= 0 ? '+' : ''}{p.momentum!.toFixed(2)}</text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* VaNi reading + quadrant key */}
        <div className="flex-1 min-w-[190px] flex flex-col gap-2.5">
          {q && (
            <div className="rounded-lg p-3"
              style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--vani, #9d8ff9) 9%, var(--card)) 0%, var(--card) 70%)',
                       border: '1px solid color-mix(in srgb, var(--vani, #9d8ff9) 28%, transparent)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)', boxShadow: '0 2px 8px rgba(124,106,247,.4)' }}>V</span>
                <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: 'var(--vani, #9d8ff9)' }}>VaNi · read</span>
              </div>
              <div className="text-[15px] font-bold" style={{ color: q.color }}>{q.name}</div>
              <div className="text-[11px] text-muted mt-1 leading-snug">
                {cfg.levelName} {today.level!.toFixed(2)} ({posWord}); its momentum is {momWord}.
                {cfg.showBenchmark ? ` Measured against ${benchmark}.` : ''} Observational only.
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {(['hi_up','hi_dn','lo_dn','lo_up'] as Pos[]).map(k => (
              <div key={k} className="flex items-center gap-2 text-[11px] text-muted">
                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: cfg.quad[k].color }} />
                {cfg.quad[k].name} — {cfg.quad[k].sub}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[9px] text-faint mt-3 leading-relaxed">
        Observational {variant === 'rs' ? `relative-strength analytics vs ${benchmark}` : 'breadth-participation analytics'} —
        {' '}{cfg.levelName.toLowerCase()} and its recent momentum, historical data only. Not investment advice, not a
        recommendation, and not a forecast of price. Quadrant names describe measured {cfg.levelName.toLowerCase()} and
        momentum, not a directional view.
      </div>
    </div>
  );
}
