/**
 * MagicRsSubchart — Magic RS, rendered the way the Pine Script renders it.
 * ========================================================================
 * Source of truth: App/frontend/pinescript/magicRS.txt ("LuckyPop SuperMagic
 * Enhanced"). That indicator draws FIVE layers and the readability comes from
 * their combination:
 *
 *   1. zone background   bgcolor(getColor(threshold), 70)  — the green/red field
 *   2. strength histogram plot(pct_diff * 0.5, columns)    — the loudest layer
 *   3. MagicRS line      colour-coded BY ZONE, linewidth 2
 *   4. MagicMA line      flat blue, linewidth 1
 *   5. extreme dots      at new highs/lows of MagicRS
 *
 * This component drew only 3 and 4, both in fixed colours, over zone bands at
 * 5% / 3% / 1.5% alpha — mathematically present, visually absent. Two bare
 * lines on a dark box, which is not a reading of anything.
 *
 * The histogram is the layer that matters most: |magic_ma - magic_rs| is the
 * distance driving the whole zone classification, and seeing it as columns is
 * what turns "two lines crossing" into "strength building / fading".
 *
 * Zones come from the STORED magic_rs_zone (migration 069, six bands) rather
 * than recomputing Pine's adaptive threshold in the browser. The pipeline
 * already decided; a second opinion here would drift from every scanner.
 */

import React, { useRef, useEffect, useCallback } from 'react';

export interface MagicRsDataPoint {
  trade_date: string;
  magic_rs: number | null;
  magic_ma: number | null;
  magic_rs_zone: string | null;
}

interface MagicRsSubchartProps {
  data: MagicRsDataPoint[];
  activeIndex: number;
  benchmarkLabel: string;
}

function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const PAD = { t: 8, b: 4, l: 8, r: 52 };
/** Taller now that the card spans the full chart width — a wide, short strip
 *  flattens the histogram into a bar code. */
const CHART_H = 190;
/** Minimum pixels per bar. The window is derived from the available width
 *  rather than fixed at 40: in the 3fr rail 40 bars was already crowded, and
 *  at full width it wasted two thirds of the space it had just been given. */
const MIN_BAR_PX = 7;
/** Bars considered for the new-high / new-low dots. Pine uses 60/120/240 on
 *  intraday; on daily bars one ~quarter lookback is the equivalent read. */
const EXTREME_LOOKBACK = 60;

/** Zone → tint. Pine fills the pane at 70 transparency (≈30% alpha); on this
 *  dark theme that drowns the lines, so the bands step 16/10/5% and still read
 *  as a field rather than the invisible 5/3/1.5% they were. */
const ZONE_ALPHA: Record<string, { hue: 'green' | 'red'; a: string }> = {
  'Strong Bull':  { hue: 'green', a: '3D' },
  'Mild Bull':    { hue: 'green', a: '26' },
  'Neutral Bull': { hue: 'green', a: '12' },
  'Neutral Bear': { hue: 'red',   a: '12' },
  'Mild Bear':    { hue: 'red',   a: '26' },
  'Strong Bear':  { hue: 'red',   a: '3D' },
};

/** Zone → line/column colour. Pine colours the MagicRS LINE by zone; drawing
 *  it one fixed indigo threw away the signal the colour carries. */
function zoneColor(zone: string | null, green: string, red: string, neutral: string): string {
  if (!zone) return neutral;
  if (zone === 'Strong Bull' || zone === 'Mild Bull') return green;
  if (zone === 'Strong Bear' || zone === 'Mild Bear') return red;
  return neutral;
}

export default function MagicRsSubchart({ data, activeIndex, benchmarkLabel }: MagicRsSubchartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.offsetWidth;
    canvas.width = W * dpr;
    canvas.height = CHART_H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${CHART_H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const colBg = getCssVar('--bg', '#020917');
    const colBorder = getCssVar('--border', '#1a2740');
    const colGreen = getCssVar('--risk-green', '#10b981');
    const colRed = getCssVar('--risk-red', '#ef4444');
    const colText = getCssVar('--text-muted', '#4a5568');
    const colIndigo = getCssVar('--accent-indigo', '#6366f1');

    ctx.fillStyle = colBg;
    ctx.fillRect(0, 0, W, CHART_H);

    // The window follows the DATA, not a fixed 40. A stock whose magic_rs
    // begins 21 bars ago was being drawn into a 40-slot axis, so it filled the
    // right half and left the rest blank — read as a downtrend when it was the
    // entire life of the series. WALCHANNAG: 555 price bars, 21 magic_rs.
    const VISIBLE = Math.max(
      40,
      Math.min(data.length, Math.floor((W - PAD.l - PAD.r) / MIN_BAR_PX)),
    );
    const startIdx = Math.max(0, activeIndex - VISIBLE + 1);
    const endIdx = activeIndex;
    const windowed = data.slice(startIdx, endIdx + 1);
    // Trim leading bars that carry no Magic RS at all, so the plot starts where
    // the series does instead of implying the value was absent-but-flat.
    const firstReal = windowed.findIndex((d) => d.magic_rs != null);
    const visible = firstReal > 0 ? windowed.slice(firstReal) : windowed;
    const trimmed = firstReal > 0 ? firstReal : 0;
    const n = visible.length;
    if (n === 0) return;

    const rsValues = visible.map((d) => d.magic_rs).filter((v): v is number => v != null);
    const maValues = visible.map((d) => d.magic_ma).filter((v): v is number => v != null);
    if (rsValues.length === 0 && maValues.length === 0) {
      ctx.fillStyle = colText;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`No Magic RS vs ${benchmarkLabel}`, W / 2, CHART_H / 2);
      return;
    }

    // Histogram heights share the price axis, as in Pine (pct_diff * 0.5), so
    // the columns must be inside the domain or they clip.
    const diffs = visible.map((d) =>
      d.magic_rs != null && d.magic_ma != null ? Math.abs(d.magic_ma - d.magic_rs) * 0.5 : 0,
    );
    const allValues = [...rsValues, ...maValues, ...diffs];

    let yMin = Math.min(...allValues, 0);
    let yMax = Math.max(...allValues, 0);
    const padding = Math.max(2, (yMax - yMin) * 0.15);
    yMin -= padding;
    yMax += padding;
    const yRange = yMax - yMin || 1;

    const pw = W - PAD.l - PAD.r;
    const ph = CHART_H - PAD.t - PAD.b;
    const barW = pw / n;

    const toX = (i: number) => PAD.l + i * barW + barW / 2;
    const toY = (val: number) => PAD.t + ph * (1 - (val - yMin) / yRange);

    // ── 1. Zone background ────────────────────────────────────────────────
    visible.forEach((d, i) => {
      const z = d.magic_rs_zone ? ZONE_ALPHA[d.magic_rs_zone] : undefined;
      if (!z) return;
      ctx.fillStyle = (z.hue === 'green' ? colGreen : colRed) + z.a;
      ctx.fillRect(toX(i) - barW / 2, PAD.t, barW, ph);
    });

    // ── Grid + axis labels ────────────────────────────────────────────────
    ctx.strokeStyle = colBorder;
    ctx.lineWidth = 0.5;
    for (let g = 0; g <= 3; g++) {
      const y = PAD.t + (ph / 3) * g;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(W - PAD.r, y);
      ctx.stroke();
      ctx.fillStyle = colText;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText((yMax - (yRange / 3) * g).toFixed(1), W - PAD.r + 30, y + 3);
    }

    const zeroY = toY(0);

    // ── 2. Strength histogram — |MagicMA - MagicRS|, the loudest layer ────
    visible.forEach((d, i) => {
      const h = diffs[i];
      if (!h) return;
      ctx.fillStyle = zoneColor(d.magic_rs_zone, colGreen, colRed, colIndigo) + '59';
      const top = toY(h);
      ctx.fillRect(toX(i) - barW * 0.35, top, Math.max(barW * 0.7, 1), zeroY - top);
    });

    // ── Zero line, above the columns so it stays legible ──────────────────
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = colText + '99';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD.l, zeroY);
      ctx.lineTo(W - PAD.r, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 4. MagicMA — one flat colour, as in Pine ──────────────────────────
    ctx.strokeStyle = colIndigo + 'AA';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let maStarted = false;
    visible.forEach((d, i) => {
      if (d.magic_ma == null) return;
      const y = toY(d.magic_ma);
      if (!maStarted) { ctx.moveTo(toX(i), y); maStarted = true; } else ctx.lineTo(toX(i), y);
    });
    ctx.stroke();

    // ── 3. MagicRS — segment-coloured by zone ─────────────────────────────
    ctx.lineWidth = 2;
    for (let i = 1; i < n; i++) {
      const a = visible[i - 1], b = visible[i];
      if (a.magic_rs == null || b.magic_rs == null) continue;
      ctx.strokeStyle = zoneColor(b.magic_rs_zone, colGreen, colRed, colIndigo);
      ctx.beginPath();
      ctx.moveTo(toX(i - 1), toY(a.magic_rs));
      ctx.lineTo(toX(i), toY(b.magic_rs));
      ctx.stroke();
    }

    // ── 5. Extreme dots — new high / low of MagicRS over the lookback ─────
    // Read against the FULL series, not the visible slice: an extreme is only
    // meaningful against history the window may not include.
    visible.forEach((d, i) => {
      if (d.magic_rs == null) return;
      const globalIdx = startIdx + trimmed + i;
      const from = Math.max(0, globalIdx - EXTREME_LOOKBACK + 1);
      const prior = data.slice(from, globalIdx + 1)
        .map((x) => x.magic_rs).filter((v): v is number => v != null);
      if (prior.length < 5) return;
      const isHigh = d.magic_rs >= Math.max(...prior);
      const isLow = d.magic_rs <= Math.min(...prior);
      if (!isHigh && !isLow) return;
      ctx.fillStyle = isHigh ? colGreen : colRed;
      ctx.beginPath();
      ctx.arc(toX(i), toY(d.magic_rs), 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Active-bar cursor + value tag ─────────────────────────────────────
    const activeLocal = n - 1 - (endIdx - activeIndex);
    if (activeLocal >= 0 && activeLocal < n) {
      const ax = toX(activeLocal);
      ctx.strokeStyle = colText + '99';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ax, PAD.t);
      ctx.lineTo(ax, CHART_H - PAD.b);
      ctx.stroke();
      ctx.setLineDash([]);

      const cur = visible[activeLocal];
      if (cur?.magic_rs != null) {
        const tagW = 36, tagH = 14;
        const tagY = toY(cur.magic_rs) - tagH / 2;
        ctx.fillStyle = zoneColor(cur.magic_rs_zone, colGreen, colRed, colIndigo);
        ctx.beginPath();
        ctx.roundRect(W - PAD.r + 4, tagY, tagW, tagH, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(cur.magic_rs.toFixed(1), W - PAD.r + 4 + tagW / 2, tagY + 10);
      }
    }
  }, [data, activeIndex, benchmarkLabel]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  return (
    <div ref={containerRef} style={{ borderRadius: 6, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      <MagicRsStats data={data} activeIndex={activeIndex} benchmarkLabel={benchmarkLabel} />
    </div>
  );
}

/** The read, before the numbers.
 *
 *  The reference indicator answers "is this strong or weak" from across the
 *  room — a committed green or red field, and a table of STATUS WORDS, not
 *  just values. Ours showed four 10px numbers and left the reader to work out
 *  what they meant. A subchart that needs arithmetic to interpret is not
 *  helping anyone decide anything.
 */
function MagicRsStats({ data, activeIndex, benchmarkLabel }: MagicRsSubchartProps) {
  const idx = Math.min(activeIndex, data.length - 1);
  const cur = data[idx];
  if (!cur) return null;

  const rs = cur.magic_rs;
  const ma = cur.magic_ma;
  const diff = rs != null && ma != null ? rs - ma : null;
  const zone = cur.magic_rs_zone;

  // Consecutive bars on the current side of the MA — Pine's "Trend Duration".
  let held = 0;
  if (rs != null && ma != null) {
    const above = rs > ma;
    for (let i = idx; i >= 0; i--) {
      const d = data[i];
      if (d.magic_rs == null || d.magic_ma == null) break;
      if (d.magic_rs > d.magic_ma !== above) break;
      held += 1;
    }
  }

  // 1D / 1W / 1M — change in Magic RS over 1, 5 and 20 BARS. Not true weekly or
  // monthly series: long MagicRS needs 145 bars, which weekly and monthly
  // histories never reach (the migration-169 lesson), so a bar-count lookback
  // is the honest form of the same question.
  const chg = (back: number): number | null => {
    const a = data[idx - back]?.magic_rs;
    const b = rs;
    return a != null && b != null ? b - a : null;
  };
  const frames: { label: string; v: number | null }[] = [
    { label: '1D', v: chg(1) }, { label: '1W', v: chg(5) }, { label: '1M', v: chg(20) },
  ];

  const bullish = rs != null && ma != null && rs > ma;
  const verdict = zone == null ? 'No read'
    : zone.includes('Strong Bull') ? 'Leading'
    : zone.includes('Mild Bull') ? 'Improving'
    : zone.includes('Strong Bear') ? 'Lagging'
    : zone.includes('Mild Bear') ? 'Weakening'
    : 'Neutral';
  const vColor = zone == null ? 'var(--text-muted)'
    : zone.includes('Bull') ? 'var(--risk-green)'
    : zone.includes('Bear') ? 'var(--risk-red)' : 'var(--text-muted)';

  const withRs = data.filter((d) => d.magic_rs != null);
  const short = withRs.length > 0 && withRs.length < data.length;

  const fmt = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
  const tone = (v: number | null) =>
    v == null ? 'var(--text-muted)' : v > 0 ? 'var(--risk-green)' : v < 0 ? 'var(--risk-red)' : 'var(--text-muted)';

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {/* The verdict, large enough to read without leaning in. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 pt-2">
        <span className="text-[15px] font-serif font-semibold" style={{ color: vColor }}>
          {verdict}
        </span>
        <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
          {zone ?? 'zone unknown'} · {bullish ? 'above' : 'below'} its 60-bar average
          {held > 0 && ` for ${held} bar${held === 1 ? '' : 's'}`}
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          {frames.map((f) => (
            <span key={f.label} className="inline-flex items-center gap-1">
              <span className="text-[10px] font-mono text-[var(--text-faint)]">{f.label}</span>
              <span
                style={{
                  width: 7, height: 7, borderRadius: 99, display: 'inline-block',
                  background: f.v == null ? 'var(--text-faint)' : tone(f.v),
                }}
                title={f.v == null ? 'no data' : `${f.label}: ${fmt(f.v)} change in Magic RS`}
              />
            </span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 py-2">
        {[
          { k: 'Magic RS', v: fmt(rs), c: tone(rs) },
          { k: '60-bar avg', v: fmt(ma), c: 'var(--accent-indigo)' },
          { k: 'Gap to avg', v: fmt(diff), c: tone(diff) },
          { k: 'Held', v: held > 0 ? `${held} bars` : '—', c: 'var(--text-secondary)' },
        ].map((x) => (
          <div key={x.k}>
            <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-faint)]">{x.k}</div>
            <div className="text-[13px] font-mono tabular-nums" style={{ color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-2 text-[9px] font-mono text-[var(--text-faint)] leading-relaxed">
        vs {benchmarkLabel} · 144-bar RS, 60-bar average · 1D/1W/1M are 1, 5 and 20-bar changes
        {short && ` · series starts ${withRs[0].trade_date} (${withRs.length} of ${data.length} bars)`}
      </div>
    </div>
  );
}
