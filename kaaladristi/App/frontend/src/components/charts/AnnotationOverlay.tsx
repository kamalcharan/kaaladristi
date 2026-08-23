/**
 * AnnotationOverlay — the ONE editorial annotation layer that renders
 * cycle bands, persona callouts, Big Money badges, and storyEvent pins
 * on top of any lightweight-charts instance. Story View and Story Play
 * both wrap TradingChart in this same overlay, so setup annotations look
 * IDENTICAL across the toggle and the code lives in exactly one place.
 *
 * Positioned as an absolutely-placed SVG matching the chart canvas.
 * Coordinates are computed via lightweight-charts' priceScale +
 * timeScale APIs. Re-renders on chart resize + visible-range change so
 * annotations track the chart as the user pans or zooms.
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

// ── Design tokens (scoped to the overlay, resolved from Kāla-Drishti CSS vars) ──

const TOK = {
  ground:   'var(--card)',
  ink:      'var(--text-primary)',
  ink2:     'var(--text-secondary)',
  ink3:     'var(--text-muted)',
  rule:     'var(--border)',
  gold:     'var(--gold-soft)',
  bull:     'var(--risk-green)',
  bear:     'var(--risk-red)',
  neutral:  'var(--text-muted)',
  lt:       'var(--accent-indigo)',
  sw:       'var(--risk-amber)',
  bandBull: 'var(--story-band-bull)',
  bandBear: 'var(--story-band-bear)',
  bandNeut: 'var(--story-band-neut)',
  bandTxtBull: 'var(--story-band-text-bull)',
  bandTxtBear: 'var(--story-band-text-bear)',
  bandTxtNeut: 'var(--story-band-text-neut)',
} as const;

/** Callout box dimensions in pixels. */
const CALLOUT_W = 138;
const CALLOUT_H = 20;
const CALLOUT_GAP = 3;
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, force] = useState(0);
  const bumpRef = useRef(0);
  const bump = () => force(++bumpRef.current);

  // Observe chart container size so overlay stays flush with the canvas
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

  if (size.width === 0 || size.height === 0) return null;

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
    if (x0 == null || x1 == null) return null;
    const left = Math.min(x0, x1);
    const width = Math.max(1, Math.abs(x1 - x0));
    const fill = b.tone === 'bull' ? TOK.bandBull : b.tone === 'bear' ? TOK.bandBear : TOK.bandNeut;
    const textFill = b.tone === 'bull' ? TOK.bandTxtBull : b.tone === 'bear' ? TOK.bandTxtBear : TOK.bandTxtNeut;
    // fit label vertically inside plot; cap at 22px
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
    return { x, y, color: PIN_COLOR[p.kind] ?? TOK.gold, kind: p.kind, title: p.title };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // ── Layer 3: Big Money badges pinned to top of plot ──────────────────
  const bmBadges = bigMoney.map((b) => {
    const x = timeToX(b.trade_date);
    const yTip = priceToY(b.price);
    if (x == null || yTip == null) return null;
    const text = b.count > 1
      ? `₹${b.amountCr.toFixed(0)}Cr · ${b.count}d`
      : `₹${b.amountCr.toFixed(b.amountCr >= 10 ? 0 : 1)}Cr`;
    return { x, yTip, text, boxW: text.length * 5.6 + 14 };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // ── Layer 4: persona callouts, right-edge, anti-collision stack ──────
  // Plot right edge is roughly container.clientWidth - price axis width.
  // lightweight-charts default right-price-axis width is ~60-70px; we use
  // the container width minus a safety pad.
  const plotRightX = size.width - 70;
  const laidCallouts: Array<{
    persona: 'lt' | 'swing';
    n: number;
    price: number;
    labelShort: string;
    y: number;
    boxY: number;
    color: string;
  }> = [];
  const withY = callouts
    .map((c) => ({ ...c, y: priceToY(c.price), color: c.persona === 'lt' ? TOK.lt : TOK.sw }))
    .filter((c): c is typeof c & { y: number } => c.y != null)
    .sort((a, b) => a.y - b.y);
  let lastBottom = -Infinity;
  for (const c of withY) {
    let boxY = c.y - CALLOUT_H / 2;
    if (boxY < lastBottom + CALLOUT_GAP) boxY = lastBottom + CALLOUT_GAP;
    if (boxY < 4) boxY = 4;
    if (boxY + CALLOUT_H > size.height - 30) boxY = size.height - 30 - CALLOUT_H;
    lastBottom = boxY + CALLOUT_H;
    laidCallouts.push({ ...c, boxY });
  }

  return (
    <svg
      width={size.width}
      height={size.height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* ── Layer 1: cycle bands ── */}
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

      {/* ── Layer 2: story event pins on the price line ── */}
      {pinPoints.map((p, i) => (
        <g key={`pin-${i}`}>
          <circle cx={p.x} cy={p.y} r={4} fill={p.color} opacity={0.9}
            stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`} strokeWidth={0.7} />
        </g>
      ))}

      {/* ── Layer 3: Big Money badges on top rail ── */}
      {bmBadges.map((b, i) => {
        const badgeY = 12;
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
              fill={`color-mix(in srgb, ${TOK.ground} 95%, transparent)`}
              stroke={TOK.gold} strokeWidth={0.8}
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

      {/* ── Layer 4: persona callouts (numbered pills at right edge) ── */}
      {laidCallouts.map((m, i) => {
        const tagStr = m.persona === 'lt' ? 'LT' : 'SW';
        const markerX = plotRightX - 8;
        const boxX = markerX - 14 - CALLOUT_W;
        const boxCY = m.boxY + CALLOUT_H / 2;
        const shifted = Math.abs(boxCY - m.y) > 0.5;
        const priceStr = `₹${Math.round(m.price)}`;
        return (
          <g key={`co-${i}`}>
            <rect
              x={boxX} y={m.boxY}
              width={CALLOUT_W} height={CALLOUT_H}
              rx={2}
              fill={`color-mix(in srgb, ${TOK.ground} 90%, transparent)`}
              stroke={`color-mix(in srgb, ${m.color} 45%, transparent)`}
              strokeWidth={0.7}
            />
            <text x={boxX + 7} y={m.boxY + 9}
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={8} fontWeight={700} letterSpacing="0.10em"
              fill={m.color}
              style={{ textTransform: 'uppercase' }}
            >
              {tagStr}-{m.n}
            </text>
            <text x={boxX + 32} y={m.boxY + 9}
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={8.5} fontWeight={500}
              fill={TOK.ink2}
            >
              {m.labelShort}
            </text>
            <text x={boxX + CALLOUT_W - 6} y={m.boxY + CALLOUT_H - 4}
              textAnchor="end"
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize={9} fontWeight={600}
              fill={TOK.ink}
            >
              {priceStr}
            </text>
            {shifted && (
              <line
                x1={boxX + CALLOUT_W} y1={boxCY}
                x2={markerX - 9} y2={m.y}
                stroke={m.color} strokeWidth={0.5} opacity={0.55}
              />
            )}
            <circle
              cx={markerX} cy={m.y} r={9}
              fill={m.color} opacity={0.95}
              stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`}
              strokeWidth={0.5}
            />
            <text x={markerX} y={m.y + 3.5}
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
