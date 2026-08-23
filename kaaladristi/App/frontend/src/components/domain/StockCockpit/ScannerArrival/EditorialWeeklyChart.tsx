/**
 * EditorialWeeklyChart — the annotated weekly chart for the Scanner Story
 * page. Pure inline-SVG (no lightweight-charts) so the cycle-band labels,
 * persona markers, and right-axis role labels sit exactly where the
 * editorial reference decks (Solara/KPL/Kronox) put them.
 *
 * Layers (bottom→top):
 *   1  cycle bands (from adapter cycleLabels) + big vertical serif labels
 *   2  faint horizontal grid + right-axis price ticks
 *   3  weekly candles
 *   4  50-week EMA line
 *   5  horizontal structural level lines (adapter horizontalLines)
 *   6  dotted persona-entry price lines (LT + Swing) across the plot
 *   7  numbered persona markers in the right margin at their price
 *   8  NOW marker on the last bar + price badge
 *   9  year axis
 *
 * Chart engine deliberately swaps lightweight-charts for SVG here because
 * the editorial reference decks live or die on: (a) rotated cycle-band
 * labels running the height of each regime, (b) persona markers placed
 * at their exact price on the right axis with a dotted rule tracing back
 * across the chart, and (c) role-labeled horizontal lines that hug the
 * axis. lightweight-charts can approximate none of those cleanly without
 * an HTML overlay layer synced to timeScale coords. Story Play (the
 * animated replay) keeps using TradingChart — the two are one toggle
 * inside the Chart & Replay tab.
 *
 * See: docs/claude/scanner-story-page-poa.md
 */

import { useMemo } from 'react';
import type {
  WeeklyBar,
  ChartAnnotations,
  PersonaEntries,
} from '@/services/thesis/setupAdapter';

interface Props {
  bars: WeeklyBar[];
  annotations: ChartAnnotations;
  personas: PersonaEntries;
  /** Daily Big Money days — the SAME array TradingChart consumes.
   *  Each daily event is mapped to its containing weekly bar and
   *  rendered as a ₹ marker above that candle. Multiple same-week
   *  events cluster into one badge. */
  bigMoneyEvents?: { trade_date: string; price: number; label: string; color?: string }[];
}

// ── Design tokens scoped to this chart ────────────────────────────────────
// The Story View commits to a warmer, muted editorial palette that stays
// consistent whether the rest of the app is dark or light. These are the
// same numeric anchors used in the mock the owner signed off on.
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
  bandBull: 'var(--story-band-bull)',
  bandBear: 'var(--story-band-bear)',
  bandNeut: 'var(--story-band-neut)',
  bandTextBull: 'var(--story-band-text-bull)',
  bandTextBear: 'var(--story-band-text-bear)',
  bandTextNeut: 'var(--story-band-text-neut)',
};

// Fixed viewBox so text/marker sizes stay predictable regardless of the
// container width. The <svg> scales via CSS width:100% + preserveAspect.
const VB_W = 1200;
const VB_H = 460;
const MARGIN = { l: 20, r: 130, t: 40, b: 30 };
/** Minimum vertical spacing between right-axis labels + persona markers,
 *  in SVG units. Anything closer than this triggers stagger/offset. */
const LABEL_MIN_GAP = 14;
/** Callouts sit INSIDE the plot area at the right edge, over the last
 *  ~15% of bars. Semi-transparent so the candles behind remain visible. */
const CALLOUT_W = 138;
const CALLOUT_H = 20;
const CALLOUT_RIGHT_PAD = 8; // gap from plot.x1 to callout right edge

export default function EditorialWeeklyChart({ bars, annotations, personas, bigMoneyEvents = [] }: Props) {
  if (bars.length === 0) {
    return (
      <div
        style={{
          height: 340,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${TOK.rule}`,
          borderRadius: 4,
          background: TOK.ground,
          color: TOK.ink3,
          fontSize: 12,
        }}
      >
        No weekly bars available for this equity.
      </div>
    );
  }

  const N = bars.length;

  // ── Geometry ──────────────────────────────────────────────────────────
  const plot = {
    x0: MARGIN.l,
    y0: MARGIN.t,
    x1: VB_W - MARGIN.r,
    y1: VB_H - MARGIN.b,
    w: VB_W - MARGIN.l - MARGIN.r,
    h: VB_H - MARGIN.t - MARGIN.b,
  };
  const barW = plot.w / N;
  const bodyW = Math.max(1.2, barW * 0.62);
  const xOf = (i: number) => plot.x0 + i * barW + barW / 2;

  // Price scale — snap to bar highs/lows only. Annotated levels (structural
  // lines, persona entries) do NOT get to stretch the scale: an extended
  // stock's 50-wk EMA can sit 50% below current price and drag the whole
  // plot into unreadable density. Anything off-scale is filtered at draw
  // time instead — the user still sees the KV grid and persona card list
  // it, just not as a line on the chart.
  const { pMin, pMax, yOf } = useMemo(() => {
    const values: number[] = [];
    for (const b of bars) {
      if (Number.isFinite(b.high)) values.push(b.high);
      if (Number.isFinite(b.low)) values.push(b.low);
    }
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.06;
    const pMin = Math.max(0, lo - pad);
    const pMax = hi + pad;
    const range = pMax - pMin || 1;
    const yOf = (p: number) => plot.y1 - ((p - pMin) / range) * plot.h;
    return { pMin, pMax, yOf };
  }, [bars, plot.h, plot.y1]);

  /** True if a price falls inside the visible scale. Off-scale annotations
   *  are dropped from the chart (the sidebar still surfaces them). */
  const inScale = (p: number) => p >= pMin && p <= pMax;

  // ── 50-week EMA (SMA proxy — matches adapter's smaFromEnd choice) ────
  const emaSeries = useMemo(() => rollingSma(bars.map((b) => b.close), 50), [bars]);

  // ── Cycle-band positioning ────────────────────────────────────────────
  const dateIndex = useMemo(() => {
    const m = new Map<string, number>();
    bars.forEach((b, i) => m.set(b.trade_date, i));
    return m;
  }, [bars]);

  const cycleRects = useMemo(() => {
    return annotations.cycleLabels
      .map((c) => {
        const fromIdx = dateIndex.get(c.from);
        const toIdx = dateIndex.get(c.to);
        if (fromIdx == null || toIdx == null) return null;
        const x = plot.x0 + fromIdx * barW;
        const w = (toIdx - fromIdx + 1) * barW;
        const fill = c.tone === 'bull' ? TOK.bandBull : c.tone === 'bear' ? TOK.bandBear : TOK.bandNeut;
        const text = c.tone === 'bull' ? TOK.bandTextBull : c.tone === 'bear' ? TOK.bandTextBear : TOK.bandTextNeut;
        return { x, w, fill, text, label: c.label, fromIdx, toIdx };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [annotations.cycleLabels, dateIndex, plot.x0, barW]);

  // ── Persona callouts — single-column stack in the right margin.
  // Markers stay on their price line (no fan). The CALLOUT BOX shifts up
  // or down when two markers cluster — a subtle leader line from the box's
  // left edge back to the marker preserves the "this is that zone"
  // reading even when the box drifted away from the price line.
  const markers = useMemo(() => {
    const all: Array<{ persona: 'lt' | 'swing'; n: number; price: number; color: string; label: string }> = [];
    for (const e of personas.ltInvestor) {
      if (e.price != null && Number.isFinite(e.price) && inScale(e.price)) {
        all.push({ persona: 'lt', n: e.entryNo, price: e.price, color: TOK.lt, label: e.label });
      }
    }
    for (const e of personas.swingTrader) {
      if (e.price != null && Number.isFinite(e.price) && inScale(e.price)) {
        all.push({ persona: 'swing', n: e.entryNo, price: e.price, color: TOK.sw, label: e.label });
      }
    }
    // Marker sits INSIDE the plot area at the right edge — just past the
    // last few bars. Callout box extends leftward from the marker into
    // the plot with a semi-transparent background so the recent candles
    // are still visible through it.
    const withY = all.map((m) => ({ ...m, y: yOf(m.price) })).sort((a, b) => a.y - b.y);
    const CALLOUT_GAP = 3;
    const markerX = plot.x1 - CALLOUT_RIGHT_PAD;
    const laid: Array<(typeof withY)[number] & { x: number; boxY: number }> = [];
    let lastBottom = -Infinity;
    for (const m of withY) {
      let boxY = m.y - CALLOUT_H / 2;
      if (boxY < lastBottom + CALLOUT_GAP) boxY = lastBottom + CALLOUT_GAP;
      lastBottom = boxY + CALLOUT_H;
      laid.push({ ...m, x: markerX, boxY });
    }
    return laid;
  }, [personas, yOf, plot.x1, inScale]);

  // ── Structural key lines — single right-axis column with vertical
  // anti-collision. If a label sits within LABEL_MIN_GAP of the previous
  // one, push it down. A leader line runs from the price line to the
  // label when the label had to shift off-line.
  const structuralLines = useMemo(() => {
    const raw = annotations.horizontalLines
      .filter((l) => Number.isFinite(l.price) && inScale(l.price))
      .map((l) => ({ ...l, y: yOf(l.price) }))
      .sort((a, b) => a.y - b.y);
    const laid: Array<(typeof raw)[number] & { labelX: number; labelY: number }> = [];
    let lastY = -Infinity;
    for (const l of raw) {
      const labelY = l.y < lastY + LABEL_MIN_GAP ? lastY + LABEL_MIN_GAP : l.y;
      lastY = labelY;
      laid.push({ ...l, labelX: 6, labelY });
    }
    return laid;
  }, [annotations.horizontalLines, yOf, inScale]);

  // ── Year axis (bar_date year → x pos) ─────────────────────────────────
  const yearTicks = useMemo(() => {
    const out: Array<{ x: number; year: string }> = [];
    let lastYear = '';
    bars.forEach((b, i) => {
      const y = b.trade_date.slice(0, 4);
      if (y !== lastYear) {
        out.push({ x: xOf(i), year: y });
        lastYear = y;
      }
    });
    return out;
  }, [bars, xOf]);

  // ── Big Money aggregation — map each daily event to its containing
  // weekly bar (find the first weekly bar whose date is >= event date).
  // Same-week events cluster into one badge with combined color.
  const bigMoneyByBar = useMemo(() => {
    const byIdx = new Map<number, { count: number; totalCr: number; high: number }>();
    if (bigMoneyEvents.length === 0 || bars.length === 0) return byIdx;
    const barDates = bars.map((b) => b.trade_date);
    for (const ev of bigMoneyEvents) {
      let idx = -1;
      for (let i = 0; i < barDates.length; i++) {
        if (barDates[i] >= ev.trade_date) { idx = i; break; }
      }
      if (idx === -1) idx = bars.length - 1;
      const prev = byIdx.get(idx) ?? { count: 0, totalCr: 0, high: 0 };
      // Parse the label's Cr number (e.g. "₹24.7 Cr" → 24.7)
      const crMatch = ev.label.match(/([0-9.]+)/);
      const cr = crMatch ? Number(crMatch[1]) : 0;
      prev.count += 1;
      prev.totalCr += cr;
      prev.high = Math.max(prev.high, bars[idx].high);
      byIdx.set(idx, prev);
    }
    return byIdx;
  }, [bigMoneyEvents, bars]);

  const lastBar = bars[N - 1];
  const lastX = xOf(N - 1);
  const lastY = yOf(lastBar.close);

  return (
    <div style={{ width: '100%', background: TOK.ground, border: `1px solid ${TOK.rule}`, borderRadius: 4, padding: '14px 16px 12px' }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Editorial weekly chart with cycle bands, key levels, and persona entries"
      >
        {/* 1 — cycle bands + rotated serif labels. Size the label so the
            rotated text (which runs the height of the chart at rotate(-90))
            fits inside plot.h. Font is capped by BOTH band width and
            available vertical space; charCount × per-char stride must not
            exceed plot.h - 20 padding, or the label overprints the axis. */}
        {cycleRects.map((c, i) => {
          const midX = c.x + c.w / 2;
          const midY = plot.y0 + plot.h / 2;
          // Per-char stride ≈ fontSize × 1.05 (Fraunces mono-caps + 0.06em spacing).
          const availH = plot.h - 24;
          const chars = c.label.length;
          const maxByHeight = availH / (chars * 0.95);
          const maxByWidth  = c.w * 0.35;
          const fontSize = Math.max(11, Math.min(maxByHeight, maxByWidth, 22));
          return (
            <g key={`cyc-${i}`}>
              <rect x={c.x} y={plot.y0} width={c.w} height={plot.h} fill={c.fill} />
              {i > 0 && (
                <line
                  x1={c.x}
                  y1={plot.y0}
                  x2={c.x}
                  y2={plot.y1}
                  stroke={`color-mix(in srgb, ${TOK.rule} 90%, transparent)`}
                  strokeDasharray="2 4"
                />
              )}
              {c.w > 40 && (
                <g transform={`translate(${midX} ${midY}) rotate(-90)`}>
                  <text
                    textAnchor="middle"
                    fontFamily="Fraunces, Georgia, serif"
                    fontWeight={600}
                    fontSize={fontSize}
                    letterSpacing="0.06em"
                    fill={c.text}
                    style={{ textTransform: 'uppercase' } as React.CSSProperties}
                  >
                    {c.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 2 — faint horizontal grid */}
        {computeGridPrices(pMin, pMax).map((p, i) => (
          <line
            key={`g-${i}`}
            x1={plot.x0}
            y1={yOf(p)}
            x2={plot.x1}
            y2={yOf(p)}
            stroke={`color-mix(in srgb, ${TOK.rule} 55%, transparent)`}
          />
        ))}

        {/* 3 — candles */}
        {bars.map((b, i) => {
          const x = xOf(i);
          const isBull = b.close >= b.open;
          const color = isBull ? TOK.bull : TOK.bear;
          const y0 = yOf(Math.max(b.open, b.close));
          const y1 = yOf(Math.min(b.open, b.close));
          return (
            <g key={`cd-${i}`} opacity={isBull ? 0.92 : 0.88}>
              <line x1={x} x2={x} y1={yOf(b.high)} y2={yOf(b.low)} stroke={color} strokeWidth={0.9} opacity={0.85} />
              <rect x={x - bodyW / 2} y={y0} width={bodyW} height={Math.max(1, y1 - y0)} fill={color} />
            </g>
          );
        })}

        {/* 4 — 50-week EMA */}
        <path
          d={buildLinePath(emaSeries.map((v, i) => (v == null ? null : { x: xOf(i), y: yOf(v) })))}
          fill="none"
          stroke={TOK.gold}
          strokeWidth={1.6}
          opacity={0.9}
        />

        {/* 5 — horizontal structural level lines + anti-collided labels */}
        {structuralLines.map((l, i) => {
          const color = l.tone === 'bull' ? TOK.bull : l.tone === 'bear' ? TOK.bear : TOK.ink2;
          const labelX = plot.x1 + l.labelX;
          const labelShifted = Math.abs(l.labelY - l.y) > 0.5;
          return (
            <g key={`lvl-${i}`}>
              <line
                x1={plot.x0}
                x2={plot.x1}
                y1={l.y}
                y2={l.y}
                stroke={color}
                strokeWidth={1.1}
                strokeDasharray={l.tone === 'neutral' ? '3 4' : ''}
                opacity={0.7}
              />
              {/* leader line only when the label was pushed off its price line */}
              {labelShifted && (
                <line
                  x1={plot.x1 + 2}
                  y1={l.y}
                  x2={labelX - 2}
                  y2={l.labelY - 3}
                  stroke={color}
                  strokeWidth={0.5}
                  opacity={0.5}
                />
              )}
              <text
                x={labelX}
                y={l.labelY - 3}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={10}
                fill={color}
                fontWeight={500}
              >
                {l.price.toFixed(0)}
              </text>
              <text
                x={labelX}
                y={l.labelY + 9}
                fontFamily="Inter, system-ui, sans-serif"
                fontSize={8.5}
                fontWeight={600}
                letterSpacing="0.06em"
                fill={TOK.ink3}
                style={{ textTransform: 'uppercase' } as React.CSSProperties}
              >
                {shortLevelLabel(l.label)}
              </text>
            </g>
          );
        })}

        {/* 6 — dotted persona entry lines across chart */}
        {markers.map((m, i) => (
          <line
            key={`pl-${i}`}
            x1={plot.x0}
            x2={plot.x1}
            y1={m.y}
            y2={m.y}
            stroke={m.color}
            strokeWidth={0.7}
            strokeDasharray="1.5 4"
            opacity={0.55}
          />
        ))}

        {/* 7 — editorial persona callouts. Each numbered marker gets a small
            pill immediately to its right with the persona tag, short zone
            label (e.g. "Breakout"), and price. A leader line from the marker
            back to the price line on the plot gives the "this number means
            THIS zone" reading. Reference decks (Solara/KPL) use this exact
            pattern — the number without a label is a dead symbol. */}
        {markers.map((m, i) => {
          const short = shortEntryLabel(m.label);
          const priceStr = `₹${Math.round(m.price)}`;
          const tagStr = m.persona === 'lt' ? 'LT' : 'SW';
          // Callout box extends LEFTWARD from the marker (which sits at
          // the right edge INSIDE the plot). Background is semi-transparent
          // so candles remain readable behind.
          const boxX = m.x - 14 - CALLOUT_W;
          const boxCY = m.boxY + CALLOUT_H / 2;
          const shifted = Math.abs(boxCY - m.y) > 0.5;
          return (
            <g key={`pm-${i}`}>
              {/* editorial callout box — sits inside plot, over recent bars */}
              <rect
                x={boxX} y={m.boxY}
                width={CALLOUT_W} height={CALLOUT_H}
                rx={2}
                fill={`color-mix(in srgb, ${TOK.ground} 90%, transparent)`}
                stroke={`color-mix(in srgb, ${m.color} 45%, transparent)`}
                strokeWidth={0.7}
              />
              <text
                x={boxX + 7}
                y={m.boxY + 9}
                fontFamily="Inter, system-ui, sans-serif"
                fontSize={8}
                fontWeight={700}
                letterSpacing="0.10em"
                fill={m.color}
                style={{ textTransform: 'uppercase' } as React.CSSProperties}
              >
                {tagStr}-{m.n}
              </text>
              <text
                x={boxX + 32}
                y={m.boxY + 9}
                fontFamily="Inter, system-ui, sans-serif"
                fontSize={8.5}
                fontWeight={500}
                fill={TOK.ink2}
              >
                {short}
              </text>
              <text
                x={boxX + CALLOUT_W - 6}
                y={m.boxY + CALLOUT_H - 4}
                textAnchor="end"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={9}
                fontWeight={600}
                fill={TOK.ink}
              >
                {priceStr}
              </text>
              {/* leader from callout right edge to marker */}
              {shifted && (
                <line
                  x1={boxX + CALLOUT_W}
                  y1={boxCY}
                  x2={m.x - 9}
                  y2={m.y}
                  stroke={m.color}
                  strokeWidth={0.5}
                  opacity={0.55}
                />
              )}
              {/* numbered badge on the price line (inside plot right edge) */}
              <circle
                cx={m.x} cy={m.y} r={9}
                fill={m.color} opacity={0.95}
                stroke={`color-mix(in srgb, ${TOK.ground} 60%, transparent)`}
                strokeWidth={0.5}
              />
              <text
                x={m.x}
                y={m.y + 3.5}
                textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={10}
                fontWeight={700}
                fill={TOK.ground}
              >
                {m.n}
              </text>
            </g>
          );
        })}

        {/* 7.5 — Big Money badges: pinned to the TOP of the plot area
            with a vertical leader dropping to the specific weekly bar's
            high. Puts institutional-footprint annotations in their own
            visual layer (never fights persona callouts for space at the
            current-price zone). Multi-event weeks cluster into one badge
            showing combined ₹ and day count. */}
        {Array.from(bigMoneyByBar.entries()).map(([idx, agg]) => {
          const x = xOf(idx);
          const barTopY = yOf(agg.high);
          const badgeY = plot.y0 + 12;
          const color = TOK.gold;
          const crText = agg.count > 1
            ? `₹${agg.totalCr.toFixed(0)}Cr · ${agg.count}d`
            : `₹${agg.totalCr.toFixed(agg.totalCr >= 10 ? 0 : 1)}Cr`;
          const boxW = crText.length * 5.6 + 14;
          return (
            <g key={`bm-${idx}`}>
              {/* leader from badge down to the candle top */}
              <line
                x1={x} y1={badgeY + 8}
                x2={x} y2={barTopY - 2}
                stroke={color}
                strokeWidth={0.6}
                opacity={0.55}
                strokeDasharray="1 3"
              />
              {/* small mark at the candle top */}
              <circle cx={x} cy={barTopY - 2} r={2} fill={color} />
              {/* badge box */}
              <rect
                x={x - boxW / 2} y={badgeY - 6}
                width={boxW} height={14} rx={2}
                fill={`color-mix(in srgb, ${TOK.ground} 95%, transparent)`}
                stroke={color} strokeWidth={0.8}
              />
              <text
                x={x} y={badgeY + 4}
                textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={9}
                fontWeight={700}
                fill={color}
              >
                {crText}
              </text>
            </g>
          );
        })}

        {/* 8 — NOW badge above last bar */}
        <line
          x1={lastX}
          y1={plot.y0}
          x2={lastX}
          y2={plot.y1}
          stroke={`color-mix(in srgb, ${TOK.ink} 20%, transparent)`}
          strokeWidth={0.8}
          strokeDasharray="1 3"
        />
        <circle cx={lastX} cy={lastY} r={2.5} fill={TOK.ink} />
        <g transform={`translate(${lastX} ${plot.y0 - 6})`}>
          <rect x={-44} y={-22} width={88} height={22} rx={2} fill={TOK.ground} stroke={TOK.rule} />
          <text
            x={0}
            y={-12}
            textAnchor="middle"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize={11}
            fontWeight={600}
            fill={TOK.ink}
          >
            ₹{lastBar.close.toFixed(0)}
          </text>
          <text
            x={0}
            y={-3}
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={8}
            fontWeight={600}
            letterSpacing="0.1em"
            fill={TOK.ink3}
            style={{ textTransform: 'uppercase' } as React.CSSProperties}
          >
            NOW · {formatShortDate(lastBar.trade_date)}
          </text>
        </g>

        {/* 9 — year axis */}
        <line x1={plot.x0} y1={plot.y1} x2={plot.x1} y2={plot.y1} stroke={TOK.rule} />
        {yearTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={t.x} y1={plot.y1} x2={t.x} y2={plot.y1 + 4} stroke={TOK.rule} />
            <text
              x={t.x}
              y={plot.y1 + 16}
              textAnchor="middle"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={10}
              fontWeight={600}
              letterSpacing="0.12em"
              fill={TOK.ink3}
            >
              {t.year}
            </text>
          </g>
        ))}
      </svg>

      {/* legend strip beneath the chart */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 24, paddingTop: 12, marginTop: 10,
        borderTop: `1px solid ${TOK.rule}`,
        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: TOK.ink3, fontWeight: 600,
      }}>
        <span>
          {bars.length} WEEKLY BARS &nbsp;·&nbsp; {bars[0]?.trade_date} → {lastBar.trade_date}
        </span>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Swatch color={TOK.gold} label="50-wk EMA" />
          <Swatch color={TOK.bull} label="Support" />
          <Swatch color={TOK.bear} label="Resistance" />
          <SwatchDot color={TOK.lt} label="LT zones" />
          <SwatchDot color={TOK.sw} label="Swing zones" />
        </div>
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 12, height: 2, background: color }} />
      {label}
    </span>
  );
}
function SwatchDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function rollingSma(vals: number[], n: number): Array<number | null> {
  const out: Array<number | null> = new Array(vals.length).fill(null);
  if (vals.length < n) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += vals[i];
  out[n - 1] = sum / n;
  for (let i = n; i < vals.length; i++) {
    sum += vals[i] - vals[i - n];
    out[i] = sum / n;
  }
  return out;
}

function buildLinePath(points: Array<{ x: number; y: number } | null>): string {
  const segs: string[] = [];
  let started = false;
  for (const p of points) {
    if (p == null) { started = false; continue; }
    segs.push(`${started ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    started = true;
  }
  return segs.join(' ');
}

function computeGridPrices(min: number, max: number): number[] {
  const range = max - min;
  const rough = range / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = Math.round(rough / magnitude) * magnitude;
  if (step <= 0) return [];
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let p = start; p <= max; p += step) out.push(p);
  return out;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[Number(m) - 1] ?? m} ${d} ${y}`;
}

/** Abbreviate right-axis level labels so long strings like "IMMEDIATE
 *  RESISTANCE" fit inside the 178px right margin without clipping.
 *  Unknown labels pass through uppercased. */
function shortLevelLabel(label: string): string {
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

/** Abbreviate persona entry labels for the editorial callout pills.
 *  The full label ("Structural breakout zone") is still visible in the
 *  sidebar persona card — the on-chart pill needs 2-3 words max. */
function shortEntryLabel(label: string): string {
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
