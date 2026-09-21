import { useState } from 'react';
import type { StoryEvent } from '@/services/storyEvents';

const DAY = 86400000;
const stamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);
const symbols = ['□', '◇', '○'];
export function timePosition(date: string, end: number, span: number, height: number) {
  return 24 + (end - stamp(date)) / (span * DAY) * height;
}

/** Shared calendar geometry, not a new event classifier. Labels may move; anchors never do. */
export default function VerticalEventTimeline({ events, lanes, active, onSelect }: {
  events: StoryEvent[]; lanes: { label: string; kinds: string[] }[];
  active?: string; onSelect: (date: string) => void;
}) {
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(0);
  const dates = [...new Set(events.map(e => e.date))].sort();
  const latest = dates.at(-1);
  if (!latest) return null;
  const oldest = stamp(dates[0]);
  const maxPage = Math.max(0, Math.floor((stamp(latest) - oldest) / (days * DAY)));
  const currentPage = Math.min(page, maxPage);
  const end = stamp(latest) - currentPage * days * DAY;
  const start = end - (days - 1) * DAY;
  const span = days - 1;
  const height = 480;
  const visible = dates.filter(d => stamp(d) >= start && stamp(d) <= end).reverse();
  const layout = lanes.map(lane => {
    let bottom = 0;
    return visible.flatMap(date => {
      const recorded = events.filter(e => e.date === date && lane.kinds.includes(e.kind));
      if (!recorded.length) return [];
      const anchor = timePosition(date, end, span, height);
      const top = Math.max(anchor - 12, bottom + 8);
      const sizes = recorded.map(e => 34 + Math.ceil(e.title.length / 22) * 17);
      const size = sizes.reduce((a, b) => a + b, 0) + (recorded.length - 1) * 4;
      bottom = top + size;
      return [{ date, recorded, sizes, anchor, top, size }];
    });
  });
  const totalHeight = Math.max(height + 70, ...layout.flat().map(g => g.top + g.size + 20));
  return <>
    <div className="story-time-controls"><strong>{iso(start)} → {iso(end)} · latest at top</strong>
      <label>Window <select aria-label="Timeline window" value={days} onChange={e => { setDays(Number(e.target.value)); setPage(0); }}>{[7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}</select></label>
      <button disabled={currentPage >= maxPage} onClick={() => setPage(currentPage + 1)}>← Earlier</button><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Later →</button>
    </div>
    <p className="story-muted">□ Price · ◇ Relative strength · ○ Participation. <span className="story-event-positive">↑ Positive</span> · <span className="story-event-negative">↓ Negative</span> · — Neutral (recorded classification, not a forecast).</p>
    <p className="story-muted">Shared calendar scale. Leaders connect displaced labels to their exact dates. On narrow screens, scroll sideways to compare lanes.</p>
    <div className="story-time-scroll" role="region" aria-label="Time-aligned event lanes" tabIndex={0}>
      <div className="story-time-head"><span>Date ↓</span>{lanes.map((l, i) => <strong key={l.label}>{symbols[i]} {l.label}</strong>)}</div>
      <div className="story-time-body" style={{ height: totalHeight }}>
        {Array.from({ length: days }, (_, i) => i).filter(i => days <= 14 || i % 5 === 0 || i === days - 1).map(i => <div className="story-time-tick" style={{ top: 24 + i / span * height }} key={i}><time>{iso(end - i * DAY).slice(5)}</time></div>)}
        {layout.map((groups, index) => <div className="story-time-lane" key={lanes[index].label} style={{ gridColumn: index + 2 }}>
          <div className="story-time-spine" style={{ height: height + 1 }}/>
          <svg className="story-time-leaders" height={totalHeight} width="100%" aria-hidden="true">{groups.map(g => <path key={g.date} d={`M 12 ${g.anchor} L 32 ${g.top + 18}`} fill="none" stroke="currentColor"/>)}</svg>
          {groups.map(g => <div key={g.date}>
            <span className="story-time-anchor" data-date={g.date} style={{ top: g.anchor }} aria-hidden="true">{symbols[index]}</span>
            <div className="story-time-group" style={{ top: g.top }}>{g.recorded.map((event, i) => <button key={`${event.kind}-${i}`} style={{ minHeight: g.sizes[i] }} className={`story-time-event ${event.tone === 'bull' ? 'story-event-positive' : event.tone === 'bear' ? 'story-event-negative' : 'story-event-neutral'}`} aria-pressed={active === g.date} onClick={() => onSelect(g.date)}>
              <time dateTime={g.date}>{g.date} · {event.tone === 'bull' ? '↑' : event.tone === 'bear' ? '↓' : '—'}</time><strong>{event.title}</strong>
            </button>)}</div>
          </div>)}
        </div>)}
      </div>
    </div>
    {!visible.length && <p className="story-muted">No recorded events in this calendar window. Use Earlier or Later.</p>}
  </>;
}
