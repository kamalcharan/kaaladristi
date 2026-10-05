import { useQuery } from '@tanstack/react-query';
import { fetchActiveIndices } from '@/services/indexPickerService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { boundary, type AstroOccurrence } from '@/services/astroEvents';
import { astroStudyLink } from '@/services/astroStudy';

/** Selection controls only; deliberately has no chart, price query or widgets. */
export default function ChartAstroControls({ events, matches, event, indexId, loading, failed, onRetry, onEarlier }: {
  events: AstroOccurrence[]; matches: AstroOccurrence[]; event?: AstroOccurrence;
  indexId: number; loading: boolean; failed: boolean; onRetry: () => void; onEarlier: () => void;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const indices = useQuery({queryKey:['active-indices'],queryFn:fetchActiveIndices,staleTime:300_000});
  const choose = (e: AstroOccurrence) => {
    const next = new URLSearchParams(astroStudyLink(e,indexId).split('?')[1]);
    if (params.has('sign')) next.set('sign',params.get('sign')!);
    if (params.has('mode')) next.set('mode',params.get('mode')!);
    if (params.has('name')) next.set('name',params.get('name')!);
    navigate(`/chart/index/${indexId}?${next}`);
  };
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key,value) : next.delete(key);
    if (key === 'sign') { next.delete('event'); next.delete('session'); }
    setParams(next);
  };
  const at = matches.findIndex(e => e.event_key === event?.event_key);
  const types = [...new Map(events.map(e => [e.event_type,e.display_name])).entries()];
  return <section aria-label="Astro study context" className="rounded-lg border border-kd-border bg-kd-card p-3 mb-3 text-sm text-secondary">
    <div className="flex flex-wrap items-center gap-3">
      <strong className="text-primary">Astro · Chart & Replay</strong>
      <label className="min-w-0 max-w-full">Event <select aria-label="Astro event type" className="bg-kd-card border border-kd-border rounded p-1 max-w-full" value={params.get('type') ?? event?.event_type ?? ''} onChange={e => {const first=events.find(v=>v.event_type===e.target.value);if(first)choose(first)}}><option value="">Choose event</option>{types.map(([type,name])=><option key={type} value={type}>{name}</option>)}</select></label>
      <label className="min-w-0 max-w-full">Index <select aria-label="Astro study index" className="bg-kd-card border border-kd-border rounded p-1 max-w-full" value={indexId} onChange={e=>{const next=new URLSearchParams(params);const index=indices.data?.find(i=>i.id===Number(e.target.value));if(!index)return;next.set('name',index.display_name);navigate(`/chart/index/${index.id}?${next}`)}}>{!indices.data?.some(i=>i.id===indexId) && <option value={indexId}>{params.get('name') ?? `Index #${indexId}`}</option>}{indices.data?.map(i=><option key={i.id} value={i.id}>{i.display_name}</option>)}</select></label>
      <label>Sign <select aria-label="Sign at astro event" className="bg-kd-card border border-kd-border rounded p-1 max-w-full" value={params.get('sign') ?? ''} onChange={e=>update('sign',e.target.value)}><option value="">All recorded signs</option>{[...new Set(events.map(e=>e.details.sign).filter((s):s is string=>typeof s==='string'))].sort().map(s=><option key={s}>{s}</option>)}</select></label>
      <button disabled={at<0 || at>=matches.length-1} onClick={()=>choose(matches[at+1])}>← Previous occurrence</button>
      <button disabled={at<=0} onClick={()=>choose(matches[at-1])}>Next occurrence →</button>
      <button onClick={onEarlier}>Load earlier occurrences</button>
      <button aria-pressed={params.get('mode')==='before'} onClick={()=>update('mode','before')}>As of event</button>
      <button aria-pressed={params.get('mode')!=='before'} onClick={()=>update('mode','after')}>Explore what followed</button>
      <button onClick={()=>{const next=new URLSearchParams(params);for(const key of ['astro','event','type','family','date','mode','session','sign'])next.delete(key);setParams(next)}}>Close astro context</button>
    </div>
    {loading && <p role="status" className="mt-2">Loading published astro events…</p>}
    {failed && <p role="alert">Event data could not load. <button onClick={onRetry}>Retry events</button></p>}
    {event && <p className="mt-2"><strong>{event.display_name}</strong> · {boundary(event,'start')}{event.shape==='period' && ` → ${boundary(event,'end')}`}{event.details.sign ? ` · ${String(event.details.sign)}` : ''}. {params.get('mode')==='before'?'Market observations stop at the event date (EOD).':'Retrospective view includes later market observations.'} Weekends stay on the astronomical date.</p>}
    {!loading && !failed && !event && <p>No matching published occurrence. Choose another event or load earlier occurrences.</p>}
  </section>;
}
