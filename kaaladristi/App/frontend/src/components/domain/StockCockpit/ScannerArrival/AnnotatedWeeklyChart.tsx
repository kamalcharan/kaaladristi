/**
 * AnnotatedWeeklyChart — the story-page chart component (Phase 2).
 *
 * Renders weekly candles + EMA 50 line + horizontal key-level lines +
 * per-persona entry-price markers, driven entirely by SetupData from
 * the adapter. Pure component: takes props, no fetching, no store, no
 * side effects beyond chart lifecycle.
 *
 * What's here (Phase 2):
 *   · Candlestick series over the weekly bars
 *   · 50-EMA overlay line (rolling SMA over close, computed inline)
 *   · Horizontal key-level lines via createPriceLine — labeled, tone-colored
 *   · Entry-zone bounds as thin dashed lines (top + bottom of each band)
 *   · Numbered markers on the last bar for LT E1/E2/E3 and Swing E1/E2/E3
 *
 * What's deferred (Phase 2.5):
 *   · Cycle-label vertical bands (Old Stage 2 / Long Stage 1 / etc.) —
 *     need an HTML overlay layer synced to timeScale coordinates; hooking
 *     that in mid-Phase-2 balloons the component. `cycleLabels` from the
 *     adapter are ignored here and will be picked up in a follow-up.
 *
 * See: docs/claude/scanner-story-page-poa.md · Phase 2.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
  type IPriceLine,
} from 'lightweight-charts';
import type {
  WeeklyBar,
  ChartAnnotations,
  HorizontalLine,
  EntryZoneAnnotation,
} from '@/services/thesis/setupAdapter';

// ── Colors — resolved from CSS vars at chart-create time so the chart
//    follows the active theme (dark today, light later). Falls back to
//    the current theme's dark values if a var is unset.

const CHART_VARS = {
  bull:    { css: '--risk-green',   fallback: '#22c55e' },
  bear:    { css: '--risk-red',     fallback: '#ef4444' },
  neutral: { css: '--text-faint',   fallback: '#94a3b8' },
  ema:     { css: '--gold-soft',    fallback: '#c9a84c' },
  lt:      { css: '--accent-indigo', fallback: '#6366f1' },
  swing:   { css: '--risk-amber',   fallback: '#f59e0b' },
  gridLine: { css: '--kd-border',   fallback: 'rgba(148,163,184,0.12)' },
  text:     { css: '--text-secondary', fallback: 'rgba(148,163,184,0.9)' },
} as const;

type ColorKey = keyof typeof CHART_VARS;

function resolveColors(): Record<ColorKey, string> {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const style = root ? getComputedStyle(root) : null;
  const out = {} as Record<ColorKey, string>;
  for (const [key, def] of Object.entries(CHART_VARS) as Array<[ColorKey, typeof CHART_VARS[ColorKey]]>) {
    const v = style?.getPropertyValue(def.css).trim();
    out[key] = v && v.length > 0 ? v : def.fallback;
  }
  return out;
}

interface Props {
  bars: WeeklyBar[];
  annotations: ChartAnnotations;
  /** Per-persona entry prices to mark on the last bar. Pass the same
   *  PersonaEntries the adapter returned. */
  personas: {
    ltInvestor: Array<{ entryNo: number; price: number | null; label: string }>;
    swingTrader: Array<{ entryNo: number; price: number | null; label: string }>;
  };
  height?: number;
}

export default function AnnotatedWeeklyChart({ bars, annotations, personas, height = 420 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Weekly 50 EMA (rolling SMA over closes — matches the adapter's key-level definition).
  const emaSeries = useMemo(() => rollingSma(bars.map((b) => b.close), 50), [bars]);

  useEffect(() => {
    if (!wrapRef.current || bars.length === 0) return;
    const wrap = wrapRef.current;
    const C = resolveColors();

    const chart = createChart(wrap, {
      width: wrap.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor:  C.text,
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize:   11,
      },
      grid: {
        vertLines: { color: C.gridLine },
        horzLines: { color: C.gridLine },
      },
      timeScale: {
        borderColor: C.gridLine,
        timeVisible: false,
        rightOffset: 6,
      },
      rightPriceScale: {
        borderColor: C.gridLine,
      },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chartRef.current = chart;

    // ── Candlestick series ──
    const candles = chart.addSeries(CandlestickSeries, {
      upColor:     C.bull,
      downColor:   C.bear,
      borderUpColor:   C.bull,
      borderDownColor: C.bear,
      wickUpColor:     C.bull,
      wickDownColor:   C.bear,
    });
    const candleData: CandlestickData<Time>[] = bars.map((b) => ({
      time: b.trade_date as Time,
      open: b.open,
      high: b.high,
      low:  b.low,
      close: b.close,
    }));
    candles.setData(candleData);

    // ── 50-EMA line ──
    const ema = chart.addSeries(LineSeries, {
      color: C.ema,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const emaData: LineData<Time>[] = [];
    for (let i = 0; i < bars.length; i++) {
      const v = emaSeries[i];
      if (v == null) continue;
      emaData.push({ time: bars[i].trade_date as Time, value: v });
    }
    ema.setData(emaData);

    // ── Horizontal key-level lines (adapter's chartAnnotations.horizontalLines) ──
    const toneColor: Record<'bull' | 'bear' | 'neutral', string> = {
      bull: C.bull, bear: C.bear, neutral: C.neutral,
    };
    const personaColor: Record<'lt' | 'swing', string> = { lt: C.lt, swing: C.swing };

    const priceLines: IPriceLine[] = [];
    for (const line of annotations.horizontalLines) {
      const pl = candles.createPriceLine({
        price: line.price,
        color: toneColor[line.tone],
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: line.label,
      });
      priceLines.push(pl);
    }

    // ── Entry-zone bounds — top + bottom of each zone as dashed lines ──
    for (const z of annotations.entryZones) {
      const c = personaColor[z.persona];
      const top = candles.createPriceLine({
        price: z.priceHigh, color: c, lineWidth: 1, lineStyle: LineStyle.Dotted,
        axisLabelVisible: false, title: '',
      });
      const bot = candles.createPriceLine({
        price: z.priceLow, color: c, lineWidth: 1, lineStyle: LineStyle.Dotted,
        axisLabelVisible: false, title: z.label,
      });
      priceLines.push(top, bot);
    }

    // ── Numbered entry markers on the LAST bar ──
    // Six markers total (LT 1/2/3 + Swing 1/2/3). Marker text is the
    // entry number; color is per-persona; shape distinguishes them from
    // native chart glyphs.
    const lastTime = candleData[candleData.length - 1].time;
    const markers: SeriesMarker<Time>[] = [];
    const pushMarker = (entryNo: number, persona: 'lt' | 'swing') => {
      markers.push({
        time: lastTime,
        position: persona === 'lt' ? 'aboveBar' : 'belowBar',
        color: personaColor[persona],
        shape: 'circle',
        text: `${persona === 'lt' ? 'LT' : 'SW'}${entryNo}`,
      });
    };
    personas.ltInvestor.forEach((e) => {
      if (e.price != null && Number.isFinite(e.price)) pushMarker(e.entryNo, 'lt');
    });
    personas.swingTrader.forEach((e) => {
      if (e.price != null && Number.isFinite(e.price)) pushMarker(e.entryNo, 'swing');
    });
    if (markers.length > 0) {
      // v5 API — see TradingChart.tsx pattern.
      createSeriesMarkers(candles, markers);
    }

    // ── Fit content ──
    chart.timeScale().fitContent();

    // ── Resize observer for responsive width ──
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrap.clientWidth });
    });
    ro.observe(wrap);

    // ── Cleanup ──
    return () => {
      ro.disconnect();
      for (const pl of priceLines) {
        try { candles.removePriceLine(pl); } catch { /* ignore */ }
      }
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, annotations, personas, emaSeries, height]);

  if (bars.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-kd-border bg-kd-elevated/20 text-xs text-muted"
        style={{ height }}
      >
        No weekly bars available for this equity.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-kd-border overflow-hidden bg-kd-elevated/10">
      <div ref={wrapRef} className="w-full" style={{ height }} />
      <ChartLegend annotations={annotations} />
    </div>
  );
}

// ── Legend strip beneath the chart (compact key of what's drawn) ────────

function ChartLegend({ annotations }: { annotations: ChartAnnotations }) {
  const ltZones    = annotations.entryZones.filter((z) => z.persona === 'lt').length;
  const swingZones = annotations.entryZones.filter((z) => z.persona === 'swing').length;
  const supportLines    = annotations.horizontalLines.filter((l) => l.tone === 'bull').length;
  const resistanceLines = annotations.horizontalLines.filter((l) => l.tone === 'bear').length;
  return (
    <div className="flex items-center gap-4 px-3 py-1.5 border-t border-kd-border bg-kd-elevated/20 text-[10px] text-muted flex-wrap">
      <LegendItem cssVar="--gold-soft"     kind="line"   label="50 EMA (weekly)" />
      <LegendItem cssVar="--risk-red"      kind="line"   label={`${resistanceLines} resistance level(s)`} />
      <LegendItem cssVar="--risk-green"    kind="line"   label={`${supportLines} support level(s)`} />
      {ltZones > 0    && <LegendItem cssVar="--accent-indigo" kind="dashed" label={`${ltZones} LT entry zone(s)`} />}
      {swingZones > 0 && <LegendItem cssVar="--risk-amber"    kind="dashed" label={`${swingZones} Swing entry zone(s)`} />}
    </div>
  );
}

function LegendItem({ cssVar, kind, label }: { cssVar: string; kind: 'line' | 'dashed'; label: string }) {
  const color = `var(${cssVar})`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-[2px] w-3"
        style={{
          background: kind === 'line' ? color : 'transparent',
          borderTop: kind === 'dashed' ? `2px dashed ${color}` : undefined,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

// ── Rolling SMA (used inline for the 50-EMA proxy — matches the adapter) ──
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
