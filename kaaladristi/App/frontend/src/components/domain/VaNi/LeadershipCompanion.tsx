import SectorPersonalConnections from './SectorPersonalConnections';
import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Loader2} from 'lucide-react';
import {useSectorResearchStore} from '@/stores/sectorResearchStore';
import {useAuthStore} from '@/stores/authStore';
import {useLeadership,askLeadership,type LeadershipRow} from '@/services/sectorLeadership';
import {sectorSessionDate} from '@/lib/sectorFlow';
import VaNiFeedback from './VaNiFeedback';

const questions = {
 'sector.leadership':'Which baskets are holding strength?',
 'sector.leadership.building':'Which baskets are building strength?',
 'sector.leadership.cooling':'Where is strength weakening?',
 'sector.leadership.persistence':'How long has the strength lasted?',
 'sector.leadership.support':'Is strength supported across stocks?',
 'sector.leadership.flow':'How does current flow compare?',
 'sector.leadership.learn':'How do I read these groups?',
} as const;
type Intent=keyof typeof questions;
const groups=['Running broadly','Building','Cooling','Limited coverage','Not aligned','Unavailable'];
function examples(rows:LeadershipRow[],intent:Intent) {
 const selected=rows.filter(r=>intent.endsWith('.building')?r.status==='Building':intent.endsWith('.cooling')?r.status==='Cooling':intent.endsWith('.flow')?
  (r.status==='Running broadly'&&['Fading','Outflow'].includes(r.flow?.state??''))||(r.status==='Cooling'&&['Strong','Building'].includes(r.flow?.state??'')):true);
 return [...selected].sort((a,b)=>b.aligned_streak-a.aligned_streak||a.name.localeCompare(b.name));
}
function Evidence({rows,intent,date,months}:{rows:LeadershipRow[];intent:Intent;date?:string;months:number}) {
 if(intent==='sector.leadership.learn') return <p className="text-xs text-muted">W/M agreement → persistence → constituent support. Read current flow separately. Daily MagicRS is not part of this view.</p>;
 if(intent==='sector.leadership') return <dl className="grid grid-cols-2 gap-2" aria-label="Longer-term group counts">{groups.map(g=><div key={g} className="rounded-lg border border-[var(--border)] p-2"><dt className="text-xs">{g}</dt><dd className="text-lg font-semibold">{rows.filter(r=>r.status===g).length}</dd></div>)}</dl>;
 const selected=examples(rows,intent);
 return <div className="space-y-2" aria-label="Longer-term question evidence">
  <p className="text-xs text-muted">{selected.length} matching baskets{selected.length>5?' · showing 5 examples':''}{intent.endsWith('.flow')?' with differing readings':''}</p>
  {!selected.length&&<p className="text-sm">No baskets match this question for this session.</p>}
  {selected.slice(0,5).map(r=>{const c=r.current;const h=r.alignment_history;return <article key={r.index_id} className="rounded-lg border border-[var(--border)] p-2 space-y-1">
   <Link className="text-sm underline break-words" to={`/sector-rotation/${r.index_id}?asof=${date}&research=leadership&months=${months}`}>{r.name}</Link>
   <p className="text-xs">{r.status}</p>
   {intent.endsWith('.flow')?<p className="text-sm">Longer term: <strong>{r.status}</strong><br/>Current flow: <strong>{r.flow?.state??'Unavailable'}</strong></p>:
    intent.endsWith('.support')?<><p className="text-sm"><strong>{c.leaders??0}/{c.eligible} Leaders</strong> · {c.watch??0} Watch</p><p className="text-xs">{c.eligible}/{c.total} classified{r.status==='Limited coverage'?' · limited coverage':''}</p></>:
    intent.endsWith('.persistence')?<><p className="text-sm"><strong>{r.aligned_streak} completed weeks</strong> in the current agreement run</p><p className="text-xs">In this window: {h.filter(s=>s.weekly===true&&s.monthly===true).length} W/M aligned · {h.filter(s=>s.weekly==null||s.monthly==null).length} missing · {h.filter(s=>s.weekly!=null&&s.monthly!=null&&!(s.weekly&&s.monthly)).length} without agreement</p></>:
    <><p className="text-xs">W: {c.weekly==null?'Unavailable':c.weekly?'Aligned':'Not aligned'} · M: {c.monthly==null?'Unavailable':c.monthly?'Aligned':'Not aligned'}</p><p className="text-xs">{r.aligned_streak} completed aligned weeks · {c.leaders??0}/{c.eligible} Leaders</p></>}
  </article>})}
 </div>;
}
export default function LeadershipCompanion() {
 const c=useSectorResearchStore();
 const user=useAuthStore(s=>s.profile?.id);
 const [intent,setIntent]=useState<Intent>('sector.leadership');
 const [cycle,setCycle]=useState(0);
 const evidence=useLeadership(c.category,c.date,c.months??6);
 const key=JSON.stringify([intent,cycle,c.category,c.date,c.months,evidence.data?.snapshot]);
 const [presented,setPresented]=useState('');
 useEffect(()=>{const t=setTimeout(()=>setPresented(key),450);return()=>clearTimeout(t)},[key]);
 const reading=useQuery({queryKey:['vani',intent,user,evidence.data?.snapshot],enabled:!!evidence.data?.snapshot&&!evidence.isError,
  staleTime:1800000,retry:false,refetchInterval:q=>q.state.data?.pending?1500:false,
  queryFn:()=>askLeadership({intent_id:intent,date:c.date,sector_category:c.category,leadership_months:c.months??6,sector_snapshot:evidence.data?.snapshot})});
 const loading=key!==presented||evidence.isFetching||reading.isFetching||reading.data?.pending;
 const error=evidence.error||reading.error;
 const retry=async()=>{setCycle(v=>v+1);const fresh=await evidence.refetch();if(fresh.data?.snapshot===evidence.data?.snapshot&&!fresh.error)await reading.refetch();};
 return <aside className="sector-vani p-4 space-y-3 xl:max-h-[calc(100dvh-110px)] xl:overflow-y-auto" aria-label="VaNi longer-term companion">
  <h2 className="text-lg font-serif">VaNi · Longer-term picture</h2>
  <p className="text-xs text-muted">{c.months??6} months · {c.category==='custom'?'Curated':c.category} · {c.date?sectorSessionDate(c.date):'Select a session'}</p>
  <details><summary className="sector-question cursor-pointer">Open longer-term intents</summary><div className="flex flex-col gap-2 pt-2" aria-label="Longer-term questions">{Object.entries(questions).map(([id,label])=><button key={id} className="sector-question text-left" aria-pressed={intent===id} onClick={()=>{setIntent(id as Intent);setCycle(v=>v+1)}}>{label}</button>)}</div></details>
  <h3 className="font-medium text-sm">{questions[intent]}</h3>
  {!evidence.isFetching&&!evidence.error&&evidence.data&&<Evidence rows={evidence.data.rows} intent={intent} date={evidence.data.date} months={c.months??6}/>}
  {loading?<p role="status" className="flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>Consulting VaNi…</p>:error?<p role="alert">{error.message}</p>:<p className="text-sm leading-6">{reading.data?.response}</p>}
  {!loading&&reading.data?.context_changed&&<p>The data changed. Refresh the reading.</p>}
  {!loading&&(error||reading.data?.context_changed)&&<button className="sector-question" onClick={retry}>Refresh reading</button>}
  {!loading&&!error&&reading.data?.log_id&&<VaNiFeedback key={`${intent}-${reading.data.log_id}`} logId={reading.data.log_id}/>}
  {!evidence.error&&evidence.data&&<SectorPersonalConnections sourceKey={evidence.data.snapshot} date={evidence.data.date} membership={evidence.data.membership} sectors={examples(evidence.data.rows,intent).map(r=>({id:r.index_id,name:r.name,reading:`${r.status}; current flow: ${r.flow?.state??'Unavailable'}`}))}/>}
  <p className="text-xs text-muted">Readings describe the selected category and closing-data session. Alignment is an observation, not a prediction.</p>
 </aside>;
}