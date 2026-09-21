import { useState } from 'react';
import VerticalEventTimeline from './VerticalEventTimeline';
import type { IndicatorRow } from '@/services/indicatorData';
import type { StoryEvent } from '@/services/storyEvents';
import { ZONE_LABELS } from '@/constants/signalScale';
import { positiveNumber, relation, validNumber } from './stockStoryFacts';

type Row = (IndicatorRow & { delivery_pct?: number | null; w52_high?: number | null }) | null;
const number = (v: unknown, digits = 2) => validNumber(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: digits }) : 'Unavailable';
const signed = (v: number) => `${v > 0 ? '+' : ''}${number(v)}`;
const distance = (value: number | undefined, ref: number | null | undefined) => validNumber(value) && positiveNumber(ref) ? (value / ref - 1) * 100 : null;
export const eventLanes = [
  { label: 'Price & structure', kinds: ['price_action', 'stage', 'gl', 'fpb', 'discovery'] },
  { label: 'Relative strength', kinds: ['magic_rs', 'rs_breakaway', 'sector'] },
  { label: 'Participation', kinds: ['flow', 'conviction', 'big_money', 'scan'] },
];

/** Display-only scales. Stored scores and events are never recalculated here. */
export function StoryVisualSummary({ row }: { row: Row }) {
  const refs = [
    { label: 'Golden Line', value: row?.sma_150 },
    { label: 'Previous week close', value: row?.prev_week_close },
    { label: 'Latest close', value: row?.close },
    { label: '52-week high', value: row?.w52_high },
  ];
  const values = refs.map(r => r.value).filter(positiveNumber);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const position = (v: number) => high === low ? 50 : 4 + (v - low) / (high - low) * 92;
  const changes = [row?.magic_rs_chg_5d, row?.magic_rs_chg_22d, row?.magic_rs_chg_66d];
  const scale = Math.max(1, ...changes.filter(validNumber).map(Math.abs));
  const flows = [row?.score_5d, row?.score_22d];
  const flowScale = Math.max(1, ...flows.filter(validNumber).map(Math.abs));
  const week = distance(row?.close, row?.prev_week_close);
  return <div className="story-summary-grid story-visual-summary">
    <section className="story-panel"><p className="story-kicker">01 · Price structure</p><h2>Where price sits</h2>
      <strong className="story-visual-value">{positiveNumber(row?.close) ? `₹${number(row.close)}` : 'Unavailable'}</strong>
      <p>{week === null ? 'Previous week reference unavailable' : `${signed(week)}% vs previous week close`}</p>
      <div className="story-price-track" aria-hidden="true">{refs.map((ref, i) => positiveNumber(ref.value) && <span key={ref.label} className={i === 2 ? 'story-pin story-pin-close' : 'story-pin'} style={{ left: `${position(ref.value)}%` }}>{i + 1}</span>)}</div>
      <div className="story-reference-key">{refs.map((ref, i) => <div key={ref.label}><span>{i + 1} · {ref.label}</span><strong>{positiveNumber(ref.value) ? `₹${number(ref.value)}` : 'Unavailable'}</strong></div>)}</div>
      <p className="story-muted">Markers share a price scale; not a price chart.</p>
      <dl><div><dt>Recorded stage · RSI (14)</dt><dd>{row?.stage ?? 'Unavailable'} · {number(row?.rsi_14, 1)}</dd></div>
        <div><dt>Close vs daily 50 SMA</dt><dd>{relation(row?.close, row?.sma_50)}</dd></div>
        <div><dt>Daily 50 vs 200 SMA</dt><dd>{relation(row?.sma_50, row?.sma_200)}</dd></div>
        <div><dt>Distance · 20 EMA / 200 SMA</dt><dd>{[row?.ema_20, row?.sma_200].map(v => { const d = distance(row?.close, v); return d === null ? 'Unavailable' : `${signed(d)}%`; }).join(' / ')}</dd></div></dl>
    </section>
    <section className="story-panel"><p className="story-kicker">02 · Relative strength</p><h2>Level ≠ momentum</h2>
      <p>MagicRS vs NIFTY 500</p><strong className="story-visual-value">{number(row?.magic_rs)} · {ZONE_LABELS[row?.magic_rs_zone ?? '']?.label ?? 'Unavailable'}</strong>
      <p className="story-muted">Stored change · RS points</p>
      <div className="story-axis-caption"><span>−{number(scale)}</span><span>0</span><span>+{number(scale)}</span></div>
      {changes.map((v, i) => <div className="story-meter-row" key={i}><span>{[5, 22, 66][i]} sessions</span><div className="story-zero-track" aria-hidden="true">{validNumber(v) && <i className={v < 0 ? 'story-negative' : 'story-positive'} style={{ left: `${v < 0 ? 50 - Math.abs(v) / scale * 50 : 50}%`, width: `${Math.abs(v) / scale * 50}%` }}/>}</div><strong>{validNumber(v) ? signed(v) : 'Unavailable'}</strong></div>)}
      <p className="story-explanation">Positive RS and falling recent momentum can coexist. Read each timeframe separately.</p>
      <p className="story-muted">All three bars use the same zero-centred scale. Missing values are not zero.</p>
    </section>
    <section className="story-panel"><p className="story-kicker">03 · Participation</p><h2>Who participated?</h2>
      <p className="story-muted">Stored flow scores · comparison, not a percentage</p>
      {flows.map((v, i) => <div className="story-meter-row" key={i}><span>{[5, 22][i]} sessions</span><div className="story-fill-track" aria-hidden="true">{validNumber(v) && <i style={{ width: `${Math.abs(v) / flowScale * 100}%` }}/>}</div><strong>{number(v, 1)}</strong></div>)}
      <p className="story-muted">Shared magnitude scale: 0–{number(flowScale, 1)}. Read signs in the values.</p>
      <div className="story-participation-pair"><div><span>Relative volume</span><strong>{validNumber(row?.rvol) ? `${number(row.rvol)}×` : 'Unavailable'}</strong></div><div><span>Delivery / traded quantity</span><strong>{validNumber(row?.delivery_pct) ? `${number(row.delivery_pct, 1)}%` : 'Unavailable'}</strong></div></div>
      <div className="story-fill-track story-delivery-track" aria-hidden="true">{validNumber(row?.delivery_pct) && row.delivery_pct >= 0 && row.delivery_pct <= 100 && <i style={{ width: `${row.delivery_pct}%` }}/>}</div>
      <p>{row?.flow_type?.replaceAll('_', ' ') ?? 'Order flow unavailable'}</p><p className="story-explanation">Participation is separate from relative performance.</p>
    </section>
  </div>;
}

export function StoryEventExplorer({ events, loading, onLocate }: { events: StoryEvent[]; loading: boolean; onLocate: (e: StoryEvent) => void }) {
  const [filter, setFilter] = useState('All events');
  const [selected, setSelected] = useState('');

  const lane = eventLanes.find(l => l.label === filter);
  const filtered = events.filter(e => !lane || lane.kinds.includes(e.kind));
  const dates = [...new Set(filtered.map(e => e.date))].sort();
  const active = dates.includes(selected) ? selected : dates.at(-1);
  // Context on the selected day always includes every family, regardless of discovery filter.
  const dayEvents = events.filter(e => e.date === active).sort((a, b) => b.priority - a.priority);
  return <>
    <div className="story-filters" aria-label="Event categories">{['All events', ...eventLanes.map(l => l.label)].map(f => <button key={f} aria-pressed={filter === f} onClick={() => { setFilter(f); setSelected(''); }}>{f}</button>)}</div>
    {!dates.length ? <p>{loading ? 'Loading events…' : 'No matching events recorded in the loaded chart window.'}</p> : <>
      <VerticalEventTimeline key={filter} events={filtered} lanes={eventLanes} active={active} onSelect={setSelected}/>
      <div className="story-day-heading"><h3>Connected observations · {active}</h3><p className="story-muted">Same date, not proof of causation. The overview and setup remain current.</p></div>
      <div className="story-connected-grid" aria-live="polite">{eventLanes.map(l => <section className="story-connected-card" key={l.label}><p className="story-kicker">{l.label}</p>{dayEvents.filter(e => l.kinds.includes(e.kind)).map((event, i) => <article className="story-connected-event" key={`${event.kind}-${i}`}><strong>{event.title}</strong><p>{event.detail}</p>{event.kind === 'gl' && <p className="story-muted">Historical pipeline classification; nearby signals may be recorded after this date.</p>}<button className="story-chart-link" onClick={() => onLocate(event)}>Locate candle →</button></article>)}{!dayEvents.some(e => l.kinds.includes(e.kind)) && <p className="story-muted">No event in this family in the loaded stream for this date. This does not establish the underlying indicator state.</p>}</section>)}</div>
    </>}
  </>;
}

export function StoryReferenceDistance({ close, value }: { close?: number; value: number | null }) {
  const d = distance(close, value);
  return <div className="story-watch-distance"><span>{d === null ? 'Distance unavailable' : `${signed(d)}% from reference`}</span><div className="story-zero-track" aria-hidden="true">{d !== null && <i className={d < 0 ? 'story-negative' : 'story-positive'} style={{ left: `${d < 0 ? 50 - Math.min(50, Math.abs(d) / 15 * 50) : 50}%`, width: `${Math.min(50, Math.abs(d) / 15 * 50)}%` }}/>}</div></div>;
}
