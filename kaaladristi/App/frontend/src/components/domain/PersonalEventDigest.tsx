import { useState } from 'react';
import { Square, Diamond, Circle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { StoryEvent, StoryTone } from '@/services/storyEvents';

export function compactEventTitle(title: string) {
  return title.replace('RS momentum · ', 'RS ').replace(/(\d+) sessions/g, '$1D').replace('zero', '0');
}
const tones = [{ value: 'bull', label: 'Positive', Icon: ArrowUp }, { value: 'bear', label: 'Negative', Icon: ArrowDown }, { value: 'neutral', label: 'Neutral', Icon: Minus }] as const;
export default function PersonalEventDigest({ events, compact = false }: { events: StoryEvent[]; compact?: boolean }) {
  const [filter, setFilter] = useState<StoryTone | null>(null);
  const visible = events.filter(e => !filter || e.tone === filter);
  const row = (event: StoryEvent, index: number) => {
    const rs = ['magic_rs', 'rs_breakaway', 'sector'].includes(event.kind);
    const participation = ['flow', 'conviction', 'big_money', 'scan'].includes(event.kind);
    const Family = rs ? Diamond : participation ? Circle : Square;
    const tone = tones.find(t => t.value === event.tone)!;
    return <div className={`ps-event ps-tone-${event.tone}`} key={`${event.date}-${event.kind}-${index}`}>
      <span className="ps-event-symbol" role="img" aria-label={`${rs ? 'Relative strength' : participation ? 'Participation' : 'Price'} · ${tone.label}`}><Family size={15} aria-hidden="true"/><tone.Icon size={12} aria-hidden="true"/></span>
      <span>{compactEventTitle(event.title)}</span><time dateTime={event.date}>{event.date}</time>
    </div>;
  };
  return <div className="ps-digest">
    <div className="ps-mix" aria-label="Filter recorded events by direction">{tones.map(({ value, label, Icon }) => <button key={value} className={`ps-tone-${value}`} aria-pressed={filter === value} aria-label={`${label}: ${events.filter(e => e.tone === value).length} events`} onClick={() => setFilter(filter === value ? null : value)}><Icon size={14} aria-hidden="true"/>{events.filter(e => e.tone === value).length}<span>{label}</span></button>)}{filter && <button onClick={() => setFilter(null)}>All</button>}</div>
    <div aria-live="polite">{visible.slice(0,compact ? 1 : 2).map(row)}{!visible.length && <p>No {filter ? tones.find(t => t.value === filter)?.label.toLowerCase() + ' ' : ''}events in this window.</p>}</div>
    {visible.length > (compact ? 1 : 2) && <details key={filter ?? 'all'}><summary>{visible.length - (compact ? 1 : 2)} more</summary>{visible.slice(compact ? 1 : 2).map(row)}</details>}
  </div>;
}
