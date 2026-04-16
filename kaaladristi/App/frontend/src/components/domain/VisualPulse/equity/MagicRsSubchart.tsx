/**
 * MagicRsSubchart — Magic RS line chart with zone bands
 * ======================================================
 * Renders magic_rs + magic_ma lines over time with zone-colored
 * background bands and zero reference line.
 *
 * Canvas-based, same approach as VisualPulseChart.
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
const CHART_H = 140;

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

    const colBg = getCssVar('--kd-bg', '#020917');
    const colBorder = getCssVar('--kd-border', '#1a2740');
    const colGreen = getCssVar('--risk-green', '#10b981');
    const colRed = getCssVar('--risk-red', '#ef4444');
    const colGold = getCssVar('--accent-gold', '#c9a84c');
    const colText = getCssVar('--text-muted', '#4a5568');
    const colIndigo = getCssVar('--accent-indigo', '#6366f1');

    // Clear
    ctx.fillStyle = colBg;
    ctx.fillRect(0, 0, W, CHART_H);

    // Determine visible range — same as main chart (last 40 bars up to activeIndex)
    const VISIBLE = 40;
    const startIdx = Math.max(0, activeIndex - VISIBLE + 1);
    const endIdx = activeIndex;
    const visible = data.slice(startIdx, endIdx + 1);
    const n = visible.length;
    if (n === 0) return;

    // Y range from magic_rs values
    const rsValues = visible.map((d) => d.magic_rs).filter((v): v is number => v != null);
    const maValues = visible.map((d) => d.magic_ma).filter((v): v is number => v != null);
    const allValues = [...rsValues, ...maValues];

    if (allValues.length === 0) {
      ctx.fillStyle = colText;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No Magic RS data', W / 2, CHART_H / 2);
      return;
    }

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

    // ── Zone bands (background tint) ──
    visible.forEach((d, i) => {
      const zone = d.magic_rs_zone;
      let fillColor: string | null = null;
      if (zone === 'Strong Bull') fillColor = colGreen + '0D'; // 5% opacity
      else if (zone === 'Mild Bull') fillColor = colGreen + '08'; // 3% opacity
      else if (zone === 'Mild Bear') fillColor = colRed + '08';
      else if (zone === 'Strong Bear') fillColor = colRed + '0D';

      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(toX(i) - barW / 2, PAD.t, barW, ph);
      }
    });

    // ── Grid lines ──
    ctx.strokeStyle = colBorder;
    ctx.lineWidth = 0.5;
    for (let g = 0; g <= 3; g++) {
      const y = PAD.t + (ph / 3) * g;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(W - PAD.r, y);
      ctx.stroke();

      const val = yMax - (yRange / 3) * g;
      ctx.fillStyle = colText;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), W - PAD.r + 30, y + 3);
    }

    // ── Zero reference line ──
    if (yMin < 0 && yMax > 0) {
      const zeroY = toY(0);
      ctx.strokeStyle = colText + '66';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD.l, zeroY);
      ctx.lineTo(W - PAD.r, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // "0" label
      ctx.fillStyle = colText;
      ctx.font = '7px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('0', W - PAD.r + 12, zeroY + 3);
    }

    // ── Magic MA line (smoothed, background) ──
    ctx.strokeStyle = colGold + '66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let maStarted = false;
    visible.forEach((d, i) => {
      if (d.magic_ma != null) {
        const y = toY(d.magic_ma);
        if (!maStarted) { ctx.moveTo(toX(i), y); maStarted = true; }
        else ctx.lineTo(toX(i), y);
      }
    });
    ctx.stroke();

    // ── Magic RS line (primary) ──
    ctx.strokeStyle = colIndigo;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let rsStarted = false;
    visible.forEach((d, i) => {
      if (d.magic_rs != null) {
        const y = toY(d.magic_rs);
        if (!rsStarted) { ctx.moveTo(toX(i), y); rsStarted = true; }
        else ctx.lineTo(toX(i), y);
      }
    });
    ctx.stroke();

    // ── Active index marker ──
    const activeLocal = activeIndex - startIdx;
    if (activeLocal >= 0 && activeLocal < n) {
      const ax = toX(activeLocal);
      ctx.strokeStyle = colGold + '99';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ax, PAD.t);
      ctx.lineTo(ax, CHART_H - PAD.b);
      ctx.stroke();
      ctx.setLineDash([]);

      // Value tag
      const activeVal = visible[activeLocal]?.magic_rs;
      if (activeVal != null) {
        const tagW = 36, tagH = 14;
        const tagY = toY(activeVal) - tagH / 2;
        ctx.fillStyle = colIndigo;
        ctx.beginPath();
        ctx.roundRect(W - PAD.r + 4, tagY, tagW, tagH, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(activeVal.toFixed(1), W - PAD.r + 4 + tagW / 2, tagY + 10);
      }
    }
  }, [data, activeIndex]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  return (
    <div ref={containerRef} style={{ borderRadius: 6, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
