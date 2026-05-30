/**
 * TradingChart — Multi-pane financial chart using TradingView Lightweight Charts v5.
 *
 * Pane 1: Candlestick + Volume + SMA overlays + SuperTrend + Dot/Swing markers
 * Pane 2: RSI (14) + MFI
 * Pane 3: Sniper Dragon histogram
 * Pane 4: MagicRS + MagicMA
 *
 * All panes share a synced time scale.
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  createChart,
  createSeriesMarkers,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type SeriesMarker,
  type Time,
  type LineWidth,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import type { IndicatorRow } from '@/services/indicatorData';
import type { ChartOverlay } from '@/types/framework';
import type { AstroBand } from '@/services/astroOverlayService';

// ── SMA config — used in legacy (non-workspace) mode ──
const SMA_LINES: { key: keyof IndicatorRow; color: string; label: string; width: LineWidth }[] = [
  { key: 'sma_21',  color: '#FFD700', label: 'SMA 21',  width: 1 },
  { key: 'sma_50',  color: '#FF6347', label: 'SMA 50',  width: 1 },
  { key: 'sma_150', color: '#00CED1', label: 'SMA 150', width: 2 },
  { key: 'sma_200', color: '#DA70D6', label: 'SMA 200', width: 1 },
];

// ── Overlay → IndicatorRow column + default color ──
// Used in workspaceMode to draw framework-driven indicator lines.
const OVERLAY_COL: Partial<Record<string, keyof IndicatorRow>> = {
  'ema_20':     'ema_20',
  'ema_60':     'ema_60',
  'sma_50':     'sma_50',
  'sma_150':    'sma_150',
  'sma_200':    'sma_200',
  'supertrend': 'supertrend',
};

const OVERLAY_DEFAULT_COLOR: Record<string, string> = {
  'ema_20':     '#FFD700',
  'ema_60':     '#FFA500',
  'sma_50':     '#FF6347',
  'sma_150':    '#00CED1',
  'sma_200':    '#DA70D6',
  'supertrend': '#10b981',
};

interface TradingChartProps {
  data: IndicatorRow[];
  height?: number;
  compact?: boolean;       // hide RSI + Sniper panes (Visual Pulse mode)
  workspaceMode?: boolean; // framework-driven: no hardcoded overlays/subpanes
  highlightDate?: string | null;
  overlays?: ChartOverlay[];
  astroBands?: AstroBand[];
  // Workspace sync callbacks — no-op when not provided
  onVisibleRangeChange?: (from: string, to: string) => void;
  onCrosshairMove?: (barIndex: number, date: string) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(201,168,76,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function toTime(dateStr: string): Time {
  return dateStr as Time;
}

// ── Chart colors — read from CSS custom properties at render time ──
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg:         v('--kd-bg',            '#030712'),
    grid:       v('--kd-border',        'rgba(255,255,255,0.06)'),
    text:       v('--text-muted',       '#64748b'),
    crosshair:  v('--kd-border-active', 'rgba(99,102,241,0.4)'),
    riskGreen:  v('--risk-green',       '#10b981'),
    riskRed:    v('--risk-red',         '#ef4444'),
    riskAmber:  v('--risk-amber',       '#f59e0b'),
    violet:     v('--accent-violet',    '#8b5cf6'),
    cyan:       v('--accent-cyan',      '#06b6d4'),
    indigo:     v('--accent-indigo',    '#6366f1'),
    textPrimary: v('--text-primary',    '#f8fafc'),
  };
}

function createChartOptions(container: HTMLElement, height: number, colors: ReturnType<typeof getThemeColors>) {
  return {
    width: container.clientWidth,
    height,
    layout: {
      background: { type: ColorType.Solid as const, color: colors.bg },
      textColor: colors.text,
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: colors.grid },
      horzLines: { color: colors.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: colors.crosshair, width: 1 as LineWidth, style: LineStyle.Dashed, labelVisible: true },
      horzLine: { color: colors.crosshair, width: 1 as LineWidth, style: LineStyle.Dashed, labelVisible: true },
    },
    rightPriceScale: {
      borderColor: colors.grid,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderColor: colors.grid,
      timeVisible: false,
      rightOffset: 5,
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale: { mouseWheel: true, pinch: true },
  };
}

export default function TradingChart({ data, height = 900, compact = false, workspaceMode = false, highlightDate = null, overlays = [], astroBands = [], onVisibleRangeChange, onCrosshairMove }: TradingChartProps) {
  const mainRef      = useRef<HTMLDivElement>(null);
  const rsiRef       = useRef<HTMLDivElement>(null);
  const sniperRef    = useRef<HTMLDivElement>(null);
  const magicRef     = useRef<HTMLDivElement>(null);
  const bandCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainChartRef  = useRef<IChartApi | null>(null);
  const drawBandsRef  = useRef<(() => void) | null>(null);

  const chartsRef = useRef<IChartApi[]>([]);

  // Tooltip state for astro band hover
  const [bandTooltip, setBandTooltip] = useState<{
    x: number; y: number; band: AstroBand
  } | null>(null);

  // Astro-zone overlays are drawn by the canvas overlay — exclude them from
  // buildCharts deps so adding/removing an astro rule doesn't trigger a full
  // chart rebuild (which would wipe mainChartRef before the fetch completes).
  const indicatorOverlays = useMemo(
    () => overlays.filter(o => o.type !== 'astro_zone'),
    [overlays],
  );

  const buildCharts = useCallback(() => {
    if (!mainRef.current) return;
    if (!workspaceMode && !magicRef.current) return;
    if (!workspaceMode && !compact && (!rsiRef.current || !sniperRef.current)) return;
    if (data.length === 0) return;

    // Read theme colors from CSS vars
    const C = getThemeColors();

    // Cleanup previous
    chartsRef.current.forEach((c) => c.remove());
    chartsRef.current = [];

    const mainHeight = workspaceMode
      ? height
      : compact ? Math.round(height * 0.70) : Math.round(height * 0.50);
    const subHeight = Math.round(height * 0.16);

    // ═══════════════════════════════════════════════════════════════════
    // PANE 1: Candlestick + Volume + SMA + SuperTrend + Markers
    // ═══════════════════════════════════════════════════════════════════

    const mainChart = createChart(mainRef.current, {
      ...createChartOptions(mainRef.current, mainHeight, C),
      rightPriceScale: {
        borderColor: C.grid,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
    });
    chartsRef.current.push(mainChart);

    // Candlestick
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: C.riskGreen,
      downColor: C.riskRed,
      borderUpColor: C.riskGreen,
      borderDownColor: C.riskRed,
      wickUpColor: C.riskGreen + '80',
      wickDownColor: C.riskRed + '80',
    });

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: toTime(d.trade_date),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    // Volume histogram (overlay, pinned to bottom)
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    mainChart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volData: HistogramData<Time>[] = data.map((d) => ({
      time: toTime(d.trade_date),
      value: d.volume || 0,
      color: d.close >= d.open ? C.riskGreen + '4d' : C.riskRed + '4d',
    }));
    volumeSeries.setData(volData);

    // SMA lines — only in legacy (non-workspace) mode
    if (!workspaceMode) {
      for (const sma of SMA_LINES) {
        const lineData: LineData<Time>[] = [];
        for (const d of data) {
          const val = d[sma.key] as number | null;
          if (val != null) lineData.push({ time: toTime(d.trade_date), value: val });
        }
        if (lineData.length > 0) {
          const series = mainChart.addSeries(LineSeries, {
            color: sma.color,
            lineWidth: sma.width,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          series.setData(lineData);
        }
      }

      // SuperTrend line
      const stData: LineData<Time>[] = [];
      for (const d of data) {
        if (d.supertrend != null) stData.push({ time: toTime(d.trade_date), value: d.supertrend });
      }
      if (stData.length > 0) {
        const stSeries = mainChart.addSeries(LineSeries, {
          color: C.riskGreen,
          lineWidth: 2 as LineWidth,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        stSeries.setData(stData);
      }
    }

    // Markers: Dot signals + Swing High/Low
    const markers: SeriesMarker<Time>[] = [];
    for (const d of data) {
      if (d.dot_svd) markers.push({ time: toTime(d.trade_date), position: 'belowBar', color: C.violet, shape: 'circle', text: 'SVD' });
      if (d.dot_sbd) markers.push({ time: toTime(d.trade_date), position: 'belowBar', color: C.indigo, shape: 'circle', text: 'SBD' });
      if (d.dot_syd) markers.push({ time: toTime(d.trade_date), position: 'aboveBar', color: C.riskAmber, shape: 'circle', text: 'SYD' });
      if (d.swing_high) markers.push({ time: toTime(d.trade_date), position: 'aboveBar', color: C.riskRed, shape: 'arrowDown', text: 'SH' });
      if (d.swing_low) markers.push({ time: toTime(d.trade_date), position: 'belowBar', color: C.riskGreen, shape: 'arrowUp', text: 'SL' });
    }
    if (markers.length > 0) {
      markers.sort((a, b) => (a.time as string).localeCompare(b.time as string));
      createSeriesMarkers(candleSeries, markers);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PANE 2: RSI(14) + MFI(14) — hidden in compact mode
    // ═══════════════════════════════════════════════════════════════════

    let rsiChart: IChartApi | null = null;
    let sniperChart: IChartApi | null = null;

    if (!workspaceMode && !compact && rsiRef.current) {
      rsiChart = createChart(rsiRef.current, {
        ...createChartOptions(rsiRef.current, subHeight, C),
        rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.05, bottom: 0.05 } },
      });
      chartsRef.current.push(rsiChart);

      const rsiLine: LineData<Time>[] = [];
      for (const d of data) { if (d.rsi_14 != null) rsiLine.push({ time: toTime(d.trade_date), value: d.rsi_14 }); }
      if (rsiLine.length > 0) {
        const rsiSeries = rsiChart.addSeries(LineSeries, { color: C.violet, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: true });
        rsiSeries.setData(rsiLine);
      }

      const mfiLine: LineData<Time>[] = [];
      for (const d of data) { if (d.mfi_14 != null) mfiLine.push({ time: toTime(d.trade_date), value: d.mfi_14 }); }
      if (mfiLine.length > 0) {
        const mfiSeries = rsiChart.addSeries(LineSeries, { color: C.cyan, lineWidth: 1 as LineWidth, priceLineVisible: false, lastValueVisible: true });
        mfiSeries.setData(mfiLine);
      }

      const refOpts = { color: 'rgba(255,255,255,0.12)', lineWidth: 1 as LineWidth, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
      const obLine = rsiChart.addSeries(LineSeries, refOpts);
      obLine.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 70 })));
      const osLine = rsiChart.addSeries(LineSeries, refOpts);
      osLine.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 30 })));
    }

    // ═══════════════════════════════════════════════════════════════════
    // PANE 3: Sniper Dragon Histogram — hidden in compact mode
    // ═══════════════════════════════════════════════════════════════════

    if (!workspaceMode && !compact && sniperRef.current) {
      sniperChart = createChart(sniperRef.current, {
        ...createChartOptions(sniperRef.current, subHeight, C),
        rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.05, bottom: 0.05 } },
      });
      chartsRef.current.push(sniperChart);

      const retailSeries = sniperChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      retailSeries.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 50, color: 'rgba(4,140,11,0.3)' })));

      const hotData: HistogramData<Time>[] = [];
      for (const d of data) { if (d.sniper_hot != null) hotData.push({ time: toTime(d.trade_date), value: d.sniper_hot, color: 'rgba(255,235,59,0.7)' }); }
      if (hotData.length > 0) {
        const hotSeries = sniperChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
        hotSeries.setData(hotData);
      }

      const instData: HistogramData<Time>[] = [];
      for (const d of data) { if (d.sniper_inst != null) instData.push({ time: toTime(d.trade_date), value: d.sniper_inst, color: 'rgba(255,0,0,0.7)' }); }
      if (instData.length > 0) {
        const instSeries = sniperChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
        instSeries.setData(instData);
      }

      const sniperRsiLine: LineData<Time>[] = [];
      for (const d of data) { if (d.sniper_rsi != null) sniperRsiLine.push({ time: toTime(d.trade_date), value: d.sniper_rsi }); }
      if (sniperRsiLine.length > 0) {
        const sniperRsiSeries = sniperChart.addSeries(LineSeries, { color: C.textPrimary, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: false });
        sniperRsiSeries.setData(sniperRsiLine);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PANE 4: MagicRS + MagicMA — legacy mode only
    // ═══════════════════════════════════════════════════════════════════

    let magicChart: IChartApi | null = null;

    if (!workspaceMode && magicRef.current) {
      magicChart = createChart(magicRef.current, {
        ...createChartOptions(magicRef.current, subHeight, C),
        rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.05, bottom: 0.05 } },
      });
      chartsRef.current.push(magicChart);

      const rsLine: LineData<Time>[] = [];
      for (const d of data) { if (d.magic_rs != null) rsLine.push({ time: toTime(d.trade_date), value: d.magic_rs }); }
      if (rsLine.length > 0) {
        const rsSeries = magicChart.addSeries(LineSeries, { color: C.riskGreen, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: true });
        rsSeries.setData(rsLine);
      }

      const maLine: LineData<Time>[] = [];
      for (const d of data) { if (d.magic_ma != null) maLine.push({ time: toTime(d.trade_date), value: d.magic_ma }); }
      if (maLine.length > 0) {
        const maSeries = magicChart.addSeries(LineSeries, { color: C.indigo, lineWidth: 1 as LineWidth, priceLineVisible: false, lastValueVisible: true });
        maSeries.setData(maLine);
      }

      const zeroLine = magicChart.addSeries(LineSeries, {
        color: 'rgba(255,255,255,0.15)', lineWidth: 1 as LineWidth, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      zeroLine.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 0 })));
    }

    // ═══════════════════════════════════════════════════════════════════
    // OVERLAYS — framework-driven (all modes)
    // ═══════════════════════════════════════════════════════════════════

    for (const overlay of indicatorOverlays.filter(o => o.visible)) {
      const color = overlay.color ?? OVERLAY_DEFAULT_COLOR[overlay.catalog_item_id] ?? '#7c6af7'

      if (overlay.type === 'indicator_line') {
        const col = OVERLAY_COL[overlay.catalog_item_id]
        const lineData: LineData<Time>[] = col
          ? data.flatMap(d => {
              const val = d[col] as number | null
              return val != null ? [{ time: toTime(d.trade_date), value: val }] : []
            })
          : []

        if (lineData.length > 0) {
          const lineSeries = mainChart.addSeries(LineSeries, {
            color,
            lineWidth: 1 as LineWidth,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: false,
          })
          lineSeries.setData(lineData)
        }
      } else if (overlay.type === 'astro_zone') {
        // Deferred — requires rule engine data from km_rule_transits
      } else if (overlay.type === 'astro_marker') {
        // Deferred — requires km_astro_events wiring
      } else if (overlay.type === 'indicator_band') {
        // Deferred — pivot levels require separate multi-series rendering
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SYNC TIME SCALES
    // ═══════════════════════════════════════════════════════════════════

    const allCharts = [mainChart, rsiChart, sniperChart, magicChart].filter((c): c is IChartApi => c != null);
    allCharts.forEach((chart, i) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) {
          allCharts.forEach((other, j) => {
            if (i !== j) other.timeScale().setVisibleLogicalRange(range);
          });
        }
      });
    });

    // ── Workspace sync callbacks (no-op when not provided) ──
    if (onVisibleRangeChange) {
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range) return;
        const from = data[Math.max(0, Math.round(range.from))]?.trade_date;
        const to   = data[Math.min(data.length - 1, Math.round(range.to))]?.trade_date;
        if (from && to) onVisibleRangeChange(from, to);
      });
    }

    if (onCrosshairMove) {
      mainChart.subscribeCrosshairMove((param) => {
        if (!param.time) return;
        const date = param.time as string;
        const idx  = data.findIndex(d => d.trade_date === date);
        if (idx >= 0) onCrosshairMove(idx, date);
      });
    }

    mainChart.timeScale().fitContent();

    // Store ref so the bands canvas effect can reach the time scale
    mainChartRef.current = mainChart;
    // Trigger band redraw whenever the chart scrolls/zooms
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      drawBandsRef.current?.();
    });
    // Redraw bands immediately after chart rebuild (covers indicator overlay changes)
    requestAnimationFrame(() => { drawBandsRef.current?.(); });
  }, [data, height, compact, workspaceMode, indicatorOverlays, onVisibleRangeChange, onCrosshairMove]);

  // Scroll to highlighted date when slider moves
  useEffect(() => {
    if (!highlightDate || chartsRef.current.length === 0 || data.length === 0) return;
    const idx = data.findIndex((d) => d.trade_date === highlightDate);
    if (idx < 0) return;

    // Center the highlighted bar in view with some padding
    const barsToShow = 60;
    const from = Math.max(0, idx - barsToShow / 2);
    const to = Math.min(data.length - 1, from + barsToShow);
    chartsRef.current.forEach((chart) => {
      chart.timeScale().setVisibleLogicalRange({ from, to });
    });
  }, [highlightDate, data]);

  useEffect(() => {
    buildCharts();

    const handleResize = () => {
      if (!mainRef.current) return;
      const w = mainRef.current.clientWidth;
      chartsRef.current.forEach((chart) => chart.applyOptions({ width: w }));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartsRef.current.forEach((c) => c.remove());
      chartsRef.current = [];
      mainChartRef.current = null;
    };
  }, [buildCharts]);

  // ── Astro zone bands canvas overlay ────────────────────────────────────────
  useEffect(() => {
    const canvas = bandCanvasRef.current;

    function draw() {
      if (!canvas || !mainChartRef.current || !mainRef.current) return;
      const { width, height: h } = mainRef.current.getBoundingClientRect();
      if (width === 0 || h === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width        = width * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, h);

      if (astroBands.length === 0) return;

      const today = new Date().toISOString().slice(0, 10);
      const ts    = mainChartRef.current.timeScale();

      for (const band of astroBands) {
        const x1 = ts.timeToCoordinate(band.from as Time);
        const x2 = ts.timeToCoordinate(band.to   as Time);
        if (x1 == null || x2 == null) continue;

        const left  = Math.min(x1, x2);
        const bw    = Math.max(Math.abs(x2 - x1), 2);
        const isFuture = band.from > today;

        let fillColor: string;
        let borderColor: string;
        let dashed = false;

        if (band.matched === true) {
          fillColor   = hexToRgba(band.color, 0.12);
          borderColor = hexToRgba(band.color, 0.75);
        } else if (band.matched === false) {
          fillColor   = 'rgba(239,68,68,0.10)';
          borderColor = 'rgba(239,68,68,0.55)';
        } else {
          // null — not yet validated (past unbacktested or future transit)
          fillColor   = hexToRgba(band.color, 0.06);
          borderColor = hexToRgba(band.color, isFuture ? 0.50 : 0.30);
          dashed      = true;
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(left, 0, bw, h);

        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = 2;
        ctx.setLineDash(dashed ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(left + 1, 0);
        ctx.lineTo(left + 1, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    drawBandsRef.current = draw;
    draw();

    const ro = new ResizeObserver(draw);
    if (mainRef.current) ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      drawBandsRef.current = null;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [astroBands]);

  return (
    <div className="space-y-0.5">
      {/* Legend — legacy mode only */}
      {!workspaceMode && (
        <div className="flex items-center gap-4 mb-2 text-[10px] text-muted">
          {SMA_LINES.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded bg-risk-green" />
            SuperTrend
          </span>
        </div>
      )}

      <div
        style={{ position: 'relative' }}
        onMouseMove={e => {
          if (astroBands.length === 0 || !mainChartRef.current) {
            if (bandTooltip) setBandTooltip(null);
            return;
          }
          const rect   = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const ts     = mainChartRef.current.timeScale();
          let found: AstroBand | null = null;
          for (const band of astroBands) {
            const x1 = ts.timeToCoordinate(band.from as Time);
            const x2 = ts.timeToCoordinate(band.to   as Time);
            if (x1 == null || x2 == null) continue;
            const left  = Math.min(x1, x2);
            const right = Math.max(x1, x2);
            if (mouseX >= left && mouseX <= right) { found = band; break; }
          }
          if (found) {
            setBandTooltip({ x: mouseX, y: mouseY, band: found });
          } else if (bandTooltip) {
            setBandTooltip(null);
          }
        }}
        onMouseLeave={() => setBandTooltip(null)}
      >
        <div ref={mainRef} className="rounded-xl overflow-hidden" />
        <canvas
          ref={bandCanvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            pointerEvents: 'none', zIndex: 2,
            borderRadius: 12,
          }}
        />
        {bandTooltip && (
          <div style={{
            position: 'absolute',
            left: bandTooltip.x + 14,
            top:  Math.max(8, bandTooltip.y - 60),
            zIndex: 20,
            background: 'rgba(13,17,23,0.95)',
            border: `1px solid ${bandTooltip.band.color}55`,
            borderLeft: `3px solid ${bandTooltip.band.color}`,
            borderRadius: 6,
            padding: '7px 11px',
            pointerEvents: 'none',
            minWidth: 180,
            maxWidth: 260,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: bandTooltip.band.color, marginBottom: 4, lineHeight: 1.3 }}>
              {bandTooltip.band.displayName}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
              {bandTooltip.band.ruleCode}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span>{bandTooltip.band.from}</span>
              <span style={{ opacity: 0.35 }}>→</span>
              <span>{bandTooltip.band.to}</span>
            </div>
            <div style={{ marginTop: 5, fontSize: 10 }}>
              {bandTooltip.band.matched === true  && <span style={{ color: bandTooltip.band.color }}>✓ Confirmed</span>}
              {bandTooltip.band.matched === false && <span style={{ color: '#ef4444' }}>✗ Not matched</span>}
              {bandTooltip.band.matched === null  && (
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {bandTooltip.band.from > new Date().toISOString().slice(0,10) ? '◦ Future transit' : '◦ Pending validation'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {!workspaceMode && !compact && (
        <div className="relative">
          <span className="absolute top-1 left-2 text-[10px] text-muted z-10 pointer-events-none">
            RSI(14) <span style={{ color: 'var(--accent-violet)' }}>━</span> &nbsp; MFI(14) <span style={{ color: 'var(--accent-cyan)' }}>━</span>
          </span>
          <div ref={rsiRef} className="rounded-xl overflow-hidden" />
        </div>
      )}

      {!workspaceMode && !compact && (
        <div className="relative">
          <span className="absolute top-1 left-2 text-[10px] text-muted z-10 pointer-events-none">
            Sniper Dragon — <span style={{ color: 'var(--risk-red)' }}>Inst</span> / <span style={{ color: 'var(--risk-amber)' }}>Hot$</span> / <span style={{ color: 'var(--risk-green)' }}>Retail</span>
          </span>
          <div ref={sniperRef} className="rounded-xl overflow-hidden" />
        </div>
      )}

      {!workspaceMode && (
        <div className="relative">
          <span className="absolute top-1 left-2 text-[10px] text-muted z-10 pointer-events-none">
            MagicRS <span style={{ color: 'var(--risk-green)' }}>━</span> &nbsp; MagicMA <span style={{ color: 'var(--accent-indigo)' }}>━</span>
          </span>
          <div ref={magicRef} className="rounded-xl overflow-hidden" />
        </div>
      )}
    </div>
  );
}
