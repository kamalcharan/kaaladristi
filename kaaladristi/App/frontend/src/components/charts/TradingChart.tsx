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

import { useRef, useEffect, useCallback } from 'react';
import {
  createChart,
  createSeriesMarkers,
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

// ── SMA config ──
const SMA_LINES: { key: keyof IndicatorRow; color: string; label: string; width: LineWidth }[] = [
  { key: 'sma_21',  color: '#FFD700', label: 'SMA 21',  width: 1 },
  { key: 'sma_50',  color: '#FF6347', label: 'SMA 50',  width: 1 },
  { key: 'sma_150', color: '#00CED1', label: 'SMA 150', width: 2 },  // Golden Line
  { key: 'sma_200', color: '#DA70D6', label: 'SMA 200', width: 1 },
];

interface TradingChartProps {
  data: IndicatorRow[];
  height?: number;
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

export default function TradingChart({ data, height = 900 }: TradingChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const sniperRef = useRef<HTMLDivElement>(null);
  const magicRef = useRef<HTMLDivElement>(null);

  const chartsRef = useRef<IChartApi[]>([]);

  const buildCharts = useCallback(() => {
    if (!mainRef.current || !rsiRef.current || !sniperRef.current || !magicRef.current) return;
    if (data.length === 0) return;

    // Read theme colors from CSS vars
    const C = getThemeColors();

    // Cleanup previous
    chartsRef.current.forEach((c) => c.remove());
    chartsRef.current = [];

    const mainHeight = Math.round(height * 0.50);
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

    // SMA lines
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
      if (d.supertrend != null) {
        stData.push({ time: toTime(d.trade_date), value: d.supertrend });
      }
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
    // PANE 2: RSI(14) + MFI(14)
    // ═══════════════════════════════════════════════════════════════════

    const rsiChart = createChart(rsiRef.current, {
      ...createChartOptions(rsiRef.current, subHeight, C),
      rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.05, bottom: 0.05 } },
    });
    chartsRef.current.push(rsiChart);

    // RSI line
    const rsiLine: LineData<Time>[] = [];
    for (const d of data) { if (d.rsi_14 != null) rsiLine.push({ time: toTime(d.trade_date), value: d.rsi_14 }); }
    if (rsiLine.length > 0) {
      const rsiSeries = rsiChart.addSeries(LineSeries, { color: C.violet, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: true });
      rsiSeries.setData(rsiLine);
    }

    // MFI line
    const mfiLine: LineData<Time>[] = [];
    for (const d of data) { if (d.mfi_14 != null) mfiLine.push({ time: toTime(d.trade_date), value: d.mfi_14 }); }
    if (mfiLine.length > 0) {
      const mfiSeries = rsiChart.addSeries(LineSeries, { color: C.cyan, lineWidth: 1 as LineWidth, priceLineVisible: false, lastValueVisible: true });
      mfiSeries.setData(mfiLine);
    }

    // OB/OS reference lines
    const refOpts = { color: 'rgba(255,255,255,0.12)', lineWidth: 1 as LineWidth, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
    const obLine = rsiChart.addSeries(LineSeries, refOpts);
    obLine.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 70 })));
    const osLine = rsiChart.addSeries(LineSeries, refOpts);
    osLine.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 30 })));

    // ═══════════════════════════════════════════════════════════════════
    // PANE 3: Sniper Dragon Histogram
    // ═══════════════════════════════════════════════════════════════════

    const sniperChart = createChart(sniperRef.current, {
      ...createChartOptions(sniperRef.current, subHeight, C),
      rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.05, bottom: 0.05 } },
    });
    chartsRef.current.push(sniperChart);

    // Retail (green background)
    const retailSeries = sniperChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
    retailSeries.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 50, color: 'rgba(4,140,11,0.3)' })));

    // Hot Money (yellow)
    const hotData: HistogramData<Time>[] = [];
    for (const d of data) { if (d.sniper_hot != null) hotData.push({ time: toTime(d.trade_date), value: d.sniper_hot, color: 'rgba(255,235,59,0.7)' }); }
    if (hotData.length > 0) {
      const hotSeries = sniperChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      hotSeries.setData(hotData);
    }

    // Institutional (red)
    const instData: HistogramData<Time>[] = [];
    for (const d of data) { if (d.sniper_inst != null) instData.push({ time: toTime(d.trade_date), value: d.sniper_inst, color: 'rgba(255,0,0,0.7)' }); }
    if (instData.length > 0) {
      const instSeries = sniperChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      instSeries.setData(instData);
    }

    // Sniper RSI line
    const sniperRsiLine: LineData<Time>[] = [];
    for (const d of data) { if (d.sniper_rsi != null) sniperRsiLine.push({ time: toTime(d.trade_date), value: d.sniper_rsi }); }
    if (sniperRsiLine.length > 0) {
      const sniperRsiSeries = sniperChart.addSeries(LineSeries, { color: C.textPrimary, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: false });
      sniperRsiSeries.setData(sniperRsiLine);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PANE 4: MagicRS + MagicMA
    // ═══════════════════════════════════════════════════════════════════

    const magicChart = createChart(magicRef.current, {
      ...createChartOptions(magicRef.current, subHeight, C),
      rightPriceScale: { borderColor: C.grid, scaleMargins: { top: 0.05, bottom: 0.05 } },
    });
    chartsRef.current.push(magicChart);

    // MagicRS line
    const rsLine: LineData<Time>[] = [];
    for (const d of data) { if (d.magic_rs != null) rsLine.push({ time: toTime(d.trade_date), value: d.magic_rs }); }
    if (rsLine.length > 0) {
      const rsSeries = magicChart.addSeries(LineSeries, { color: C.riskGreen, lineWidth: 2 as LineWidth, priceLineVisible: false, lastValueVisible: true });
      rsSeries.setData(rsLine);
    }

    // MagicMA line
    const maLine: LineData<Time>[] = [];
    for (const d of data) { if (d.magic_ma != null) maLine.push({ time: toTime(d.trade_date), value: d.magic_ma }); }
    if (maLine.length > 0) {
      const maSeries = magicChart.addSeries(LineSeries, { color: C.indigo, lineWidth: 1 as LineWidth, priceLineVisible: false, lastValueVisible: true });
      maSeries.setData(maLine);
    }

    // Zero line
    const zeroLine = magicChart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.15)', lineWidth: 1 as LineWidth, lineStyle: LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    zeroLine.setData(data.map((d) => ({ time: toTime(d.trade_date), value: 0 })));

    // ═══════════════════════════════════════════════════════════════════
    // SYNC TIME SCALES
    // ═══════════════════════════════════════════════════════════════════

    const allCharts = [mainChart, rsiChart, sniperChart, magicChart];
    allCharts.forEach((chart, i) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) {
          allCharts.forEach((other, j) => {
            if (i !== j) other.timeScale().setVisibleLogicalRange(range);
          });
        }
      });
    });

    mainChart.timeScale().fitContent();
  }, [data, height]);

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
    };
  }, [buildCharts]);

  return (
    <div className="space-y-0.5">
      {/* Legend */}
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

      <div ref={mainRef} className="rounded-xl overflow-hidden" />

      <div className="relative">
        <span className="absolute top-1 left-2 text-[10px] text-muted z-10 pointer-events-none">
          RSI(14) <span style={{ color: 'var(--accent-violet)' }}>━</span> &nbsp; MFI(14) <span style={{ color: 'var(--accent-cyan)' }}>━</span>
        </span>
        <div ref={rsiRef} className="rounded-xl overflow-hidden" />
      </div>

      <div className="relative">
        <span className="absolute top-1 left-2 text-[10px] text-muted z-10 pointer-events-none">
          Sniper Dragon — <span style={{ color: 'var(--risk-red)' }}>Inst</span> / <span style={{ color: 'var(--risk-amber)' }}>Hot$</span> / <span style={{ color: 'var(--risk-green)' }}>Retail</span>
        </span>
        <div ref={sniperRef} className="rounded-xl overflow-hidden" />
      </div>

      <div className="relative">
        <span className="absolute top-1 left-2 text-[10px] text-muted z-10 pointer-events-none">
          MagicRS <span style={{ color: 'var(--risk-green)' }}>━</span> &nbsp; MagicMA <span style={{ color: 'var(--accent-indigo)' }}>━</span>
        </span>
        <div ref={magicRef} className="rounded-xl overflow-hidden" />
      </div>
    </div>
  );
}
