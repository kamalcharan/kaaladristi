import type { MarketBreadthDay, BreadthRocDay } from '@/types';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { MONTH_FULL } from '@/lib/dateUtils';
import { momentumLabel } from '@/lib/structureStates';
import { participationColor, participationBand, rocColor, coverageWarnings,
  rocTransition, participationChange, countContext, pressureReading, breadthZoneEntry,
  type ParticipationHorizon, type PressureKind, type HeatmapTransition } from '@/lib/heatmapReading';
import '@/styles/structureHeatmap.css';

const sessionDate = (iso: string) => {
  const [, month, day] = iso.split('-');
  return `${Number(day)} ${MONTH_FULL[Number(month) - 1]} ${iso.slice(0, 4)}`;
};
type Row = { label: string; values: (number | null)[]; digits: number; suffix: string;
  fill: (value: number | null, i: number) => string; detail: (i: number) => string; transition: (i: number) => HeatmapTransition | null;
  display?: (i: number) => string; kind?: 'reading' | 'event'; windowWarning?: (i: number) => string | undefined };

export default function MarketStructureHistory({ breadth, roc, mode, onSelectDate, maBasis = 'market',
  focusedDate, onDateFocus, onInspectDate, coverageContext, rocCoverageContext,
}: {
  maBasis?: 'market' | 'index'; breadth: MarketBreadthDay[]; roc: BreadthRocDay[]; mode: 'breadth' | 'roc';
  onSelectDate: (date: string) => void; focusedDate?: string | null;
  onDateFocus?: (date: string | null) => void; onInspectDate?: (date: string | null) => void;
  animateLatest?: boolean; coverageContext?: MarketBreadthDay[]; rocCoverageContext?: BreadthRocDay[];
}) {
  const detailId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<{ date: string; row: string } | null>(null);
  const [localDate, setLocalDate] = useState<string | null>(null);
  const [scrollable, setScrollable] = useState({ newer: false, older: false });
  const updateScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element || !element.clientWidth) return;
    const newer = element.scrollLeft > 1;
    const older = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setScrollable(previous => previous.newer === newer && previous.older === older ? previous : { newer, older });
  }, []);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateScroll]);
  const dates = (mode === 'breadth' ? breadth : roc).map(r => r.trade_date);
  useEffect(updateScroll, [dates.length, updateScroll]);
  const scrollSessions = (direction: number) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.75,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const fullBreadth = coverageContext ?? breadth;
  const fullRoc = rocCoverageContext ?? roc;
  const historyDates = (mode === 'breadth' ? fullBreadth : fullRoc).map(r => r.trade_date);
  const warnings = coverageWarnings(mode === 'breadth' ? fullBreadth : fullRoc);
  if (mode === 'roc') coverageWarnings(coverageContext ?? breadth).forEach((message, date) => {
    if (!warnings.has(date)) warnings.set(date, message);
  });
  const blocked = (i: number, lookback = 1) => {
    const fullIndex = historyDates.indexOf(dates[i]);
    return historyDates.slice(Math.max(0, fullIndex - lookback), fullIndex + 1).some(d => warnings.has(d));
  };
  const previousBreadth = (i: number) => fullBreadth[fullBreadth.findIndex(r => r.trade_date === dates[i]) - 1];
  const zoneEvent = (i: number) => breadthZoneEntry(breadth[i]?.breadth_score, previousBreadth(i)?.breadth_score, blocked(i));
  const rows: Row[] = mode === 'breadth'
    ? [{ label: 'Score zone entry', values: breadth.map(r => r.breadth_score), digits: 1, suffix: '', kind: 'event' as const,
      fill: (_value: number | null, i: number) => zoneEvent(i)?.direction === 'down' ? 'var(--risk-red)' : zoneEvent(i)?.direction === 'up' ? 'var(--risk-green)' : 'transparent',
      display: i => zoneEvent(i) ? '●' : '',
      detail: i => zoneEvent(i)?.description ?? `Breadth score ${breadth[i]?.breadth_score?.toFixed(1) ?? 'unavailable'}; no new Fear or Greed entry on this session.`,
      transition: zoneEvent,
    }, ...(['pct_above_20', 'pct_above_50', 'pct_above_150'] as const).map((key, leg) => {
      const horizon = [20, 50, 150][leg] as ParticipationHorizon;
      return {
      label: `Above ${[20, 50, 150][leg]} ${maBasis === 'index' && leg > 0 ? 'SMA' : 'EMA'}`,
      values: breadth.map(r => r[key]), digits: 1, suffix: '%', fill: (value: number | null) => participationColor(value, horizon),
      detail: (i: number) => `${participationBand(breadth[i][key], horizon)}. ${participationChange(breadth[i][key], previousBreadth(i)?.[key])}. ${countContext(breadth[i], (['above_20', 'above_50', 'above_150'] as const)[leg])}`,
      transition: () => null,
    }; })]
    : (['roc_13', 'roc_55', 'sma_breadth'] as const).map((key, leg) => ({
      label: ['ROC 13', 'ROC 55', 'Signal (5)'][leg], values: roc.map(r => r[key]), digits: 4, suffix: '', fill: rocColor,
      detail: i => `${key === 'roc_13' ? momentumLabel(roc[i].roc_13, roc[i].sma_breadth) + '. ' : ''}Color shows signed magnitude, not the direction of its latest change.`,
      transition: i => leg === 0 ? rocTransition(fullRoc, fullRoc.findIndex(r => r.trade_date === dates[i]), blocked(i, 2)) : null,
    }));
  if (mode === 'breadth') {
    ([{ label: 'Daily pressure', up: 'up_5pct', down: 'down_5pct', kind: 'daily', lookback: 1 },
      { label: 'Five-day extremes', up: 'up_20pct_5d', down: 'down_20pct_5d', kind: 'fiveDay', lookback: 5 }] as const).forEach(config => {
      if (!breadth.some(r => r[config.up] != null && r[config.down] != null && (r.universe_count ?? 0) > 0)) return;
      const readings = breadth.map((row, i) => {
        const fullIndex = fullBreadth.findIndex(r => r.trade_date === row.trade_date);
        const prior = fullBreadth.slice(Math.max(0, fullIndex - 22), fullIndex).map(priorRow => {
          const n = priorRow.universe_count;
          return n && priorRow[config.up] != null && priorRow[config.down] != null ? Math.abs((priorRow[config.up]! - priorRow[config.down]!) / n * 100) : NaN;
        });
        return pressureReading(row[config.up], row[config.down], row.universe_count, prior, config.kind as PressureKind);
      });
      rows.push({ label: config.label,
        values: readings.map(r => r.net), digits: 1, suffix: '%', fill: (_v, i) => readings[i].color,
        display: i => breadth[i][config.up] == null || breadth[i][config.down] == null ? '—' : `U${breadth[i][config.up]} · D${breadth[i][config.down]}`,
        detail: i => readings[i].description,
        transition: () => null,
        windowWarning: i => blocked(i, config.lookback) ? 'Return window includes reduced or missing coverage. The pressure reading may include stale prices.' : undefined });
    });
  }
  const selectedDate = focusedDate === undefined ? localDate : focusedDate;
  const inspectDate = selectedDate ?? activeCell?.date;
  const inspectedIndex = dates.indexOf(inspectDate ?? '');
  const inspectedRow = rows.find(row => row.label === activeCell?.row) ?? rows[0];
  const formatted = (row: Row, i: number) => {
    if (row.display) return row.display(i);
    const value = row.values[i];
    return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(row.digits)}${row.suffix}`;
  };
  const selectCell = (date: string, row: string, pin = false) => {
    setActiveCell({ date, row }); setLocalDate(date);
    if (pin) onInspectDate?.(date); else onDateFocus?.(date);
  };
  const displayOrder = dates.map((_, i) => i).reverse();
  return <section className="structure-heatmap glass-card rounded-xl p-4" aria-label={`${mode === 'breadth' ? 'Participation' : 'Momentum'} heatmap`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{mode === 'breadth' ? 'Participation' : 'Momentum'} heatmap</h3>
    </div>
    <p className="text-xs text-muted my-3">Latest on the left ← · {dates.length} sessions · Hover, focus or tap a cell to inspect. Charts keep latest on the right.</p>
    {Array.from(warnings.keys()).some(date => dates.includes(date)) && <p role="status" className="text-xs text-muted mb-3">⚠ Striped cells have missing or sharply reduced coverage. Treat their values cautiously.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 mb-2 text-[11px] text-muted">
      <span>Latest {dates.at(-1) ? sessionDate(dates.at(-1)!) : '—'}</span>
      {(scrollable.newer || scrollable.older) && <nav aria-label={`${mode} history navigation`} className="flex gap-2">
        <button type="button" disabled={!scrollable.newer} onClick={() => scrollSessions(-1)} className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40">← Newer sessions</button>
        <button type="button" disabled={!scrollable.older} onClick={() => scrollSessions(1)} className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40">Older sessions →</button>
      </nav>}
      <span>Oldest {dates[0] ? sessionDate(dates[0]) : '—'}</span>
    </div>
    <div ref={scrollRef} onScroll={updateScroll} className="market-structure-history-scroll overflow-x-auto" tabIndex={0} aria-label="Scrollable historical readings" onMouseLeave={() => onDateFocus?.(null)}>
      <table className="heatmap-values" style={{ minWidth: 144 + dates.length * 68, '--heatmap-session-count': dates.length } as CSSProperties}>
        <caption className="sr-only">{mode} historical values, latest session first</caption>
        <thead><tr><th className="heatmap-label text-xs">Measure</th>{displayOrder.map(i => <th key={dates[i]} className="text-[10px] font-normal">
          <button type="button" className="text-accent-indigo underline" onClick={() => selectCell(dates[i], rows[0].label, true)}>{dates[i].slice(8)} {MONTH_FULL[Number(dates[i].slice(5, 7)) - 1].slice(0, 3)}</button>
        </th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.label}><th scope="row" className="heatmap-label text-[11px] text-[var(--text-secondary)]">{row.label}</th>{displayOrder.map(i => {
          const value = row.values[i]; const missing = value == null || !Number.isFinite(value);
          const warning = warnings.get(dates[i]) ?? row.windowWarning?.(i); const transition = row.transition(i);
          const description = `${sessionDate(dates[i])} · ${row.label}: ${formatted(row, i)}. ${row.detail(i)} ${warning ?? transition?.description ?? ''}`;
          const fill = row.fill(value, i);
          return <td key={dates[i]} className="heatmap-slot"><button type="button" className="heatmap-cell"
            data-date={dates[i]} data-highlighted={selectedDate === dates[i]} data-warning={!!warning} data-missing={missing}
            aria-label={description} aria-describedby={detailId} title={description}
            onMouseEnter={() => selectCell(dates[i], row.label)} onFocus={() => selectCell(dates[i], row.label)}
            onBlur={() => onDateFocus?.(null)} onClick={() => selectCell(dates[i], row.label, true)}>
            <span className={`heatmap-fill ${row.kind === 'event' ? 'heatmap-event' : ''}`} style={{ background: row.kind === 'event' || warning ? undefined : fill, color: row.kind === 'event' ? fill : undefined }}>{formatted(row, i)}</span>
          </button></td>;
        })}</tr>)}</tbody>
      </table>
    </div>
    <div id={detailId} className="heatmap-inspection rounded-lg border border-[var(--border)] p-3 mt-3 text-xs">
      {inspectedIndex >= 0 && inspectedRow ? <>
        <p className="font-semibold">{sessionDate(dates[inspectedIndex])} · {inspectedRow.label}: {formatted(inspectedRow, inspectedIndex)}</p>
        <p className="text-muted mt-1">{inspectedRow.detail(inspectedIndex)}</p>
        <p className="text-muted mt-1">{warnings.get(dates[inspectedIndex]) ?? inspectedRow.windowWarning?.(inspectedIndex) ?? inspectedRow.transition(inspectedIndex)?.description}</p>
        <button type="button" className="text-accent-indigo underline mt-2" onClick={() => onSelectDate(dates[inspectedIndex])}>Read this session with VaNi →</button>
      </> : <p className="text-muted">{selectedDate ? `No ${mode === 'breadth' ? 'participation' : 'momentum'} observation for ${sessionDate(selectedDate)} in this window.` : 'Point to a cell to see its exact value and change. Tap to keep that date highlighted on both charts.'}</p>}
    </div>
    <div className="mt-3 text-[11px] text-muted space-y-2">
      {mode === 'breadth' ? <>
        <p><span className="text-risk-red">●</span> Entered Greed (score crossed above 55) · <span className="text-risk-green">●</span> Entered Fear (score crossed below 35). Dots mark zone entry, not buy or sell confirmation.</p>
        <p>EMA bands become stricter with horizon. Red = extended, light red = elevated, amber = transition, dark green = opportunity watch, light green = extreme fear. Select a cell for its band and exact change.</p>
        <p>Daily pressure pairs Up &gt;5% with Down &gt;5%. Five-day extremes pair Up &gt;20% with Down &gt;20%. Green favours buyers, red favours sellers, and stronger colour means an unusually large imbalance versus the preceding 22 sessions.</p>
      </> : <>
        <p>ROC shades: red below zero, neutral at zero, green above zero; full intensity at ±0.25. A negative reading recovering above its signal stays red.</p>
        <p>Select a ROC 13 cell to read whether it has held on a new side of the signal for two sessions. ROC 55 and Signal (5) show signed magnitude only.</p>
      </>}
      <p>Scales are fixed across windows. Exact values stay inside each cell. Stripes = coverage warning; a dash = missing value.</p>
    </div>
  </section>;
}
