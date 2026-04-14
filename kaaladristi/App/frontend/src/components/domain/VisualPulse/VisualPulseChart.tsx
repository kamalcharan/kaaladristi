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
}

// ── Color resolution (CSS var → computed hex for canvas) ────────

function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const VISIBLE_BARS = 40;
const PAD = { t: 12, b: 28, l: 8, r: 52 };
const CHART_H = 220;

export default function VisualPulseChart({ bars, activeIndex, corrHistory, dotsHistory }: VisualPulseChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Resolve theme colors
    const colBg = getCssVar('--kd-bg', '#020917');
    const colBorder = getCssVar('--kd-border', '#1a2740');
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
      const lastGL = visible.findLast((b) => b.sma_150 != null);
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
      ctx.fillStyle = bullish ? colGreen + '30' : colRed + '30';
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
      ctx.strokeStyle = bullish
        ? `rgba(16,185,129,${alpha})`
        : `rgba(239,68,68,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(b.high));
      ctx.lineTo(x, toY(b.low));
      ctx.stroke();

      // Body
      ctx.fillStyle = bullish
        ? `rgba(16,185,129,${alpha})`
        : `rgba(239,68,68,${alpha})`;
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
    visible.forEach((_, i) => {
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
  }, [bars, activeIndex, corrHistory, dotsHistory]);

  // Redraw on data change or resize
  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  return (
    <div ref={containerRef} style={{ borderRadius: 8, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
