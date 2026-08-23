/**
 * AnnotationOverlay — the ONE editorial annotation layer that renders
 * cycle bands, setup levels, persona callouts, promoted story events,
 * Big Money badges, and storyEvent pins on top of any lightweight-charts
 * instance. Story View and Story Play both wrap TradingChart in this
 * same overlay, so setup annotations look IDENTICAL across the toggle
 * and the code lives in exactly one place.
 *
 * Structure: an absolutely-positioned wrapper div matching the chart
 * canvas. Inside it:
 *   · an SVG layer — cycle bands, level segments, pins, Big Money
 *     badges, leader lines, numbered anchor badges
 *   · HTML callout boxes — same visual language as Story Play's
 *     storyBubble (verdict-hero background, colored left border)
 *
 * Placement engine: every box (persona callout or promoted story event)
 * is laid out through one collision engine that avoids (a) other boxes,
 * (b) Big Money badges, and (c) the CANDLE ENVELOPE — a sampled
 * silhouette of the visible price bars — so callouts land in empty sky
 * instead of on top of the price action (reference-deck grammar).
 *
 * Setup levels render as SHORT right-edge segments with compact labels,
 * not full-width lines — five full-width lines read as generic S/R
 * clutter and drowned the story (owner feedback).
 *
 * Pointer events: none. The chart underneath handles all interactions.
 */

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

// ── Public shapes the parent (ChartView) hands in ────────────────────────

export interface OverlayCycleBand {
  from: string;
  to: string;
  label: string;
  tone: 'bull' | 'bear' | 'neutral';
}

export interface OverlayLevel {
  price: number;
  label: string;   // "Major Resistance" — compacted for display
  tone: 'bull' | 'bear' | 'neutral';
}

export interface OverlayCallout {
  persona: 'lt' | 'swing';
  n: number;
  price: number;
  labelShort: string;
  /** ISO date of the bar this zone anchors to. */
  anchorDate?: string;
}

export interface OverlayBigMoney {
  trade_date: string;
  price: number;
  amountCr: number;
  count: number;
}

export interface OverlayStoryPin {
  trade_date: string;
  kind: 'flow' | 'conviction' | 'stage' | 'magic_rs' | 'big_money' | 'rs_breakaway' | 'fpb' | 'scan' | 'sector';
  title: string;
  tone: 'bull' | 'bear' | 'neutral';
  price: number;
  /** Promoted events render as slim callout boxes (top-priority story
   *  beats); the rest stay as dots on the price line. */
  promote?: boolean;
}

interface Props {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  container: HTMLDivElement;
  cycleBands?: OverlayCycleBand[];
  levels?: OverlayLevel[];
  callouts?: OverlayCallout[];
  bigMoney?: OverlayBigMoney[];
  storyPins?: OverlayStoryPin[];
}

// ── Design tokens (resolved from Kāla-Drishti CSS vars) ─────────────────

const TOK = {
  ground:   'var(--card)',
  ink:      'var(--text-primary)',
  ink2:     'var(--text-secondary)',
  ink3:     'var(--text-muted)',
  rule:     'var(--border)',
  gold:     'var(--gold-soft)',
  bull:     'var(--risk-green)',
  bear:     'var(--risk-red)',
  lt:       'var(--accent-indigo)',
  sw:       'var(--risk-amber)',
  bubbleBg: 'var(--verdict-hero-bg)',
  bubbleText: 'var(--verdict-hero-text)',
  bubbleMuted: 'var(--verdict-hero-muted)',
  bandBull: 'var(--story-band-bull)',
  bandBear: 'var(--story-band-bear)',
  bandNeut: 'var(--story-band-neut)',
  bandTxtBull: 'var(--story-band-text-bull)',
  bandTxtBear: 'var(--story-band-text-bear)',
  bandTxtNeut: 'var(--story-band-text-neut)',
} as const;

const BOX_W = 152;
const BOX_H = 40;
const EBOX_W = 140;   // promoted story-event box (single row)
const EBOX_H = 24;
const BOX_GAP = 6;
const AXIS_W = 70;    // approx right price-axis width to keep clear of

const PIN_COLOR: Record<OverlayStoryPin['kind'], string> = {
  flow: TOK.bull,
  conviction: 'var(--story-conviction)',
  stage: TOK.sw,
  magic_rs: TOK.lt,
  big_money: TOK.gold,
  rs_breakaway: 'var(--story-rsbreakaway)',
  fpb: 'var(--story-fpb)',
  scan: 'var(--story-scan)',
  sector: 'var(--story-sector)',
};

/** Compact display form for setup level labels on the segment rail. */
function shortLevel(label: string): string {
  const map: Record<string, string> = {
    'Major Resistance':     'MAJOR R',
    'Immediate Resistance': 'IMM R',
    'Immediate Support':    'IMM S',
    'Strong Support':       'STRONG S',
    'Pivot':                'PIVOT',
    '50 EMA (weekly)':      '50 EMA',
  };
  return map[label] ?? label.toUpperCase();
}

interface Rect { x0: number; y0: number; x1: number; y1: number }

export function AnnotationOverlay({ chart, series, container, cycleBands = [], levels = [], callouts = [], bigMoney = [], storyPins = [] }: Props) {
  const [size, setSize] = useState(() => ({
    width: container.clientWidth || 0,
    height: container.clientHeight || 0,
  }));
  const [, force] = useState(0);
  const bumpRef = useRef(0);
  const bump = () => force(++bumpRef.current);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setSize({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(container);
    setSize({ width: container.clientWidth, height: container.clientHeight });
    return () => ro.disconnect();
  }, [container]);

  useEffect(() => {
    const ts = chart.timeScale();
    const handler = () => bump();
    ts.subscribeVisibleTimeRangeChange(handler);
    ts.subscribeVisibleLogicalRangeChange(handler);
    return () => {
      ts.unsubscribeVisibleTimeRangeChange(handler);
      ts.unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, [chart]);

  const priceToY = (p: number): number | null => {
    const y = series.priceToCoordinate(p);
    return y == null || !Number.isFinite(y) ? null : y;
  };
  const timeToX = (iso: string): number | null => {
    const x = chart.timeScale().timeToCoordinate(iso as unknown as Time);
    return x == null || !Number.isFinite(x) ? null : x;
  };

  // ── Candle envelope: sampled silhouette of visible bars, so boxes
  //    can avoid landing on the price action ─────────────────────────────
  const envelope: Array<{ x: number; y0: number; y1: number }> = [];
  let envColW = 10;
  try {
    const lr = chart.timeScale().getVisibleLogicalRange();
    const all = series.data() as Array<{ time: Time; high?: number; low?: number }>;
    if (lr && all.length > 0) {
      const from = Math.max(0, Math.floor(lr.from));
      const to = Math.min(all.length - 1, Math.ceil(lr.to));
      const stride = Math.max(1, Math.floor((to - from) / 140));
      for (let i = from; i <= to; i += stride) {
        const bar = all[i];
        if (bar?.high == null || bar?.low == null) continue; // whitespace pad
        const x = chart.timeScale().timeToCoordinate(bar.time);
        const yH = series.priceToCoordinate(bar.high);
        const yL = series.priceToCoordinate(bar.low);
        if (x == null || yH == null || yL == null) continue;
        envelope.push({ x, y0: Math.min(yH, yL), y1: Math.max(yH, yL) });
      }
      if (envelope.length > 1) envColW = Math.abs(envelope[1].x - envelope[0].x) + 2;
    }
  } catch { /* envelope is best-effort — placement degrades gracefully */ }

  const hitsCandles = (r: Rect): boolean =>
    envelope.some((c) => c.x >= r.x0 - envColW && c.x <= r.x1 + envColW && r.y0 < c.y1 + 4 && r.y1 > c.y0 - 4);

  // ── Layer 1: cycle bands ─────────────────────────────────────────────
  const bandRects = cycleBands.map((b) => {
    const x0 = timeToX(b.from);
    const x1 = timeToX(b.to);
    if (x0 == null && x1 == null) return null;
    const left = Math.max(0, Math.min(x0 ?? 0, x1 ?? size.width));
    const right = Math.min(size.width, Math.max(x0 ?? 0, x1 ?? size.width));
    const width = right - left;
    if (width < 2) return null;
    const fill = b.tone === 'bull' ? TOK.bandBull : b.tone === 'bear' ? TOK.bandBear : TOK.bandNeut;
    const textFill = b.tone === 'bull' ? TOK.bandTxtBull : b.tone === 'bear' ? TOK.bandTxtBear : TOK.bandTxtNeut;
    const availH = size.height - 40;
    const chars = b.label.length;
    const fontSize = Math.max(11, Math.min(availH / (chars * 0.95), width * 0.35, 22));
    return { left, width, fill, textFill, label: b.label, fontSize };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // ── Layer 2: setup levels as SHORT right-edge segments ───────────────
  // Anti-collide the labels vertically (levels cluster on tight setups).
  const segX0 = size.width * 0.74;
  const segX1 = size.width - AXIS_W + 4;
  const levelSegs: Array<{ y: number; labelY: number; color: string; price: number; label: string }> = [];
  {
    const sorted = levels
      .map((l) => ({ ...l, y: priceToY(l.price) }))
      .filter((l): l is typeof l & { y: number } => l.y != null && l.y >= 0 && l.y <= size.height)
      .sort((a, b) => a.y - b.y);
    let lastLabelY = -Infinity;
    for (const l of sorted) {
      const color = l.tone === 'bull' ? TOK.bull : l.tone === 'bear' ? TOK.bear : TOK.ink3;
      const labelY = Math.max(l.y, lastLabelY + 11);
      lastLabelY = labelY;
      levelSegs.push({ y: l.y, labelY, color, price: l.price, label: shortLevel(l.label) });
    }
  }

  // ── Layer 3: story pins ──────────────────────────────────────────────
  const plainPins = storyPins.filter((p) => !p.promote).map((p) => {
    const x = timeToX(p.trade_date);
    const y = priceToY(p.price);
    if (x == null || y == null) return null;
    if (x < 0 || x > size.width || y < 0 || y > size.height) return null;
    return { x, y, color: PIN_COLOR[p.kind] ?? TOK.gold };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // ── Layer 4: Big Money badges (top rail, staggered rows) ─────────────
  const bmBadges = bigMoney.map((b) => {
    const x = timeToX(b.trade_date);
    const yTip = priceToY(b.price);
    if (x == null || yTip == null) return null;
    if (x < 0 || x > size.width || yTip < 0 || yTip > size.height) return null;
    const text = b.count > 1
      ? `₹${b.amountCr.toFixed(0)}Cr · ${b.count}d`
      : `₹${b.amountCr.toFixed(b.amountCr >= 10 ? 0 : 1)}Cr`;
    return { x, yTip, text, boxW: text.length * 5.6 + 14, row: 0 };
  }).filter((v): v is NonNullable<typeof v> => v !== null);
  {
    let lastRight = -Infinity;
    for (const b of bmBadges) {
      b.row = (b.x - b.boxW / 2) < lastRight + 4 ? 1 : 0;
      if (b.row === 0) lastRight = b.x + b.boxW / 2;
    }
  }

  // ── Shared box-placement engine ──────────────────────────────────────
  const placed: Rect[] = [];
  // Big Money badges are obstacles for every box.
  for (const b of bmBadges) {
    const y = 12 + b.row * 18;
    placed.push({ x0: b.x - b.boxW / 2, y0: y - 6, x1: b.x + b.boxW / 2, y1: y + 8 });
  }
  const intersectsPlaced = (r: Rect) =>
    placed.some((p) => r.x0 < p.x1 + BOX_GAP && r.x1 > p.x0 - BOX_GAP && r.y0 < p.y1 + BOX_GAP && r.y1 > p.y0 - BOX_GAP);

  const placeBox = (ax: number, ay: number, W: number, H: number): { bx: number; by: number } => {
    const maxBx = size.width - AXIS_W - W;
    const clampBx = (x: number) => Math.max(4, Math.min(maxBx, x));
    const clampBy = (y: number) => Math.max(4, Math.min(size.height - H - 4, y));
    const preferAbove = ay > size.height / 2;
    const candidates: Array<{ bx: number; by: number }> = [];
    const vertical = (above: boolean, step: number) => ({
      bx: clampBx(ax - W / 2),
      by: above ? ay - 16 - H - step * (H + BOX_GAP) : ay + 16 + step * (H + BOX_GAP),
    });
    for (let s = 0; s < 3; s++) {
      candidates.push(vertical(preferAbove, s));
      candidates.push(vertical(!preferAbove, s));
    }
    for (let s = 0; s < 8; s++) {
      for (const dy of [0, -(H + BOX_GAP), H + BOX_GAP, -2 * (H + BOX_GAP), 2 * (H + BOX_GAP)]) {
        candidates.push({ bx: clampBx(ax - 20 - W - s * (W * 0.4)), by: clampBy(ay - H / 2 + dy) });
      }
    }
    const inBounds = (c: { bx: number; by: number }) => c.by >= 4 && c.by + H <= size.height - 4;
    // Pass 1: avoid boxes AND candles. Pass 2: avoid boxes only.
    for (const pass of [true, false]) {
      for (const c of candidates) {
        if (!inBounds(c)) continue;
        const rect = { x0: c.bx, y0: c.by, x1: c.bx + W, y1: c.by + H };
        if (intersectsPlaced(rect)) continue;
        if (pass && hitsCandles(rect)) continue;
        placed.push(rect);
        return c;
      }
    }
    const fb = { bx: clampBx(ax - W / 2), by: clampBy(ay - H / 2) };
    placed.push({ x0: fb.bx, y0: fb.by, x1: fb.bx + W, y1: fb.by + H });
    return fb;
  };

  // ── Persona callouts through the engine ──────────────────────────────
  interface LaidBox { ax: number; ay: number; bx: number; by: number; color: string }
  const laidCallouts: Array<LaidBox & { persona: 'lt' | 'swing'; n: number; price: number; labelShort: string }> = [];
  {
    const withAnchor = callouts
      .map((c) => {
        const ax = c.anchorDate ? timeToX(c.anchorDate) : null;
        const ay = priceToY(c.price);
        if (ax == null || ay == null) return null;
        if (ax < 0 || ax > size.width) return null;
        return { ...c, ax, ay: Math.max(6, Math.min(size.height - 6, ay)), color: c.persona === 'lt' ? TOK.lt : TOK.sw };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.ax - b.ax);
    for (const c of withAnchor) {
      const spot = placeBox(c.ax, c.ay, BOX_W, BOX_H);
      laidCallouts.push({ persona: c.persona, n: c.n, price: c.price, labelShort: c.labelShort, color: c.color, ax: c.ax, ay: c.ay, bx: spot.bx, by: spot.by });
    }
  }

  // ── Promoted story events through the same engine ────────────────────
  const laidEvents: Array<LaidBox & { title: string; glyph: string; glyphColor: string }> = [];
  {
    const promoted = storyPins
      .filter((p) => p.promote)
      .map((p) => {
        const ax = timeToX(p.trade_date);
        const ay = priceToY(p.price);
        if (ax == null || ay == null) return null;
        if (ax < 0 || ax > size.width || ay < 0 || ay > size.height) return null;
        return { ...p, ax, ay, color: PIN_COLOR[p.kind] ?? TOK.gold };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.ax - b.ax);
    for (const p of promoted) {
      const spot = placeBox(p.ax, p.ay, EBOX_W, EBOX_H);
      laidEvents.push({
        ax: p.ax, ay: p.ay, bx: spot.bx, by: spot.by, color: p.color,
        title: p.title,
        glyph: p.tone === 'bull' ? '▲' : p.tone === 'bear' ? '▼' : '•',
        glyphColor: p.tone === 'bull' ? TOK.bull : p.tone === 'bear' ? TOK.bear : TOK.ink3,
      });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        // lightweight-charts' internal canvases carry explicit z-index
        // (1/2) — without a higher z-index the chart paints OVER the
        // overlay and every annotation is invisible.
        zIndex: 10,
      }}
    >
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}>
        {/* cycle bands */}
        {bandRects.map((c, i) => {
          const midX = c.left + c.width / 2;
          const midY = size.height / 2;
          return (
            <g key={`band-${i}`}>
              <rect x={c.left} y={0} width={c.width} height={size.height} fill={c.fill} />
              {i > 0 && (
                <line x1={c.left} y1={0} x2={c.left} y2={size.height}
                  stroke={`color-mix(in srgb, ${TOK.rule} 90%, transparent)`} strokeDasharray="2 4" />
              )}
              {c.width > 40 && (
                <g transform={`translate(${midX} ${midY}) rotate(-90)`}>
                  <text textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight={600}
                    fontSize={c.fontSize} letterSpacing="0.06em" fill={c.textFill}
                    style={{ textTransform: 'uppercase' }}>
                    {c.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* setup level segments — short right-edge rails, not full-width */}
        {levelSegs.map((l, i) => (
          <g key={`lvl-${i}`}>
            <line x1={segX0} x2={segX1} y1={l.y} y2={l.y} stroke={l.color} strokeWidth={1.2} opacity={0.8} />
            {Math.abs(l.labelY - l.y) > 1 && (
              <line x1={segX0 - 3} y1={l.y} x2={segX0 - 26} y2={l.labelY - 3} stroke={l.color} strokeWidth={0.5} opacity={0.5} />
            )}
            <text x={segX0 - 30} y={l.labelY} textAnchor="end"
              fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize={9} fontWeight={600} fill={l.color}>
              {Math.round(l.price)}
              <tspan dx={5} fontFamily="Inter, system-ui, sans-serif" fontSize={7.5} fontWeight={600} letterSpacing="0.1em" fill={TOK.ink3}>
                {l.label}
              </tspan>
            </text>
          </g>
        ))}

        {/* plain story pins */}
        {plainPins.map((p, i) => (
          <circle key={`pin-${i}`} cx={p.x} cy={p.y} r={4} fill={p.color} opacity={0.9}
            stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`} strokeWidth={0.7} />
        ))}

        {/* Big Money badges */}
        {bmBadges.map((b, i) => {
          const badgeY = 12 + b.row * 18;
          return (
            <g key={`bm-${i}`}>
              <line x1={b.x} y1={badgeY + 8} x2={b.x} y2={b.yTip - 2}
                stroke={TOK.gold} strokeWidth={0.6} opacity={0.55} strokeDasharray="1 3" />
              <circle cx={b.x} cy={b.yTip - 2} r={2} fill={TOK.gold} />
              <rect x={b.x - b.boxW / 2} y={badgeY - 6} width={b.boxW} height={14} rx={2}
                fill={TOK.ground} stroke={TOK.gold} strokeWidth={0.8} opacity={0.97} />
              <text x={b.x} y={badgeY + 4} textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize={9} fontWeight={700} fill={TOK.gold}>
                {b.text}
              </text>
            </g>
          );
        })}

        {/* leader lines + numbered anchors for persona callouts */}
        {laidCallouts.map((m, i) => {
          const boxCX = m.bx + BOX_W / 2;
          const boxAbove = m.by + BOX_H <= m.ay;
          return (
            <g key={`col-${i}`}>
              <line x1={boxCX} y1={boxAbove ? m.by + BOX_H : m.by}
                x2={m.ax} y2={m.ay + (boxAbove ? -10 : 10)}
                stroke={m.color} strokeWidth={0.8} opacity={0.6} />
              <circle cx={m.ax} cy={m.ay} r={9} fill={m.color} opacity={0.95}
                stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`} strokeWidth={0.5} />
              <text x={m.ax} y={m.ay + 3.5} textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize={10} fontWeight={700} fill={TOK.ground}>
                {m.n}
              </text>
            </g>
          );
        })}

        {/* leader lines + anchor dots for promoted story events */}
        {laidEvents.map((m, i) => {
          const boxCX = m.bx + EBOX_W / 2;
          const boxAbove = m.by + EBOX_H <= m.ay;
          return (
            <g key={`evl-${i}`}>
              <line x1={boxCX} y1={boxAbove ? m.by + EBOX_H : m.by}
                x2={m.ax} y2={m.ay + (boxAbove ? -6 : 6)}
                stroke={m.color} strokeWidth={0.7} opacity={0.55} />
              <circle cx={m.ax} cy={m.ay} r={4.5} fill={m.color}
                stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`} strokeWidth={0.7} />
            </g>
          );
        })}
      </svg>

      {/* HTML persona callout boxes — storyBubble visual language */}
      {laidCallouts.map((m, i) => (
        <div key={`cbox-${i}`} style={{
          position: 'absolute', left: m.bx, top: m.by, width: BOX_W, height: BOX_H,
          background: TOK.bubbleBg, color: TOK.bubbleText,
          border: `1px solid color-mix(in srgb, ${m.color} 55%, transparent)`,
          borderLeft: `3px solid ${m.color}`,
          borderRadius: 8, padding: '5px 9px', boxShadow: 'var(--card-shadow)',
          boxSizing: 'border-box', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
            <span style={{ color: m.color }}>{m.persona === 'lt' ? 'LT' : 'SW'}-{m.n}</span>
            <span style={{ color: TOK.bubbleText, fontWeight: 600 }}>{m.labelShort}</span>
          </div>
          <div style={{ fontSize: 10.5, color: TOK.bubbleMuted, marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }}>
            ₹{Math.round(m.price)} zone
          </div>
        </div>
      ))}

      {/* HTML promoted story-event boxes — slim single row */}
      {laidEvents.map((m, i) => (
        <div key={`ebox-${i}`} style={{
          position: 'absolute', left: m.bx, top: m.by, width: EBOX_W, height: EBOX_H,
          background: TOK.bubbleBg, color: TOK.bubbleText,
          border: `1px solid color-mix(in srgb, ${m.color} 50%, transparent)`,
          borderLeft: `3px solid ${m.color}`,
          borderRadius: 6, padding: '4px 8px', boxShadow: 'var(--card-shadow)',
          boxSizing: 'border-box', overflow: 'hidden',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ color: m.glyphColor, fontSize: 9, flexShrink: 0 }}>{m.glyph}</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: m.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.title}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Shared shortener so both consumers spell zone labels the same way. */
export function shortEntryLabel(label: string): string {
  const map: Record<string, string> = {
    'Structural breakout zone': 'Breakout',
    'Structural pivot zone':    'Pivot / EMA',
    'Continuation zone':        'Continuation',
    'Break-of-pivot zone':      'Break of R1',
    'Mid-range zone':           'Mid-range',
    'Support-test zone':        'Support test',
  };
  return map[label] ?? label;
}
