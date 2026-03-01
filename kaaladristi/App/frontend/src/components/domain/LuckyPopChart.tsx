import { useEffect, useRef, useMemo, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { KmIndexEod, TimeRange } from '@/types';
import { cn } from '@/lib/utils';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

// ── SMA color palette (matching PineScript) ──
const SMA_COLORS = {
  sma_8:       '#3b82f6', // blue
  sma_21:      '#ef4444', // red
  sma_55:      '#22c55e', // green
  sma_89:      '#a855f7', // purple
  sma_233:     '#f97316', // orange
  golden_line: '#facc15', // yellow (thicker)
} as const;

// ── Dot signal colors ──
const DOT_COLORS = {
  svd: '#a855f7', // purple  — institutional buying
  sbd: '#3b82f6', // blue    — accumulation
  syd: '#eab308', // yellow  — distribution
} as const;

// ── Recommendation color map ──
const REC_COLORS: Record<string, string> = {
  'POWER BUY':     '#10b981',
  'STRONG BUY':    '#10b981',
  'BUY CONFIRMED': '#22c55e',
  'BUY':           '#84cc16',
  'BUY BOOK FAST': '#eab308',
  'POWER SELL':    '#ef4444',
  'STRONG SELL':   '#ef4444',
  'SELL':          '#f87171',
  'SELL BOOK FAST':'#f97316',
  'SCALP SHORT':   '#fb923c',
  'SCALP ONLY':    '#fbbf24',
  'CAUTION':       '#fbbf24',
  'SQUEEZE RISK':  '#a855f7',
  'ACCUMULATION':  '#14b8a6',
  'DISTRIBUTION':  '#f97316',
  'NO TRADE':      '#6b7280',
  'WAIT':          '#4b5563',
  'AVOID':         '#374151',
};

interface LuckyPopChartProps {
  data: KmIndexEod[];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
}

function toTime(dateStr: string): Time {
  return dateStr as Time;
}

export default function LuckyPopChart({ data, range, onRangeChange }: LuckyPopChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const supertrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Track latest bar for info panel
  const [activeBar, setActiveBar] = useState<KmIndexEod | null>(null);

  // Memoize chart data transformations
  const candleData = useMemo<CandlestickData[]>(() =>
    data.map((d) => ({
      time: toTime(d.trade_date),
      open: d.open ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      close: d.close ?? 0,
    })),
    [data],
  );

  const volumeData = useMemo<HistogramData[]>(() =>
    data.map((d) => ({
      time: toTime(d.trade_date),
      value: d.volume ?? 0,
      color: (d.close ?? 0) >= (d.open ?? 0)
        ? 'rgba(16, 185, 129, 0.4)' // green
        : 'rgba(239, 68, 68, 0.4)',  // red
    })),
    [data],
  );

  // Build SMA line data — only if at least some rows have values
  const smaLineData = useMemo(() => {
    const smaKeys = ['sma_8', 'sma_21', 'sma_55', 'sma_89', 'sma_233', 'golden_line'] as const;
    const result: Record<string, LineData[]> = {};

    for (const key of smaKeys) {
      const points = data
        .filter((d) => d[key] != null)
        .map((d) => ({ time: toTime(d.trade_date), value: d[key] as number }));
      if (points.length > 0) {
        result[key] = points;
      }
    }
    return result;
  }, [data]);

  // SuperTrend line data with color segments
  const supertrendData = useMemo(() => {
    const points = data
      .filter((d) => d.supertrend_val != null)
      .map((d) => ({
        time: toTime(d.trade_date),
        value: d.supertrend_val as number,
        color: d.supertrend_dir === 1 ? '#22c55e' : '#ef4444',
      }));
    return points.length > 0 ? points : null;
  }, [data]);

  // Dot markers for candlestick series
  const markers = useMemo(() => {
    const m: any[] = [];
    for (const d of data) {
      if (d.svd_condition) {
        m.push({
          time: toTime(d.trade_date),
          position: 'belowBar',
          color: DOT_COLORS.svd,
          shape: 'circle',
          text: 'SVD',
        });
      }
      if (d.sbd_condition) {
        m.push({
          time: toTime(d.trade_date),
          position: 'belowBar',
          color: DOT_COLORS.sbd,
          shape: 'circle',
          text: 'SBD',
        });
      }
      if (d.syd_condition) {
        m.push({
          time: toTime(d.trade_date),
          position: 'belowBar',
          color: DOT_COLORS.syd,
          shape: 'circle',
          text: 'SYD',
        });
      }
      if (d.st_buy_signal) {
        m.push({
          time: toTime(d.trade_date),
          position: 'belowBar',
          color: '#22c55e',
          shape: 'arrowUp',
          text: 'BUY',
        });
      }
      if (d.st_sell_signal) {
        m.push({
          time: toTime(d.trade_date),
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'SELL',
        });
      }
    }
    // Must be sorted by time
    m.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return m;
  }, [data]);

  // Set activeBar to latest on data change
  useEffect(() => {
    if (data.length > 0) {
      setActiveBar(data[data.length - 1]);
    }
  }, [data]);

  // Create & update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      smaSeriesRefs.current.clear();
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99, 102, 241, 0.3)', labelBackgroundColor: '#6366f1' },
        horzLine: { color: 'rgba(99, 102, 241, 0.3)', labelBackgroundColor: '#6366f1' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // ── Volume histogram (rendered first, behind candles) ──
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    // ── Candlestick series ──
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });
    candleSeries.setData(candleData);
    candleSeriesRef.current = candleSeries;

    // ── Markers (dots + buy/sell signals) ──
    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }

    // ── SMA line overlays ──
    for (const [key, lineData] of Object.entries(smaLineData)) {
      const isGolden = key === 'golden_line';
      const color = SMA_COLORS[key as keyof typeof SMA_COLORS] ?? '#9ca3af';
      const series = chart.addLineSeries({
        color,
        lineWidth: isGolden ? 2 : 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(lineData);
      smaSeriesRefs.current.set(key, series);
    }

    // ── SuperTrend overlay ──
    if (supertrendData) {
      const stSeries = chart.addLineSeries({
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      stSeries.setData(supertrendData);
      supertrendSeriesRef.current = stSeries;
    }

    // ── Crosshair move handler — update active bar ──
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        // Reset to latest when mouse leaves
        if (data.length > 0) setActiveBar(data[data.length - 1]);
        return;
      }
      const timeStr = param.time as string;
      const bar = data.find((d) => d.trade_date === timeStr);
      if (bar) setActiveBar(bar);
    });

    // ── Fit content ──
    chart.timeScale().fitContent();

    // ── Resize observer ──
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      smaSeriesRefs.current.clear();
    };
  }, [candleData, volumeData, smaLineData, supertrendData, markers, data]);

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const hasIndicators = latest?.sma_8 != null;

  return (
    <div>
      {/* Time range selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200',
                range === r
                  ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5',
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {/* SMA Legend */}
        {hasIndicators && (
          <div className="flex items-center gap-3 text-[10px]">
            {Object.entries(SMA_COLORS).map(([key, color]) => (
              <span key={key} className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                <span className="text-slate-500">{key === 'golden_line' ? 'GL(150)' : key.replace('sma_', 'SMA ')}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chart + Info Panel side by side */}
      <div className="flex gap-4">
        {/* Chart container */}
        <div className="flex-1 min-w-0">
          <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden" />
        </div>

        {/* Info Panel — shows indicator values for hovered/latest bar */}
        {activeBar && (
          <InfoPanel bar={activeBar} hasIndicators={hasIndicators} />
        )}
      </div>
    </div>
  );
}

// ── Info Panel Component ──
function InfoPanel({ bar, hasIndicators }: { bar: KmIndexEod; hasIndicators: boolean }) {
  const rec = bar.recommendation;
  const recColor = rec ? (REC_COLORS[rec] ?? '#6b7280') : '#6b7280';
  const isPositive = (bar.close ?? 0) >= (bar.open ?? 0);

  return (
    <div className="w-56 shrink-0 space-y-2 text-[11px]">
      {/* Recommendation badge */}
      {rec && (
        <div
          className="rounded-lg px-3 py-2 text-center font-bold text-white text-sm"
          style={{ backgroundColor: recColor }}
        >
          {rec}
          {bar.rec_reason && (
            <div className="text-[10px] font-normal opacity-80 mt-0.5">{bar.rec_reason}</div>
          )}
        </div>
      )}

      {/* OHLCV */}
      <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
        <div className="text-slate-500 font-bold text-[10px] uppercase tracking-wider mb-1">{bar.trade_date}</div>
        <Row label="Open" value={fmt(bar.open)} />
        <Row label="High" value={fmt(bar.high)} color="#10b981" />
        <Row label="Low" value={fmt(bar.low)} color="#ef4444" />
        <Row label="Close" value={fmt(bar.close)} bold color={isPositive ? '#10b981' : '#ef4444'} />
        {bar.volume != null && <Row label="Volume" value={fmtVol(bar.volume)} />}
      </div>

      {/* Indicators — only show when computed */}
      {hasIndicators && (
        <>
          {/* Bias & Momentum */}
          {(bar.bias_status || bar.momentum_status) && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              {bar.bias_status && <Row label="Bias" value={bar.bias_status} color={bar.bias_status === 'LONG' ? '#10b981' : bar.bias_status === 'SHORT' ? '#ef4444' : '#6b7280'} />}
              {bar.momentum_status && <Row label="Momentum" value={bar.momentum_status} />}
              {bar.display_mode && <Row label="Mode" value={bar.display_mode} />}
            </div>
          )}

          {/* RSI / MFI */}
          {(bar.rsi != null || bar.mfi != null) && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              {bar.rsi != null && <Row label="RSI" value={bar.rsi.toFixed(1)} color={bar.rsi > 70 ? '#ef4444' : bar.rsi < 30 ? '#10b981' : undefined} />}
              {bar.mfi != null && <Row label="MFI" value={bar.mfi.toFixed(1)} color={bar.mfi > 70 ? '#ef4444' : bar.mfi < 30 ? '#10b981' : undefined} />}
              {bar.obv_trend && <Row label="OBV" value={bar.obv_trend} color={bar.obv_trend === 'Bullish' ? '#10b981' : bar.obv_trend === 'Bearish' ? '#ef4444' : undefined} />}
            </div>
          )}

          {/* Volume Metrics */}
          {(bar.rvol != null || bar.tvol != null) && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              {bar.rvol != null && <Row label="RVOL" value={bar.rvol.toFixed(2)} color={bar.rvol >= 1.5 ? '#10b981' : bar.rvol < 0.5 ? '#ef4444' : undefined} />}
              {bar.tvol != null && <Row label="TVOL" value={bar.tvol.toFixed(2)} color={bar.tvol >= 1.0 ? '#10b981' : bar.tvol < 0.5 ? '#ef4444' : undefined} />}
            </div>
          )}

          {/* Chartink Rules */}
          {bar.chartink_score != null && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="Chartink" value={`${bar.chartink_score}/3 ${bar.chartink_status ?? ''}`} color={bar.chartink_score >= 3 ? '#10b981' : bar.chartink_score >= 2 ? '#eab308' : '#ef4444'} />
            </div>
          )}

          {/* MagicRS */}
          {bar.magicrs_pts != null && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="MagicRS" value={`${bar.magicrs_pts}/6`} color={bar.magicrs_pts >= 5 ? '#10b981' : bar.magicrs_pts <= 2 ? '#ef4444' : '#eab308'} />
            </div>
          )}

          {/* Confluence */}
          {bar.confluence != null && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="Confluence" value={`${bar.confluence}/10`} color={bar.confluence >= 8 ? '#10b981' : bar.confluence >= 4 ? '#eab308' : '#ef4444'} />
            </div>
          )}

          {/* Divergence */}
          {bar.div_type && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="RSI Div" value={`${bar.div_type} (${bar.div_bars_ago ?? '?'})`} />
            </div>
          )}

          {/* Flow */}
          {bar.flow_type && bar.flow_type !== 'GREY' && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="Flow" value={bar.flow_type} />
              {bar.flow_meaning && <Row label="" value={bar.flow_meaning} />}
            </div>
          )}

          {/* IB30 */}
          {bar.ib30_status && bar.ib30_status !== 'FORMING' && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="IB30" value={bar.ib30_status} color={bar.ib30_status === 'BREAK UP' ? '#10b981' : bar.ib30_status === 'BREAK DOWN' ? '#ef4444' : undefined} />
              {bar.breakout_label && bar.breakout_label !== 'NO BREAK' && (
                <Row label="Break Q" value={`${bar.breakout_label} (${bar.breakout_quality ?? 0}/6)`} />
              )}
            </div>
          )}

          {/* SMA Distances */}
          {bar.dist_golden != null && (
            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2.5 space-y-1">
              <Row label="GL Dist" value={`${bar.dist_golden.toFixed(2)}%`} color={(bar.dist_golden ?? 0) > 0 ? '#10b981' : '#ef4444'} />
              {bar.dist_sma_21 != null && <Row label="SMA21" value={`${bar.dist_sma_21.toFixed(2)}%`} />}
            </div>
          )}
        </>
      )}

      {/* No indicators message */}
      {!hasIndicators && (
        <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3 text-center text-slate-500">
          <p className="text-[10px]">Indicators not yet computed.</p>
          <p className="text-[10px] mt-1">Run the compute pipeline to populate.</p>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──
function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn('mono', bold && 'font-bold')}
        style={color ? { color } : { color: '#cbd5e1' }}
      >
        {value}
      </span>
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}
