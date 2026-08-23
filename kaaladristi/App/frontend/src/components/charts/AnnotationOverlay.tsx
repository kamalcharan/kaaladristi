/**
 * AnnotationOverlay — the ONE editorial annotation layer that renders
 * cycle bands, persona callouts, Big Money badges, and storyEvent pins
 * on top of any lightweight-charts instance. Story View and Story Play
 * both wrap TradingChart in this same overlay, so setup annotations look
 * IDENTICAL across the toggle and the code lives in exactly one place.
 *
 * Structure: an absolutely-positioned wrapper div matching the chart
 * canvas. Inside it:
 *   · an SVG layer — cycle bands, story pins, Big Money badges, leader
 *     lines, numbered anchor badges
 *   · HTML callout boxes — same visual language as Story Play's
 *     storyBubble (verdict-hero background, colored left border), so the
 *     two features read as one system
 *
 * Callouts are TIME+PRICE anchored (reference decks: KPL/Solara/Kronox):
 * each zone's numbered badge sits at the bar where price last interacted
 * with that zone, and the box floats beside it with a leader line. They
 * reposition on pan/zoom because coordinates are recomputed from
 * lightweight-charts' priceScale/timeScale on every visible-range change.
 *
 * Pointer events: none. The chart underneath handles all interactions.
 */

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

// ── Public shapes the parent (ChartView) hands in ────────────────────────

export interface OverlayCycleBand {
  from: string;        // ISO date — start of regime
  to: string;          // ISO date — end
  label: string;       // "Old Stage 2 Uptrend" etc.
  tone: 'bull' | 'bear' | 'neutral';
}

export interface OverlayCallout {
  persona: 'lt' | 'swing';
  n: number;
  price: number;
  labelShort: string;  // "Breakout", "Continuation", etc.
  /** ISO date of the bar this zone anchors to — usually the last bar
   *  whose range touched the zone price. The callout renders AT that
   *  location on the chart (reference-deck grammar) instead of stacking
   *  at the right edge. Absent → anchored to the last visible bar. */
  anchorDate?: string;
}

export interface OverlayBigMoney {
  trade_date: string;  // date of the event
  price: number;       // where to anchor the leader tip (usually the bar's high)
  amountCr: number;    // combined ₹ amount
  count: number;       // event count in this cluster
}

export interface OverlayStoryPin {
  trade_date: string;
  kind: 'flow' | 'conviction' | 'stage' | 'magic_rs' | 'big_money' | 'rs_breakaway' | 'fpb' | 'scan' | 'sector';
  title: string;       // "Longs Building", "Conviction Turn"
  tone: 'bull' | 'bear' | 'neutral';
  price: number;       // the bar's close on that date
}

interface Props {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  container: HTMLDivElement;
  cycleBands?: OverlayCycleBand[];
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

/** Callout box dimensions in pixels (mirrors storyBubble proportions). */
const BOX_W = 152;
const BOX_H = 40;
const BOX_GAP = 6;
/** Kind → color for storyEvent pins (mirrors services/storyEvents KIND_COLORS). */
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

export function AnnotationOverlay({ chart, series, container, cycleBands = [], callouts = [], bigMoney = [], storyPins = [] }: Props) {
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

  // Re-render on pan/zoom so annotation coordinates track the chart
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

  // ── Layer 1: cycle bands with rotated serif labels ───────────────────
  const bandRects = cycleBands.map((b) => {
    const x0 = timeToX(b.from);
    const x1 = timeToX(b.to);
    if (x0 == null && x1 == null) return null;
    // Partially-visible band: clamp missing edge to the plot boundary
    const left = Math.max(0, Math.min(x0 ?? 0, x1 ?? size.width));
    const right = Math.min(size.width, Math.max(x0 ?? 0, x1 ?? size.width));
    const width = right - left;
    if (width < 2) return null;
    const fill = b.tone === 'bull' ? TOK.bandBull : b.tone === 'bear' ? TOK.bandBear : TOK.bandNeut;
    const textFill = b.tone === 'bull' ? TOK.bandTxtBull : b.tone === 'bear' ? TOK.bandTxtBear : TOK.bandTxtNeut;
    const availH = size.height - 40;
    const chars = b.label.length;
    const maxByHeight = availH / (chars * 0.95);
    const maxByWidth = width * 0.35;
    const fontSize = Math.max(11, Math.min(maxByHeight, maxByWidth, 22));
    return { left, width, fill, textFill, label: b.label, fontSize };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // ── Layer 2: story pins (small dots on price line at event date) ─────
  const pinPoints = storyPins.map((p) => {
    const x = timeToX(p.trade_date);
    const y = priceToY(p.price);
    if (x == null || y == null) return null;
    if (x < 0 || x > size.width || y < 0 || y > size.height) return null;
    return { x, y, color: PIN_COLOR[p.kind] ?? TOK.gold, kind: p.kind, title: p.title };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // ── Layer 3: Big Money badges pinned to top of plot ──────────────────
  const bmBadges = bigMoney.map((b) => {
    const x = timeToX(b.trade_date);
    const yTip = priceToY(b.price);
    if (x == null || yTip == null) return null;
    if (x < 0 || x > size.width || yTip < 0 || yTip > size.height) return null;
    const text = b.count > 1
      ? `₹${b.amountCr.toFixed(0)}Cr · ${b.count}d`
      : `₹${b.amountCr.toFixed(b.amountCr >= 10 ? 0 : 1)}Cr`;
    return { x, yTip, text, boxW: text.length * 5.6 + 14 };
  }).filter((v): v is NonNullable<typeof v> => v !== null);
  // Stagger overlapping BM badges into two top rows
  {
    let lastRight = -Infinity;
    for (const b of bmBadges) {
      (b as { row?: number }).row = (b.x - b.boxW / 2) < lastRight + 4 ? 1 : 0;
      if ((b as { row?: number }).row === 0) lastRight = b.x + b.boxW / 2;
    }
  }

  // ── Layer 4: persona callouts — anchored at their bar, boxes float ───
  // Each callout: numbered badge at (anchor bar x, zone price y); an HTML
  // box in storyBubble style floats above or below the anchor; a leader
  // line connects box → badge. Greedy anti-collision nudges boxes apart.
  interface LaidCallout {
    persona: 'lt' | 'swing';
    n: number;
    price: number;
    labelShort: string;
    color: string;
    ax: number;   // anchor x (bar)
    ay: number;   // anchor y (price)
    bx: number;   // box left
    by: number;   // box top
  }
  const laidCallouts: LaidCallout[] = [];
  {
    const placed: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const intersects = (r: { x0: number; y0: number; x1: number; y1: number }) =>
      placed.some((p) => r.x0 < p.x1 + BOX_GAP && r.x1 > p.x0 - BOX_GAP && r.y0 < p.y1 + BOX_GAP && r.y1 > p.y0 - BOX_GAP);

    const withAnchor = callouts
      .map((c) => {
        const ax = c.anchorDate ? timeToX(c.anchorDate) : null;
        const ay = priceToY(c.price);
        if (ax == null || ay == null) return null;
        if (ax < 0 || ax > size.width) return null;
        const ayClamped = Math.max(6, Math.min(size.height - 6, ay));
        return { ...c, ax, ay: ayClamped, color: c.persona === 'lt' ? TOK.lt : TOK.sw };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.ax - b.ax);

    // Keep boxes clear of the right price axis (~70px)
    const maxBx = size.width - 70 - BOX_W;
    const clampBx = (x: number) => Math.max(4, Math.min(maxBx, x));
    const clampBy = (y: number) => Math.max(4, Math.min(size.height - BOX_H - 4, y));

    for (const c of withAnchor) {
      // Candidate spots in priority order: above/below the anchor, then a
      // left-fan (boxes marching left at the anchor's height) for the
      // common case where several zones anchor on the same recent bars.
      const preferAbove = c.ay > size.height / 2;
      const vertical = (above: boolean, step: number) => ({
        bx: clampBx(c.ax - BOX_W / 2),
        by: above
          ? c.ay - 16 - BOX_H - step * (BOX_H + BOX_GAP)
          : c.ay + 16 + step * (BOX_H + BOX_GAP),
      });
      const leftFan = (step: number, dy: number) => ({
        bx: clampBx(c.ax - 20 - BOX_W - step * (BOX_W * 0.4)),
        by: clampBy(c.ay - BOX_H / 2 + dy),
      });
      const candidates: Array<{ bx: number; by: number }> = [];
      for (let s = 0; s < 3; s++) {
        candidates.push(vertical(preferAbove, s));
        candidates.push(vertical(!preferAbove, s));
      }
      for (let s = 0; s < 8; s++) {
        candidates.push(leftFan(s, 0));
        candidates.push(leftFan(s, -(BOX_H + BOX_GAP)));
        candidates.push(leftFan(s, BOX_H + BOX_GAP));
        candidates.push(leftFan(s, -2 * (BOX_H + BOX_GAP)));
        candidates.push(leftFan(s, 2 * (BOX_H + BOX_GAP)));
      }
      let spot: { bx: number; by: number } | null = null;
      for (const cand of candidates) {
        if (cand.by < 4 || cand.by + BOX_H > size.height - 4) continue;
        const rect = { x0: cand.bx, y0: cand.by, x1: cand.bx + BOX_W, y1: cand.by + BOX_H };
        if (!intersects(rect)) { spot = cand; break; }
      }
      if (!spot) {
        spot = { bx: clampBx(c.ax - BOX_W / 2), by: clampBy(c.ay - BOX_H / 2) };
      }
      placed.push({ x0: spot.bx, y0: spot.by, x1: spot.bx + BOX_W, y1: spot.by + BOX_H });
      laidCallouts.push({
        persona: c.persona, n: c.n, price: c.price, labelShort: c.labelShort,
        color: c.color, ax: c.ax, ay: c.ay, bx: spot.bx, by: spot.by,
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
        {/* ── cycle bands ── */}
        {bandRects.map((c, i) => {
          const midX = c.left + c.width / 2;
          const midY = size.height / 2;
          return (
            <g key={`band-${i}`}>
              <rect x={c.left} y={0} width={c.width} height={size.height} fill={c.fill} />
              {i > 0 && (
                <line
                  x1={c.left} y1={0} x2={c.left} y2={size.height}
                  stroke={`color-mix(in srgb, ${TOK.rule} 90%, transparent)`}
                  strokeDasharray="2 4"
                />
              )}
              {c.width > 40 && (
                <g transform={`translate(${midX} ${midY}) rotate(-90)`}>
                  <text
                    textAnchor="middle"
                    fontFamily="Fraunces, Georgia, serif"
                    fontWeight={600}
                    fontSize={c.fontSize}
                    letterSpacing="0.06em"
                    fill={c.textFill}
                    style={{ textTransform: 'uppercase' }}
                  >
                    {c.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── story pins ── */}
        {pinPoints.map((p, i) => (
          <circle
            key={`pin-${i}`}
            cx={p.x} cy={p.y} r={4}
            fill={p.color} opacity={0.9}
            stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`} strokeWidth={0.7}
          />
        ))}

        {/* ── Big Money badges (top rail, two staggered rows) ── */}
        {bmBadges.map((b, i) => {
          const badgeY = 12 + ((b as { row?: number }).row ?? 0) * 18;
          return (
            <g key={`bm-${i}`}>
              <line
                x1={b.x} y1={badgeY + 8}
                x2={b.x} y2={b.yTip - 2}
                stroke={TOK.gold} strokeWidth={0.6} opacity={0.55} strokeDasharray="1 3"
              />
              <circle cx={b.x} cy={b.yTip - 2} r={2} fill={TOK.gold} />
              <rect
                x={b.x - b.boxW / 2} y={badgeY - 6}
                width={b.boxW} height={14} rx={2}
                fill={TOK.ground}
                stroke={TOK.gold} strokeWidth={0.8}
                opacity={0.97}
              />
              <text
                x={b.x} y={badgeY + 4}
                textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={9}
                fontWeight={700}
                fill={TOK.gold}
              >
                {b.text}
              </text>
            </g>
          );
        })}

        {/* ── callout leader lines + numbered anchor badges ── */}
        {laidCallouts.map((m, i) => {
          const boxCX = m.bx + BOX_W / 2;
          const boxAbove = m.by + BOX_H <= m.ay;
          const boxEdgeY = boxAbove ? m.by + BOX_H : m.by;
          return (
            <g key={`col-${i}`}>
              <line
                x1={boxCX} y1={boxEdgeY}
                x2={m.ax} y2={m.ay + (boxAbove ? -10 : 10)}
                stroke={m.color} strokeWidth={0.8} opacity={0.6}
              />
              <circle
                cx={m.ax} cy={m.ay} r={9}
                fill={m.color} opacity={0.95}
                stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`}
                strokeWidth={0.5}
              />
              <text
                x={m.ax} y={m.ay + 3.5}
                textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={10} fontWeight={700}
                fill={TOK.ground}
              >
                {m.n}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── HTML callout boxes — same visual language as storyBubble ── */}
      {laidCallouts.map((m, i) => (
        <div
          key={`cbox-${i}`}
          style={{
            position: 'absolute',
            left: m.bx,
            top: m.by,
            width: BOX_W,
            height: BOX_H,
            background: TOK.bubbleBg,
            color: TOK.bubbleText,
            border: `1px solid color-mix(in srgb, ${m.color} 55%, transparent)`,
            borderLeft: `3px solid ${m.color}`,
            borderRadius: 8,
            padding: '5px 9px',
            boxShadow: 'var(--card-shadow)',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
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
