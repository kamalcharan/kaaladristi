import React, { useRef, useEffect, useCallback } from 'react';
import type { PulseBar, CorrelationState, DotSignals } from '@/services/visualPulseEngine';

/**
 * Canvas-based candlestick chart for Visual Pulse.
 * Draws: candles, volume, golden line (SMA 150), dot signals,
 * convergence band, active candle marker, price tag.
 *
 * Shows last 40 bars up to activeIndex.
 */

interface VisualPulseChartProps {
  bars: PulseBar[];
  activeIndex: number;
  corrHistory: CorrelationState[];
  dotsHistory: DotSignals[];
  /** Per-bar correlation color strip under the candles. On by default for
   *  Intraday; the Pulse pages pass false — the verdict hero + slider ticks
   *  already carry the state, the strip was redundant noise. */
  showConvergenceBand?: boolean;
  /** Drag-to-pan: dragging the candles right pulls older history into view.
   *  The window ends at activeIndex, so panning IS scrubbing — the whole
   *  page (verdict, cards, slider) replays the dragged-to date in sync.
   *  Called with the new active index while dragging. */
  onScrub?: (index: number) => void;
}

// ── Color resolution (CSS var → computed hex for canvas) ────────

function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const VISIBLE_BARS = 40;
const PAD = { t: 12, b: 28, l: 8, r: 52 };
const CHART_H = 220;

export default function VisualPulseChart({ bars, activeIndex, corrHistory, dotsHistory, showConvergenceBand = true, onScrub }: VisualPulseChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Drag-to-pan state — refs, not state: pointermove must not re-render
  const dragRef = useRef<{ startX: number; startIdx: number } | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || bars.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.offsetWidth;
    canvas.width = W * dpr;
    canvas.height = CHART_H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${CHART_H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Safely add alpha to any hex colour returned from getCssVar
    function withAlpha(hex: string, alpha: number): string {
      const h = hex.replace('#', '')
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      return `rgba(${r},${g},${b},${alpha})`
    }

    // Resolve theme colors
    const colBg = getCssVar('--bg', '#020917');
    const colBorder = getCssVar('--border', '#1a2740');
    const colGreen = getCssVar('--risk-green', '#10b981');
    const colRed = getCssVar('--risk-red', '#ef4444');
    const colGold = getCssVar('--accent-gold', '#c9a84c');
    const colSvd = getCssVar('--accent-violet', '#8b5cf6');
    const colSbd = getCssVar('--accent-indigo', '#6366f1');
    const colSyd = getCssVar('--risk-amber', '#f59e0b');
    const colText = getCssVar('--text-muted', '#4a5568');

    // Clear
    ctx.fillStyle = colBg;
    ctx.fillRect(0, 0, W, CHART_H);

    // Determine visible range
    const startIdx = Math.max(0, activeIndex - VISIBLE_BARS + 1);
    const endIdx = activeIndex;
    const visible = bars.slice(startIdx, endIdx + 1);
    const n = visible.length;
    if (n === 0) return;

    // Price range
    let pMin = Infinity, pMax = -Infinity;
    visible.forEach((b) => {
      if (b.low < pMin) pMin = b.low;
      if (b.high > pMax) pMax = b.high;
    });
    pMin -= 80;
    pMax += 80;
    const pRange = pMax - pMin || 1;

    const pw = W - PAD.l - PAD.r;
    const ph = CHART_H - PAD.t - PAD.b;
    const barW = pw / n;

    const toX = (i: number) => PAD.l + i * barW + barW / 2;
    const toY = (price: number) => PAD.t + ph * (1 - (price - pMin) / pRange);

    // ── Grid lines ──
    ctx.strokeStyle = colBorder;
    ctx.lineWidth = 0.5;
    const gridSteps = 5;
    for (let g = 0; g <= gridSteps; g++) {
      const y = PAD.t + (ph / gridSteps) * g;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(W - PAD.r, y);
      ctx.stroke();

      // Price label
      const price = pMax - (pRange / gridSteps) * g;
      ctx.fillStyle = colText;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(0), W - PAD.r + 36, y + 3);
    }

    // ── Golden Line (SMA 150) ──
    ctx.strokeStyle = colGold + '66';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let glStarted = false;
    visible.forEach((b, i) => {
      if (b.sma_150 != null) {
        const y = toY(b.sma_150);
        if (!glStarted) { ctx.moveTo(toX(i), y); glStarted = true; }
        else ctx.lineTo(toX(i), y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // GL label
    if (glStarted) {
      ctx.fillStyle = colGold + '88';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      const lastGL = [...visible].reverse().find((b) => b.sma_150 != null);
      if (lastGL?.sma_150) {
        ctx.fillText('GL', PAD.l + 2, toY(lastGL.sma_150) - 4);
      }
    }

    // ── Volume bars ──
    visible.forEach((b, i) => {
      const rvol = b.rvol ?? 0;
      const vH = Math.min(20, rvol * 4);
      if (vH < 1) return;
      const x = toX(i) - barW * 0.3;
      const bullish = b.close >= b.open;
      ctx.fillStyle = bullish ? withAlpha(colGreen, 0.19) : withAlpha(colRed, 0.19);
      ctx.fillRect(x, CHART_H - PAD.b - vH, barW * 0.6, vH);
    });

    // ── Candles ──
    visible.forEach((b, i) => {
      const x = toX(i);
      const bullish = b.close >= b.open;
      const bodyTop = toY(Math.max(b.open, b.close));
      const bodyBot = toY(Math.min(b.open, b.close));
      const bodyH = Math.max(1, bodyBot - bodyTop);
      const isActive = startIdx + i === activeIndex;
      const alpha = isActive ? 1.0 : 0.7;

      // Wick
      ctx.strokeStyle = withAlpha(bullish ? colGreen : colRed, alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(b.high));
      ctx.lineTo(x, toY(b.low));
      ctx.stroke();

      // Body
      ctx.fillStyle = withAlpha(bullish ? colGreen : colRed, alpha);
      ctx.fillRect(x - barW * 0.35, bodyTop, barW * 0.7, bodyH);
    });

    // ── Dot signals ──
    visible.forEach((b, i) => {
      const globalIdx = startIdx + i;
      const dots = dotsHistory[globalIdx];
      if (!dots) return;
      const x = toX(i);

      if (dots.isSVD) {
        ctx.beginPath();
        ctx.arc(x, toY(b.low) + 8, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = colSvd;
        ctx.fill();
      }
      if (dots.isSBD) {
        ctx.beginPath();
        ctx.arc(x, toY(b.low) + 6, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = colSbd;
        ctx.fill();
      }
      if (dots.isSYD) {
        ctx.beginPath();
        ctx.arc(x, toY(b.high) - 8, 3, 0, Math.PI * 2);
        ctx.fillStyle = colSyd;
        ctx.fill();
      }
    });

    // ── Convergence band (bottom 12px) ──
    const bandH = 12;
    const bandY = CHART_H - PAD.b + 2;
    if (showConvergenceBand) visible.forEach((_, i) => {
      const globalIdx = startIdx + i;
      const corr = corrHistory[globalIdx];
      if (!corr) return;
      // Resolve CSS var to actual color for canvas
      let bandColor = '#475569'; // Neutral fallback
      if (corr.state === 'Aligned') bandColor = colGreen;
      else if (corr.state === 'Converging') bandColor = colGold;
      else if (corr.state === 'Watch') bandColor = getCssVar('--accent-indigo', '#3b82f6');
      else if (corr.state === 'Conflicting') bandColor = colRed;

      ctx.fillStyle = bandColor;
      ctx.fillRect(toX(i) - barW / 2, bandY, barW, bandH);
    });

    // ── Active candle marker ──
    const activeLocalIdx = activeIndex - startIdx;
    if (activeLocalIdx >= 0 && activeLocalIdx < n) {
      const ax = toX(activeLocalIdx);
      ctx.strokeStyle = colGold + '99';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ax, PAD.t);
      ctx.lineTo(ax, CHART_H - PAD.b);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price tag
      const activeBar = visible[activeLocalIdx];
      const tagW = 46, tagH = 16;
      const tagY = toY(activeBar.close) - tagH / 2;
      ctx.fillStyle = colGold;
      ctx.beginPath();
      ctx.roundRect(W - PAD.r + 4, tagY, tagW, tagH, 3);
      ctx.fill();
      ctx.fillStyle = colBg;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(activeBar.close.toFixed(0), W - PAD.r + 4 + tagW / 2, tagY + 11);

      // Convergence state pill
      const corr = corrHistory[activeIndex];
      if (corr) {
        let pillColor = '#475569';
        if (corr.state === 'Aligned') pillColor = colGreen;
        else if (corr.state === 'Converging') pillColor = colGold;
        else if (corr.state === 'Watch') pillColor = getCssVar('--accent-indigo', '#3b82f6');
        else if (corr.state === 'Conflicting') pillColor = colRed;

        const pillText = corr.state;
        ctx.font = 'bold 8px monospace';
        const pillTw = ctx.measureText(pillText).width + 12;
        const pillX = ax - pillTw / 2;
        const pillY = PAD.t - 2;

        ctx.fillStyle = pillColor + '33';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY - 12, pillTw, 14, 4);
        ctx.fill();
        ctx.strokeStyle = pillColor + '88';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.fillStyle = pillColor;
        ctx.textAlign = 'center';
        ctx.fillText(pillText, ax, pillY - 2);
      }
    }

    // ── Date labels ──
    ctx.fillStyle = colText;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const labelEvery = n <= 20 ? 3 : n <= 40 ? 5 : 8;
    visible.forEach((b, i) => {
      if (i % labelEvery === 0 || i === n - 1) {
        const [, m, d] = b.trade_date.split('-');
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        ctx.fillText(`${parseInt(d)} ${months[parseInt(m)]}`, toX(i), CHART_H - 4);
      }
    });
  }, [bars, activeIndex, corrHistory, dotsHistory, showConvergenceBand]);

  // Redraw on data change or resize
  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // ── Wheel / trackpad scroll ──
  // Scroll down or swipe left = forward toward NOW; scroll up or swipe
  // right = back into history. Native non-passive listener — React's
  // synthetic onWheel can't preventDefault, so page scroll would fight it.
  const barsLenRef = useRef(bars.length);
  barsLenRef.current = bars.length;
  const wheelAccRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onScrub) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wheelAccRef.current += delta;
      const STEP_PX = 40; // wheel distance per bar
      const steps = Math.trunc(wheelAccRef.current / STEP_PX);
      if (steps === 0) return;
      wheelAccRef.current -= steps * STEP_PX;
      const next = Math.max(0, Math.min(barsLenRef.current - 1, activeIndexRef.current + steps));
      if (next !== activeIndexRef.current) onScrub(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onScrub]);

  // ── Drag-to-pan handlers ──
  // Dragging right pulls older bars into view (activeIndex decreases);
  // dragging left moves toward NOW. One bar per barW of pointer travel.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onScrub) return;
    dragRef.current = { startX: e.clientX, startIdx: activeIndexRef.current };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onScrub || !dragRef.current || !containerRef.current) return;
    const pw = containerRef.current.offsetWidth - PAD.l - PAD.r;
    const barW = pw / Math.min(VISIBLE_BARS, bars.length || 1);
    const dx = e.clientX - dragRef.current.startX;
    const barsDelta = Math.round(dx / Math.max(barW, 1));
    if (barsDelta === 0) return;
    const next = Math.max(0, Math.min(bars.length - 1, dragRef.current.startIdx - barsDelta));
    if (next !== activeIndexRef.current) onScrub(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        borderRadius: 8, overflow: 'hidden',
        cursor: onScrub ? (dragRef.current ? 'grabbing' : 'grab') : undefined,
        touchAction: onScrub ? 'pan-y' : undefined,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
