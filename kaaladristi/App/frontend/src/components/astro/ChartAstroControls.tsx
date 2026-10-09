import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchActiveIndices } from '@/services/indexPickerService';
import { useEffect, useState } from 'react';
import type { AstroOccurrence } from '@/services/astroEvents';
import { boundary, astroToday } from '@/services/astroEvents';

/** Date selection and named occurrences, beside the shared price chart. */
export default function ChartAstroControls({ events, event, date, loading, failed, onRetry, onDate, onEvent, before, onMode, indexId, onClose, onEarlier }: {
  events: AstroOccurrence[]; event?: AstroOccurrence; date: string;
  loading: boolean; failed: boolean; onRetry: () => void;
  onDate: (date:string) => void; onEvent: (event:AstroOccurrence) => void; before?: boolean; onMode: (mode:'before'|'after')=>void; indexId:number; onClose:()=>void; onEarlier:()=>void;
}) {
  const navigate=useNavigate(), [params]=useSearchParams();
  const indices=useQuery({queryKey:['active-indices'],queryFn:fetchActiveIndices,staleTime:300_000});
  const occurrences=events.filter(e=>e.event_type===event?.event_type && e.details.sign===event?.details.sign).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  const at=occurrences.findIndex(e=>e.event_key===event?.event_key);
  const [draft,setDraft] = useState(date), [search,setSearch] = useState(''), [listOpen,setListOpen] = useState(!event);
  useEffect(()=>setListOpen(!event),[event?.event_key,date]);
  useEffect(()=>setDraft(date),[date]);
  const matches = events.filter(e=>`${e.display_name} ${e.details.sign ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const onDay = matches.filter(e=>e.start_date===date || (e.shape==='period' && e.end_date===date));
  const ongoing = matches.filter(e=>e.shape==='period' && e.start_date<date && e.end_date>date);
  const list = (items:AstroOccurrence[]) => items.map(e=><button key={e.event_key} aria-pressed={event?.event_key===e.event_key} onClick={()=>{setListOpen(false);onEvent(e)}} className="block w-full text-left border border-kd-border rounded p-2 my-1 text-sm hover:border-[var(--accent)]" style={event?.event_key===e.event_key?{borderColor:'var(--accent)'}:undefined}>
    <strong className="block text-primary">{e.display_name}{e.details.sign ? ` · ${String(e.details.sign)}` : ''}</strong>
    <span className="text-secondary text-xs">{e.shape==='period' ? `${e.start_date} → ${e.end_date}${e.start_date===date?' · Starts today':e.end_date===date?' · Ends today':''}` : boundary(e,'start')}</span>
  </button>);
  return <section aria-label="Events on selected date" className="rounded-lg border border-kd-border bg-kd-card p-3 text-sm text-secondary">
    <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();if(draft){setListOpen(true);onDate(draft)}}}>
      <label className="flex-1">Go to date<input aria-label="Study date" type="date" min="1990-01-01" value={draft} onChange={e=>setDraft(e.target.value)} className="block w-full bg-kd-card border border-kd-border rounded p-2 text-primary" required/></label>
      <button type="submit" className="border border-kd-border rounded p-2 text-primary">Go</button>
      <button type="button" onClick={()=>onDate(astroToday())} className="underline">Today</button>
    </form>
    <label className="block mt-2">Index <select aria-label="Astro study index" className="w-full bg-kd-card border border-kd-border rounded p-1" value={indexId} onChange={e=>{const index=indices.data?.find(i=>i.id===Number(e.target.value));if(index){const next=new URLSearchParams(params);next.set('name',index.display_name);navigate(`/chart/index/${index.id}?${next}`)}}}>{!indices.data?.some(i=>i.id===indexId)&&<option value={indexId}>{params.get('name') ?? `Index #${indexId}`}</option>}{indices.data?.map(i=><option key={i.id} value={i.id}>{i.display_name}</option>)}</select></label>
    <p className="mt-2">{date} · Select a candle or enter a date. Market readings stay pinned until you select another session.</p>
    {event && <div className="flex gap-2 mt-2"><button disabled={at<=0} onClick={()=>onEvent(occurrences[at-1])}>← Previous occurrence</button><button disabled={at<0||at>=occurrences.length-1} onClick={()=>onEvent(occurrences[at+1])}>Next occurrence →</button></div>}
    {event && at===0 && <button className="underline mt-2" onClick={onEarlier}>Load earlier occurrences</button>}
    {params.get('astro')==='1' && <button className="underline mt-2" onClick={onClose}>Close astro context</button>}
    {event && <div className="flex gap-2 mt-2"><button aria-pressed={before} onClick={()=>onMode('before')}>As of event</button><button aria-pressed={!before} onClick={()=>onMode('after')}>Explore what followed</button></div>}
    <div className="mt-3"><button aria-expanded={listOpen} className="text-primary underline" onClick={()=>setListOpen(open=>!open)}>{event?`Choose another event · ${date}`:`Events on ${date}`}</button>{listOpen && <>
    <input aria-label="Search events on selected date" placeholder="Search event or sign…" value={search} onChange={e=>setSearch(e.target.value)} className="mt-3 w-full bg-kd-card border border-kd-border rounded p-2"/>
    {loading && <p role="status" className="mt-2">Loading events for this date…</p>}
    {failed && <p role="alert">Events could not load. <button onClick={onRetry}>Retry events</button></p>}
    {!loading && !failed && <div className="max-h-72 overflow-auto mt-3">
      <h3 className="font-semibold text-primary">On this date</h3>
      {list(onDay)}{!onDay.length && <p className="py-2">No matching published event starts or ends on this date.</p>}
      <h3 className="font-semibold text-primary mt-3">Ongoing periods</h3>
      {list(ongoing)}{!ongoing.length && <p className="py-2">No matching ongoing periods.</p>}
    </div>}
    </>}</div>
  </section>;
}
