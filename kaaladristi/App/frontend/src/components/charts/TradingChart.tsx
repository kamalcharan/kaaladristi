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
  type WhitespaceData,
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
import { fmtDate, fmtDateShort } from '@/lib/dateUtils';
import { useQuery } from '@tanstack/react-query';
import { INDICATOR_DEFAULT_COLORS } from '@/constants/catalogItems';
import { planetColorOfRuleCode } from '@/constants/planetColors';
import { fetchConfidence, fetchBenchConfidence } from '@/pages/RuleEngine/ruleService';

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

// Catalog is the single source of truth for indicator colors
const OVERLAY_DEFAULT_COLOR = INDICATOR_DEFAULT_COLORS;

// Planet/group glyphs rendered on astro zone overlay bands
const BAND_GLYPHS: Record<string, string> = {
  Mercury:      '☿',
  Venus:        '♀',
  Bayer:        '⬡',
  MajorTransit: '⟳',
  Panchak:      '◈',
  Gandanta:     '♂',
  Neptune:      '♆',
}

interface TradingChartProps {
  data: IndicatorRow[];
  height?: number;
  compact?: boolean;       // hide RSI + Sniper panes (Visual Pulse mode)
  workspaceMode?: boolean; // framework-driven: no hardcoded overlays/subpanes
  highlightDate?: string | null;
  overlays?: ChartOverlay[];
  astroBands?: AstroBand[];
  /** Big Money days (Phase 3): gold dashed price line at each event's zone
   *  low + a ₹ marker on the event bar. Observational annotations only. */
  bigMoneyEvents?: { trade_date: string; price: number; label: string; color?: string }[];
  // Workspace sync callbacks — no-op when not provided
  onVisibleRangeChange?: (from: string, to: string) => void;
  onCrosshairMove?: (barIndex: number, date: string) => void;
  /** Fired when the user clicks an astro band — gives the band + screen coords.
   *  `coincident` (optional 4th arg) lists ALL bands under the click point,
   *  clicked band first — for popovers that explain a cluster, not one rule. */
  onZoneClick?: (band: AstroBand, clientX: number, clientY: number, coincident?: AstroBand[]) => void;
  /** Phase 3 (migration 139): when the viewed instrument is an INDEX, pass its
   *  id + name so the RULE OVERALL tooltip line uses that index's own
   *  confidence row (km_rule_confidence_bench). Falls back to the NIFTY 50
   *  aggregate when unset or when no per-benchmark row exists yet. */
  benchmarkIndexId?: number | null;
  benchmarkName?: string | null;
  /** Story-mode on-candle bubble: the current replay event, anchored by X to
   *  its candle. Null hides it. Observational annotation only. */
  storyBubble?: {
    date: string;
    tone: 'bull' | 'bear' | 'neutral';
    color: string;
    title: string;
    detail: string;
    reactionPct: number | null;
  } | null;
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

// Days of empty time-axis padding added on each side of the price data so astro
// overlay zones can paint before the first bar and into the future (past today).
const AXIS_PAD_DAYS = 90;

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Calendar dates in [fromStr, toStr) as YYYY-MM-DD whitespace anchors. */
function dayRange(fromStr: string, toStr: string): string[] {
  const out: string[] = [];
  let cur = fromStr;
  while (cur < toStr) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}

/** Short top-of-line label for a single-day point-event marker. */
function pointMarkerLabel(ruleCode: string): string {
  const rc = ruleCode.toUpperCase();
  if (rc.startsWith('TRN-MER-RIS-W')) return 'Mer↑';
  if (rc.startsWith('TRN-MER-RIS-E')) return 'Mer↓';
  if (rc.startsWith('TRN-VEN-RIS-W')) return 'Ven↑';
  if (rc.startsWith('TRN-VEN-RIS-E')) return 'Ven↓';
  const bay = rc.match(/^BAY-R0*(\d+)/);
  if (bay) return `B${bay[1]}`;
  if (rc.startsWith('DN')) return ruleCode.replace(/^DN[-_]?/i, '').slice(0, 3) || 'DN';
  // Planet glyphs for named-planet rules
  if (rc.startsWith('NEP-'))     return '♆';
  if (rc.startsWith('MAR-GAN-')) return '♂';
  if (rc.startsWith('PLU-'))     return '♇';
  if (rc.startsWith('JUP-'))     return '♃';
  if (rc.startsWith('SAT-'))     return '♄';
  return ruleCode.slice(0, 3);
}

// ── Chart colors — read from CSS custom properties at render time ──
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    // Paint the plot from the CARD surface, not the page (--kd-bg). In light
    // mode the page is warm ivory; a chart painted with it blended into the
    // canvas and read as "intertwined". --card is the raised white card surface
    // the chart actually sits on, so the plot now matches its container.
    bg:         v('--card',              '#030712'),
    grid:       v('--kd-border',        'color-mix(in srgb, var(--text-primary) 6%, transparent)'),
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

// Stable default identities — `= []` in the parameter list mints a NEW array
// every render, and bigMoneyEvents/overlays feed buildCharts' deps. With the
// crosshair legend re-rendering on every mouse move, fresh defaults caused a
// full chart rebuild per mousemove — wiping the user's zoom/scroll position
// (My Space bug, 2026-07-06).
const DEFAULT_OVERLAYS: NonNullable<TradingChartProps['overlays']> = [];
const DEFAULT_BANDS: NonNullable<TradingChartProps['astroBands']> = [];
const DEFAULT_BM_EVENTS: NonNullable<TradingChartProps['bigMoneyEvents']> = [];

export default function TradingChart({ data, height = 900, compact = false, workspaceMode = false, highlightDate = null, overlays = DEFAULT_OVERLAYS, astroBands = DEFAULT_BANDS, bigMoneyEvents = DEFAULT_BM_EVENTS, onVisibleRangeChange, onCrosshairMove, onZoneClick, benchmarkIndexId = null, benchmarkName = null, storyBubble = null }: TradingChartProps) {
  const mainRef      = useRef<HTMLDivElement>(null);
  const rsiRef       = useRef<HTMLDivElement>(null);
  const sniperRef    = useRef<HTMLDivElement>(null);
  const magicRef     = useRef<HTMLDivElement>(null);
  const bandCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainChartRef  = useRef<IChartApi | null>(null);
  const drawBandsRef  = useRef<(() => void) | null>(null);
  // # of leading whitespace points prepended to the candle series (workspace
  // mode only). Logical indices are offset by this vs. the `data` array.
  const leadOffsetRef = useRef(0);
  // Read astroBands inside buildCharts WITHOUT adding it to buildCharts' deps —
  // toggling an astro rule must NOT rebuild the whole chart (it redraws on the
  // bands canvas instead). The ±90-day axis padding is only worth its wasted
  // whitespace when astro zones (which can sit in the future) are present, so
  // buildCharts consults this ref to decide whether to pad or fit-to-data.
  const astroBandsRef = useRef(astroBands);
  useEffect(() => { astroBandsRef.current = astroBands; }, [astroBands]);

  const chartsRef = useRef<IChartApi[]>([]);

  // Story-mode bubble: track the current event candle's X (pixel) so the bubble
  // stays anchored to it as the event changes or the chart pans/zooms.
  const [bubbleX, setBubbleX] = useState<number | null>(null);
  useEffect(() => {
    const chart = mainChartRef.current;
    if (!chart || !storyBubble) { setBubbleX(null); return; }
    const ts = chart.timeScale();
    const compute = () => {
      const x = ts.timeToCoordinate(storyBubble.date as Time);
      setBubbleX(x != null ? x : null);
    };
    compute();
    ts.subscribeVisibleLogicalRangeChange(compute);
    return () => ts.unsubscribeVisibleLogicalRangeChange(compute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyBubble?.date]);

  // Tooltip state for astro band hover — bands: ALL events under the cursor
  // (coincident point markers list together instead of only the topmost).
  const [bandTooltip, setBandTooltip] = useState<{
    x: number; y: number; bands: AstroBand[]
  } | null>(null);

  // Per-rule aggregate confidence for the tooltip stats line — the shared
  // ['rule-engine','confidence'] query Catalog + Rules already use.
  const { data: confRows } = useQuery({
    queryKey: ['rule-engine', 'confidence'],
    queryFn: fetchConfidence,
    enabled: astroBands.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const confByRule = useMemo(
    () => new Map((confRows ?? []).map(c => [c.rule_id, c])),
    [confRows],
  );

  // Phase 3: the viewed index's own confidence rows (migration 139). Empty
  // until the table is populated — the tooltip falls back to NIFTY per rule.
  const { data: benchConfRows } = useQuery({
    queryKey: ['rule-engine', 'confidence-bench', benchmarkIndexId],
    queryFn: () => fetchBenchConfidence(benchmarkIndexId!),
    enabled: astroBands.length > 0 && benchmarkIndexId != null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const benchConfByRule = useMemo(
    () => new Map((benchConfRows ?? []).map(c => [c.rule_id, c])),
    [benchConfRows],
  );

  // Phase 2 of the benchmark gap (owner 2026-07-07): the NIFTY verdict stays,
  // but the tooltip also states what THE VIEWED INSTRUMENT did over the
  // hovered window — computed from the bars already on this chart. Mirrors
  // discovery's formula: close(start)→close(end), forward-walking up to 5
  // calendar days to the next trading day (confidence_scoring.py).
  const closeByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data) if (d.close != null) m.set(d.trade_date, d.close);
    return m;
  }, [data]);
  const lastBarDate = data.length > 0 ? data[data.length - 1].trade_date : null;

  const chartWindowReturn = (from: string, to: string): { pct: number; ongoing: boolean } | null => {
    if (!lastBarDate || from > lastBarDate) return null;   // upcoming / off-chart
    const addDays = (iso: string, n: number) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const closeOnOrAfter = (iso: string): number | null => {
      for (let k = 0; k <= 5; k++) {
        const c = closeByDate.get(addDays(iso, k));
        if (c != null) return c;
      }
      return null;
    };
    const start = closeOnOrAfter(from);
    if (start == null || start === 0) return null;
    const ongoing = to >= lastBarDate;
    const end = ongoing ? (closeByDate.get(lastBarDate) ?? null) : closeOnOrAfter(to);
    if (end == null) return null;
    return { pct: ((end - start) / start) * 100, ongoing };
  };

  // Crosshair hover readout (Phase 2.1): the hovered bar's OHLC + volume +
  // delivery% render as a floating legend — no more guessing values by eye.
  const [hoverBar, setHoverBar] = useState<Record<string, unknown> | null>(null);

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

    const candleData: CandlestickData<Time>[] = data
      .filter((d) => d.open != null && d.high != null && d.low != null && d.close != null)
      .map((d) => ({
        time: toTime(d.trade_date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

    // Workspace mode only: extend the time axis ±AXIS_PAD_DAYS with whitespace so
    // overlay zones can paint 3 months before the first bar and 3 months past
    // today (the future). Whitespace points render nothing but make those dates
    // addressable on the time scale (timeToCoordinate returns null off-scale).
    // Legacy multi-pane mode is left untouched (sub-panes have no whitespace, so
    // padding the main pane would desync their shared logical ranges).
    let leadOffset = 0;
    let padFrom: string | null = null;
    let padTo: string | null = null;
    // Only pad the axis when astro zones are present — they can sit in the
    // future, so the ±90-day whitespace makes those dates addressable. Without
    // astro, the padding just squeezes the candles into the middle and forces a
    // manual zoom-out (owner feedback) — so we fit the candles to the width
    // instead, which also lines the chart's right edge up with the scrubber's
    // NOW.
    const padAxis = workspaceMode && astroBandsRef.current.length > 0;
    if (padAxis) {
      const firstDate = data[0].trade_date;
      const lastDate  = data[data.length - 1].trade_date;
      const todayStr  = new Date().toISOString().slice(0, 10);
      const padEndAnchor = lastDate > todayStr ? lastDate : todayStr;
      padFrom = addDays(firstDate, -AXIS_PAD_DAYS);
      padTo   = addDays(padEndAnchor, AXIS_PAD_DAYS);
      const leadWs: WhitespaceData<Time>[] = dayRange(padFrom, firstDate)
        .map((t) => ({ time: toTime(t) }));
      const trailWs: WhitespaceData<Time>[] = dayRange(addDays(lastDate, 1), addDays(padTo, 1))
        .map((t) => ({ time: toTime(t) }));
      leadOffset = leadWs.length;
      candleSeries.setData([...leadWs, ...candleData, ...trailWs]);
    } else {
      candleSeries.setData(candleData);
    }
    leadOffsetRef.current = leadOffset;

    // Volume histogram (overlay, pinned to bottom)
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    mainChart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Volume opacity scales with delivery % (Phase 2.4) — darker bar = more
    // of the day's volume was taken home, not day-traded. Rows without
    // delivery data (indices, W/M without the column) keep the flat alpha.
    const alphaHex = (a: number) => Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');
    const volData: HistogramData<Time>[] = data.map((d) => {
      const base = d.close >= d.open ? C.riskGreen : C.riskRed;
      const dp = (d as unknown as Record<string, unknown>).delivery_pct as number | null | undefined;
      const alpha = dp != null ? 0.16 + Math.min(0.55, (Number(dp) / 100) * 0.6) : 0.3;
      return { time: toTime(d.trade_date), value: d.volume || 0, color: base + alphaHex(alpha) };
    });
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

    // Big Money days (Phase 3): gold dashed line at each zone low
    for (const ev of bigMoneyEvents) {
      candleSeries.createPriceLine({
        price: ev.price,
        color: ev.color ?? '#d4a84b',
        lineWidth: 1 as LineWidth,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: ev.label,
      });
    }

    // Markers: Dot signals + Swing High/Low
    const markers: SeriesMarker<Time>[] = [];
    const bmColorByDate = new Map(bigMoneyEvents.map((e) => [e.trade_date, e.color ?? '#d4a84b']));
    for (const d of data) {
      // Signal dots — color IS the vocabulary (owner 2026-07-07: no text
      // labels): SVD violet, SBD blue, SYD yellow. Swing pivots stay as
      // bare arrows (red down = swing high, green up = swing low).
      if (d.dot_svd) markers.push({ time: toTime(d.trade_date), position: 'belowBar', color: '#8b5cf6', shape: 'circle' });
      if (d.dot_sbd) markers.push({ time: toTime(d.trade_date), position: 'belowBar', color: '#3b82f6', shape: 'circle' });
      if (d.dot_syd) markers.push({ time: toTime(d.trade_date), position: 'aboveBar', color: '#eab308', shape: 'circle' });
      if (d.swing_high) markers.push({ time: toTime(d.trade_date), position: 'aboveBar', color: C.riskRed, shape: 'arrowDown' });
      if (d.swing_low) markers.push({ time: toTime(d.trade_date), position: 'belowBar', color: C.riskGreen, shape: 'arrowUp' });
      if (bmColorByDate.has(d.trade_date)) markers.push({ time: toTime(d.trade_date), position: 'aboveBar', color: bmColorByDate.get(d.trade_date)!, shape: 'circle', text: '₹' });
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

      const refOpts = { color: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', lineWidth: 1 as LineWidth, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
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
        color: 'color-mix(in srgb, var(--text-primary) 15%, transparent)', lineWidth: 1 as LineWidth, lineStyle: LineStyle.Dashed,
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
        if (overlay.catalog_item_id === 'gann_sq9' && data.length > 0) {
          const lastClose = data[data.length - 1].close
          if (lastClose != null && lastClose > 0) {
            const showOrdinal = !!(overlay.config?.show_ordinal)
            const ANGLES = [45, 90, 135, 180, 225, 270, 315, 360]
            const CARDINALS = new Set([90, 180, 270, 360])
            const baseColor = overlay.color ?? '#F5A623'
            const sqrt = Math.sqrt(lastClose)
            for (const angle of ANGLES) {
              const isCardinal = CARDINALS.has(angle)
              if (!isCardinal && !showOrdinal) continue
              const factor = (angle / 360) * 2
              const resistance = Math.round(Math.pow(sqrt + factor, 2) * 100) / 100
              const support    = Math.round(Math.pow(sqrt - factor, 2) * 100) / 100
              const lStyle  = isCardinal ? LineStyle.Solid : LineStyle.LargeDashed
              const lColor  = isCardinal ? baseColor : hexToRgba(baseColor, 0.45)
              const lWidth  = (isCardinal ? 1.5 : 1) as LineWidth
              const times   = data.map(d => ({ time: toTime(d.trade_date) }))
              const rSeries = mainChart.addSeries(LineSeries, {
                color: lColor, lineWidth: lWidth, lineStyle: lStyle,
                priceLineVisible: false, lastValueVisible: isCardinal,
                crosshairMarkerVisible: false,
                title: isCardinal ? `S9·${angle}R` : '',
              })
              rSeries.setData(times.map(({ time }) => ({ time, value: resistance })))
              if (support > 0) {
                const sSeries = mainChart.addSeries(LineSeries, {
                  color: lColor, lineWidth: lWidth, lineStyle: lStyle,
                  priceLineVisible: false, lastValueVisible: isCardinal,
                  crosshairMarkerVisible: false,
                  title: isCardinal ? `S9·${angle}S` : '',
                })
                sSeries.setData(times.map(({ time }) => ({ time, value: support })))
              }
            }
          }
        }
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
        // range is logical over the (whitespace-padded) time scale — shift back
        // into `data` index space and clamp to the real bars.
        const clamp = (i: number) => Math.max(0, Math.min(data.length - 1, i));
        const from = data[clamp(Math.round(range.from) - leadOffset)]?.trade_date;
        const to   = data[clamp(Math.round(range.to) - leadOffset)]?.trade_date;
        if (from && to) onVisibleRangeChange(from, to);
      });
    }

    mainChart.subscribeCrosshairMove((param) => {
      if (!param.time) { setHoverBar(null); return; }
      const date = param.time as string;
      const idx  = data.findIndex(d => d.trade_date === date);
      if (idx >= 0) {
        setHoverBar(data[idx] as unknown as Record<string, unknown>);
        if (onCrosshairMove) onCrosshairMove(idx, date);
      } else {
        setHoverBar(null);
      }
    });

    // When padding is on (astro zones present), pin the view to the full padded
    // window so future/pre-data overlay zones are visible. Otherwise fit the
    // candles to the width — a relaxed default that fills the pane and aligns
    // the right edge with the scrubber's NOW.
    if (padAxis && padFrom && padTo) {
      mainChart.timeScale().setVisibleRange({ from: padFrom as Time, to: padTo as Time });
    } else {
      mainChart.timeScale().fitContent();
    }

    // Store ref so the bands canvas effect can reach the time scale
    mainChartRef.current = mainChart;
    // Trigger band redraw whenever the chart scrolls/zooms
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      drawBandsRef.current?.();
    });
    // Redraw bands immediately after chart rebuild (covers indicator overlay changes)
    requestAnimationFrame(() => { drawBandsRef.current?.(); });
  }, [data, height, compact, workspaceMode, indicatorOverlays, bigMoneyEvents, onVisibleRangeChange, onCrosshairMove]);

  // Scroll to highlighted date when slider moves
  useEffect(() => {
    if (!highlightDate || chartsRef.current.length === 0 || data.length === 0) return;
    const idx = data.findIndex((d) => d.trade_date === highlightDate);
    if (idx < 0) return;

    // Center the highlighted bar in view with some padding. idx is a `data`
    // index — shift into the padded logical space via the lead offset.
    const offset = leadOffsetRef.current;
    const barsToShow = 60;
    const from = Math.max(0, idx - barsToShow / 2);
    const to = Math.min(data.length - 1, from + barsToShow);
    chartsRef.current.forEach((chart) => {
      chart.timeScale().setVisibleLogicalRange({ from: from + offset, to: to + offset });
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
    // Container-driven resizes too (fullscreen toggle, rail collapse, grid
    // reflow) — window resize alone left the chart at its stale width.
    const ro = new ResizeObserver(() => handleResize());
    if (mainRef.current) ro.observe(mainRef.current);
    return () => {
      ro.disconnect();
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

      // Non-Panchak bands are merged per group tag so that 11 Mercury rules
      // render as ONE visual layer instead of 11 stacking semi-transparent rects.
      // Panchak keeps its tiered rendering (base / yoga / vara stacking is intentional).
      //
      // Merge algorithm:
      //   1. Separate Panchak bands (draw as-is) from group bands
      //   2. For each group, collect all date ranges and sort by start
      //   3. Walk through and union overlapping ranges → one rect per merged period
      //   4. Merged rect uses the group's shared color and opacity (taken from first band)
      interface MergedBand {
        from: string; to: string
        color: string; opacity: number
        matched: boolean | null
        groupTag: string
      }

      // Single-day events render as marker lines (handled separately below), never zones.
      const pointBands   = astroBands.filter(b => b.isPoint)
      const panchakBands = astroBands.filter(b => b.isPanchak && !b.isPoint)
      const nonPanchak   = astroBands.filter(b => !b.isPanchak && !b.isPoint)

      // Group by groupTag
      const byGroup = new Map<string, typeof nonPanchak>()
      for (const b of nonPanchak) {
        const arr = byGroup.get(b.groupTag) ?? []
        arr.push(b)
        byGroup.set(b.groupTag, arr)
      }

      // Union date ranges per group
      const mergedBands: MergedBand[] = []
      for (const [groupTag, gbands] of byGroup) {
        const sorted = [...gbands].sort((a, b) => a.from < b.from ? -1 : 1)
        // Take color/opacity from the first band in the group (all share group color)
        const refColor   = sorted[0].color
        const refOpacity = sorted[0].opacity
        let curFrom = sorted[0].from
        let curTo   = sorted[0].to
        // Track whether any band in the current merged window is matched/null
        let curMatched: boolean | null = sorted[0].matched

        for (let i = 1; i < sorted.length; i++) {
          const b = sorted[i]
          if (b.from <= curTo) {
            // Overlaps — extend the window
            if (b.to > curTo) curTo = b.to
            // If any constituent is matched=true, the merged window is matched
            if (b.matched === true) curMatched = true
            else if (curMatched === null && b.matched === false) curMatched = false
          } else {
            mergedBands.push({ from: curFrom, to: curTo, color: refColor, opacity: refOpacity, matched: curMatched, groupTag })
            curFrom = b.from; curTo = b.to; curMatched = b.matched
          }
        }
        mergedBands.push({ from: curFrom, to: curTo, color: refColor, opacity: refOpacity, matched: curMatched, groupTag })
      }

      // Draw Panchak (tiered) first, then merged group bands on top
      const allDrawBands = [...panchakBands.map(b => ({ ...b, _merged: false })),
                           ...mergedBands.map(b => ({ ...b, _merged: true, isPanchak: false, panchakTier: undefined }))]

      for (const band of allDrawBands) {
        const x1 = ts.timeToCoordinate(band.from as Time);
        const x2 = ts.timeToCoordinate(band.to   as Time);
        if (x1 == null || x2 == null) continue;

        const left = Math.min(x1, x2);
        const bw   = Math.max(Math.abs(x2 - x1), 2);

        if (band.isPanchak) {
          // ── Panchak tiered rendering — no borders, no strokes ──────────────
          // band.color = user-picked hex (or tier default)
          // band.opacity = user-picked opacity (or tier default)
          const tier    = band.panchakTier ?? 'base'
          const bias    = ('baseBias' in band ? band.baseBias : null) ?? ''
          // Zone opacities are calibrated for dark backgrounds; the same alpha
          // over white reads ~2x stronger, so scale down in light mode.
          const zoneModeScale = document.documentElement.dataset.mode === 'light' ? 0.55 : 1
          const userOpacity = band.opacity * zoneModeScale

          let fillColor: string
          let labelChar: string
          let labelOpacity: number
          let labelSize: number

          if (tier === 'yoga') {
            // Tier 2 — yoga override: user color at user opacity, ✦ glyph
            fillColor    = hexToRgba(band.color, userOpacity)
            labelChar    = '✦'
            labelOpacity = 0.7
            labelSize    = 10
          } else {
            // Tier 1 (base) and Tier 3 (vara): bias tints using user color as hue
            // If user picked a custom color, honour it; otherwise use bias hue
            const hasCustomColor = band.color !== '#6366f1'
            if (hasCustomColor) {
              fillColor = hexToRgba(band.color, userOpacity)
            } else if (bias === 'bearish') {
              fillColor = hexToRgba('#ef4444', userOpacity)
            } else if (bias === 'bullish') {
              fillColor = hexToRgba('#22c55e', userOpacity)
            } else {
              fillColor = hexToRgba(band.color, userOpacity)
            }
            labelChar    = tier === 'vara' ? ('ruleCode' in band ? band.ruleCode : '').split('-')[1]?.slice(0, 3) ?? 'P' : 'P'
            labelOpacity = 0.4
            labelSize    = 9
          }

          ctx.fillStyle = fillColor
          ctx.fillRect(left, 0, bw, h)

          // Label — only if zone is wide enough (> 10px ≈ ~3 candles)
          if (bw > 10) {
            ctx.fillStyle = `rgba(99,102,241,${labelOpacity})`
            ctx.font      = `${labelSize}px sans-serif`
            ctx.fillText(labelChar, left + 3, 14)
          }
        } else {
          // ── Non-Panchak: merged group band — single opacity, no stacking ───
          // band.opacity = group opacity (user-set or default 0.10)
          const isFuture = band.from > today
          // Same dark-calibration note as the Panchak path above: soften in light mode.
          const zoneModeScale = document.documentElement.dataset.mode === 'light' ? 0.55 : 1
          const op = ((band as { opacity?: number }).opacity ?? 0.10) * zoneModeScale
          let fillColor: string
          let borderColor: string
          let dashed = false

          if (band.matched === true) {
            fillColor   = hexToRgba(band.color, op)
            borderColor = hexToRgba(band.color, Math.min(op * 6, 0.75))
          } else if (band.matched === false) {
            // Dimmer than matched, but with a visibility floor — halving a low
            // user opacity made whole multi-month windows invisible (only the
            // left border line showed, reading as a point event; owner report
            // 2026-07-07: Venus combust 27-Nov→17-Feb rendered as one line).
            fillColor   = hexToRgba(band.color, Math.max(op * 0.5, 0.06))
            borderColor = hexToRgba(band.color, Math.min(op * 3, 0.40))
          } else {
            // null matched (most rules) — use group opacity directly
            fillColor   = hexToRgba(band.color, Math.max(op, 0.06))
            borderColor = hexToRgba(band.color, isFuture ? Math.min(op * 5, 0.50) : Math.min(op * 3, 0.30))
            dashed      = isFuture
          }

          ctx.fillStyle = fillColor
          ctx.fillRect(left, 0, bw, h)

          // Border on BOTH edges so a window reads as a bracketed time span —
          // a single left line was indistinguishable from a point marker.
          ctx.strokeStyle = borderColor
          ctx.lineWidth   = 1.5
          ctx.setLineDash(dashed ? [4, 3] : [])
          ctx.beginPath()
          ctx.moveTo(left + 1, 0)
          ctx.lineTo(left + 1, h)
          ctx.moveTo(left + bw - 1, 0)
          ctx.lineTo(left + bw - 1, h)
          ctx.stroke()
          ctx.setLineDash([])

          // Glyph at top-left of band — shows which planet/rule this zone is
          const glyph = BAND_GLYPHS[band.groupTag]
          if (glyph && bw > 8) {
            ctx.save()
            ctx.font      = '16px serif'
            ctx.fillStyle = 'color-mix(in srgb, var(--text-primary) 80%, transparent)'
            ctx.textAlign = 'left'
            ctx.fillText(glyph, left + 4, 28)
            ctx.restore()
          }
        }
      }

      // ── Point-event markers — single-day events as a thin vertical dashed line ──
      // (BAY-R06/R27, planet rise/station, single-day DN rules). Zones above are
      // untouched; these never merge and never fill.
      for (const pb of pointBands) {
        const x = ts.timeToCoordinate(pb.from as Time);
        if (x == null) continue;
        // Overlap Visibility Phase 1: point markers color by SOURCE PLANET
        // (Mercury blue, Mars red, Venus pink, Neptune sky…) so coincident
        // events from one group overlay stay distinguishable. Zones keep
        // group/user colors — this applies to point markers only.
        const pColor = planetColorOfRuleCode(pb.ruleCode) ?? pb.color;
        ctx.save();
        ctx.strokeStyle = hexToRgba(pColor, 0.4);
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle  = hexToRgba(pColor, 0.9);
        ctx.font       = '14px serif';
        ctx.textAlign  = 'center';
        ctx.fillText(pointMarkerLabel(pb.ruleCode), x, 26);
        ctx.restore();
      }

      // ── Future-event pins — band starts within the next 15 days ─────────
      // Animated pill: glyph + Nd countdown. Pulses via sine wave on opacity
      // and a gentle vertical bob so it catches the eye without being garish.
      //
      // Uses raw nonPanchak bands (pre-merge) rather than mergedBands because
      // merging can absorb a future start date into a larger band whose `from`
      // is already in the past — making the skip condition `from <= today` fire
      // incorrectly. One pill per group (nearest upcoming start) is shown.
      const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const animPhase = (Date.now() % 2400) / 2400        // 0→1 every 2.4 s
      const pulse     = 0.5 + 0.5 * Math.sin(animPhase * Math.PI * 2)  // 0→1→0
      const bob       = Math.round(pulse * 3)              // 0‒3 px vertical bob

      // Collect nearest future start per group from the raw (pre-merge) bands
      const nearestFuture = new Map<string, typeof nonPanchak[0]>()
      for (const b of nonPanchak) {
        if (b.from <= today || b.from > in15Days) continue
        const cur = nearestFuture.get(b.groupTag)
        if (!cur || b.from < cur.from) nearestFuture.set(b.groupTag, b)
      }

      for (const band of nearestFuture.values()) {
        const x = ts.timeToCoordinate(band.from as Time)
        if (x == null) continue
        const daysUntil = Math.round((new Date(band.from).getTime() - Date.now()) / 86400000)
        const glyph  = BAND_GLYPHS[band.groupTag] ?? '◉'
        const pillW  = 34, pillH = 17, pillR = 4
        const px     = x - pillW / 2
        const py     = 30 + bob                           // below filter icon, bobs gently
        const fillOp = 0.70 + 0.25 * pulse               // 0.70 → 0.95
        ctx.save()
        ctx.fillStyle = hexToRgba(band.color, fillOp)
        ctx.shadowColor = band.color
        ctx.shadowBlur  = 4 + pulse * 6                  // glow pulses 4→10
        ctx.beginPath()
        ctx.roundRect(px, py, pillW, pillH, pillR)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle  = '#fff'
        ctx.textAlign  = 'center'
        ctx.font       = '12px serif'
        ctx.fillText(glyph, x - 7, py + 13)
        ctx.font       = 'bold 8px sans-serif'
        ctx.fillText(`${daysUntil}d`, x + 9, py + 13)
        ctx.restore()
      }
    }

    drawBandsRef.current = draw;

    // Run a RAF animation loop if any future pins exist within 15 days,
    // otherwise a single draw is enough.
    const today0  = new Date().toISOString().slice(0, 10)
    const in15d   = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const hasFuturePins = astroBands.some(
      b => !b.isPoint && !b.isPanchak && b.from > today0 && b.from <= in15d,
    )

    let rafId: number | null = null
    if (hasFuturePins) {
      const loop = () => { draw(); rafId = requestAnimationFrame(loop) }
      rafId = requestAnimationFrame(loop)
    } else {
      draw()
    }

    const ro = new ResizeObserver(draw);
    if (mainRef.current) ro.observe(mainRef.current);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
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
          <span className="ml-auto text-[9px] text-muted">volume shade = delivery %</span>
        </div>
      )}

      <div
        style={{ position: 'relative' }}
        onContextMenu={e => {
          if (!onZoneClick || astroBands.length === 0 || !mainChartRef.current) return;
          const rect   = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const ts     = mainChartRef.current.timeScale();
          // Collect ALL bands at the click point (Phase 5) — points first so
          // the popover leads with what the cursor is aimed at.
          const found: AstroBand[] = [];
          for (const band of astroBands) {
            const x1 = ts.timeToCoordinate(band.from as Time);
            const x2 = ts.timeToCoordinate(band.to   as Time);
            if (x1 == null || x2 == null) continue;
            // Point markers are 1px lines — give them a small hit tolerance.
            const pad   = band.isPoint ? 4 : 0;
            const left  = Math.min(x1, x2) - pad;
            const right = Math.max(x1, x2) + pad;
            if (mouseX >= left && mouseX <= right) found.push(band);
          }
          // Only suppress the browser menu when the right-click lands on a zone.
          if (found.length > 0) {
            found.sort((a, b) => Number(b.isPoint) - Number(a.isPoint));
            e.preventDefault();
            onZoneClick(found[0], e.clientX, e.clientY, found);
          }
        }}
        onMouseMove={e => {
          if (astroBands.length === 0 || !mainChartRef.current) {
            if (bandTooltip) setBandTooltip(null);
            return;
          }
          const rect   = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const ts     = mainChartRef.current.timeScale();
          // Collect EVERY band under the cursor (Overlap Visibility Phase 2):
          // coincident events tooltip together. Point markers get the same
          // ±4px hit tolerance hover that right-click always had — a 1px
          // line was effectively un-hoverable before.
          const found: AstroBand[] = [];
          for (const band of astroBands) {
            const x1 = ts.timeToCoordinate(band.from as Time);
            const x2 = ts.timeToCoordinate(band.to   as Time);
            if (x1 == null || x2 == null) continue;
            const pad   = band.isPoint ? 4 : 0;
            const left  = Math.min(x1, x2) - pad;
            const right = Math.max(x1, x2) + pad;
            if (mouseX >= left && mouseX <= right) found.push(band);
          }
          if (found.length > 0) {
            // Points first (they're what the cursor is aimed at when both
            // a wide zone and a thin marker overlap), then narrower zones.
            found.sort((a, b) => Number(b.isPoint) - Number(a.isPoint));
            setBandTooltip({ x: mouseX, y: mouseY, bands: found });
          } else if (bandTooltip) {
            setBandTooltip(null);
          }
        }}
        onMouseLeave={() => { setBandTooltip(null); setHoverBar(null); }}
      >
        <div ref={mainRef} className="rounded-xl overflow-hidden" />

        {/* Story-mode on-candle bubble — anchored by X to the current event's
            candle, near the top of the pane with a downward caret. */}
        {storyBubble && bubbleX != null && (() => {
          const c = storyBubble.color;
          const dir = storyBubble.tone === 'bull' ? { g: '▲', col: 'var(--risk-green)' }
            : storyBubble.tone === 'bear' ? { g: '▼', col: 'var(--risk-red)' }
            : { g: '•', col: 'var(--verdict-hero-muted)' };
          return (
            <div style={{ position: 'absolute', top: 8, left: bubbleX, transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', width: 220 }}>
              <div style={{
                background: 'var(--verdict-hero-bg)', color: 'var(--verdict-hero-text)',
                border: `1px solid color-mix(in srgb, ${c} 55%, transparent)`,
                borderLeft: `3px solid ${c}`,
                borderRadius: 10, padding: '8px 11px', boxShadow: 'var(--card-shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ color: dir.col, fontSize: 11 }}>{dir.g}</span>
                  <span style={{ color: c }}>{storyBubble.title}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--verdict-hero-muted)', marginTop: 3, lineHeight: 1.4 }}>{storyBubble.detail}</div>
                {storyBubble.reactionPct != null && (
                  <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono, monospace)' }}>
                    <span style={{ color: 'var(--verdict-hero-muted)' }}>→ price </span>
                    <span style={{ color: storyBubble.reactionPct >= 0 ? 'var(--risk-green)' : 'var(--risk-red)', fontWeight: 700 }}>
                      {storyBubble.reactionPct >= 0 ? '+' : ''}{storyBubble.reactionPct.toFixed(1)}%
                    </span>
                    <span style={{ color: 'var(--verdict-hero-muted)' }}> over next 5 bars</span>
                  </div>
                )}
              </div>
              <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--verdict-hero-bg)' }} />
            </div>
          );
        })()}

        {/* VaNi story-teller mascot — glides candle→candle as the story advances,
            so it reads as VaNi walking the chart telling the tale. */}
        {storyBubble && bubbleX != null && (
          <div
            style={{
              position: 'absolute', left: bubbleX, top: '60%', marginLeft: -16, zIndex: 21,
              pointerEvents: 'none', transition: 'left 0.6s cubic-bezier(.4,0,.2,1)',
            }}
          >
            <div
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--vani) 20%, var(--verdict-hero-bg))',
                border: '1.5px solid var(--vani)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px color-mix(in srgb, var(--vani) 50%, transparent)',
                animation: 'vani-bob 2.2s ease-in-out infinite',
                fontSize: 16, color: 'var(--vani)',
              }}
            >
              ✦
            </div>
          </div>
        )}

        {hoverBar != null && (() => {
          const n = (v: unknown, dec = 2) =>
            typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: dec }) : '—';
          const pctChng = hoverBar.pct_chng as number | null | undefined;
          const dp = hoverBar.delivery_pct as number | null | undefined;
          return (
            <div style={{
              position: 'absolute', top: 8, left: 8, zIndex: 15, pointerEvents: 'none',
              // Theme-aware panel: was a hardcoded near-black bg, which made the
              // theme-var text invisible in light mode (dark text on dark box).
              // color-mix over --bg adapts — dark panel in dark mode, light in
              // light — so the OHLC readout is legible in both.
              background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 6px color-mix(in srgb, black 14%, transparent)',
              backdropFilter: 'blur(3px)',
              borderRadius: 6, padding: '4px 10px',
              fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
              display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap',
              color: 'var(--text-secondary, #cbd5e1)', maxWidth: '85%',
            }}>
              <span style={{ color: 'var(--text-muted, #64748b)' }}>{String(hoverBar.trade_date ?? '')}</span>
              <span>O {n(hoverBar.open)}</span>
              <span>H {n(hoverBar.high)}</span>
              <span>L {n(hoverBar.low)}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>C {n(hoverBar.close)}</span>
              {pctChng != null && (
                <span style={{ color: pctChng >= 0 ? 'var(--risk-green, #22c55e)' : 'var(--risk-red, #ef4444)' }}>
                  {pctChng >= 0 ? '+' : ''}{Number(pctChng).toFixed(2)}%
                </span>
              )}
              <span>Vol {n(hoverBar.volume, 0)}</span>
              {dp != null && <span>Del {Number(dp).toFixed(0)}%</span>}
            </div>
          );
        })()}
        <canvas
          ref={bandCanvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            pointerEvents: 'none', zIndex: 2,
            borderRadius: 12,
          }}
        />
        {bandTooltip && bandTooltip.bands.length > 0 && (() => {
          const MAX_SHOWN = 4;
          const shown  = bandTooltip.bands.slice(0, MAX_SHOWN);
          const extra  = bandTooltip.bands.length - shown.length;
          const first  = shown[0];
          const accent = (b: AstroBand) =>
            (b.isPoint && planetColorOfRuleCode(b.ruleCode)) || b.color;
          const today  = new Date().toISOString().slice(0, 10);
          return (
            <div style={{
              position: 'absolute',
              left: bandTooltip.x + 14,
              top:  Math.max(8, bandTooltip.y - 60),
              zIndex: 20,
              background: 'rgba(13,17,23,0.95)',
              border: `1px solid ${accent(first)}55`,
              borderLeft: `3px solid ${accent(first)}`,
              borderRadius: 6,
              padding: '7px 11px',
              pointerEvents: 'none',
              minWidth: 180,
              maxWidth: 280,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {shown.map((b, i) => {
                const c    = accent(b);
                // Phase 3: prefer the viewed index's own confidence row;
                // NIFTY 50 aggregate is the fallback — label follows the data.
                const niftyConf = confByRule.get(b.ruleId);
                const benchConf = benchmarkIndexId != null ? benchConfByRule.get(b.ruleId) : undefined;
                const useBench  = benchConf != null && (benchConf.total_occurrences ?? 0) > 0;
                const conf      = useBench ? benchConf : niftyConf;
                const benchLabel = useBench ? (benchmarkName ?? 'this index') : 'NIFTY 50';
                return (
                  <div key={`${b.ruleCode}-${b.from}-${i}`} style={i > 0 ? {
                    marginTop: 7, paddingTop: 7, borderTop: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
                  } : undefined}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c, marginBottom: 3, lineHeight: 1.3 }}>
                      {b.displayName}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)', marginBottom: 4 }}>
                      {b.ruleCode}
                    </div>
                    <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--text-primary) 60%, transparent)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      {b.isPoint ? (
                        <span>{fmtDate(b.from)}</span>
                      ) : (
                        <>
                          <span>{fmtDate(b.from)}</span>
                          <span style={{ opacity: 0.35 }}>→</span>
                          <span>{fmtDate(b.to)}</span>
                        </>
                      )}
                    </div>
                    {/* Two explicitly-scoped lines (owner 2026-07-07: "a user
                        needs to understand it much better"): THIS WINDOW = the
                        one occurrence under the cursor; RULE OVERALL = the
                        rule's whole track record. Batsman's average vs
                        today's innings — both true, different scopes. */}
                    <div style={{ marginTop: 5, fontSize: 10, display: 'flex', gap: 5, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)', fontFamily: 'var(--font-mono, monospace)' }}>
                        THIS WINDOW
                      </span>
                      {/* Honesty pass (owner 2026-07-07): matched is scored against
                          NIFTY 50 regardless of the instrument this chart shows —
                          say so instead of implying it belongs to this chart. */}
                      {b.matched === true  && <span style={{ color: c }}>✓ NIFTY 50 moved as expected</span>}
                      {b.matched === false && <span style={{ color: 'var(--bear)' }}>✗ NIFTY 50 moved against expectation</span>}
                      {b.matched === null  && (
                        <span style={{ color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)' }}>
                          {b.from > today
                            ? '◦ upcoming — not scored yet'
                            : b.baseBias
                              ? '◦ not scored yet'
                              : '◦ observational — no directional claim'}
                        </span>
                      )}
                    </div>
                    {/* Phase 2: the viewed instrument's own move over this
                        window — the fact this chart can actually attest to. */}
                    {(() => {
                      const r = chartWindowReturn(b.from, b.to);
                      if (r == null) return null;
                      return (
                        <div style={{ marginTop: 3, fontSize: 10, display: 'flex', gap: 5, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)', fontFamily: 'var(--font-mono, monospace)' }}>
                            THIS CHART
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', color: r.pct >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                            {r.pct >= 0 ? '+' : ''}{r.pct.toFixed(1)}% over this window{r.ongoing ? ' so far' : ''}
                          </span>
                        </div>
                      );
                    })()}
                    {/* Aggregate confidence — how the RULE behaves, not just this window.
                        POA item 3: the % is only meaningful against a stated
                        hypothesis, so the tested claim is named inline
                        ('vs inference (…)' or 'vs base bias (…)'). */}
                    {conf?.confidence_score != null && (conf.total_occurrences ?? 0) > 0 && (
                      <div style={{ marginTop: 3, fontSize: 10, display: 'flex', gap: 5, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)', fontFamily: 'var(--font-mono, monospace)' }}>
                          RULE OVERALL
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'color-mix(in srgb, var(--text-primary) 60%, transparent)' }}>
                          {benchLabel} moved as expected in {conf.confidence_score.toFixed(0)}% of {conf.total_occurrences} windows
                          {conf.avg_return_matched != null && (
                            <> · avg {conf.avg_return_matched >= 0 ? '+' : ''}{conf.avg_return_matched.toFixed(1)}% when it did</>
                          )}
                          {conf.hypothesis_source && conf.hypothesis_impact && (
                            <span style={{ color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)' }}>
                              {' '}· vs {conf.hypothesis_source === 'inference' ? 'inference' : 'base bias'} ({conf.hypothesis_impact.replace(/_/g, ' ')})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {/* Non-directional inference (volatile/turning/…): no
                        win-rate exists by design — say so instead of silence. */}
                    {conf != null && conf.hypothesis_source === 'inference'
                      && (conf.confidence_score == null || (conf.total_occurrences ?? 0) === 0) && (
                      <div style={{ marginTop: 3, fontSize: 10, display: 'flex', gap: 5, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)', fontFamily: 'var(--font-mono, monospace)' }}>
                          RULE OVERALL
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)' }}>
                          inference{conf.hypothesis_impact ? ` (${conf.hypothesis_impact.replace(/_/g, ' ')})` : ''} makes no directional claim — see Patterns for how it plays out
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {extra > 0 && (
                <div style={{ marginTop: 6, fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)' }}>
                  +{extra} more event{extra > 1 ? 's' : ''} here
                </div>
              )}
            </div>
          );
        })()}
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
