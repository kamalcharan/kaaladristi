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
import {leadershipStory} from '@/services/leadershipStory';
import '@/styles/vaniStories.css';

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
function examples(rows:LeadershipRow[],intent:Intent) {
 const selected=rows.filter(r=>intent.endsWith('.building')?r.status==='Building':intent.endsWith('.cooling')?r.status==='Cooling':intent.endsWith('.flow')?
  (r.status==='Running broadly'&&['Fading','Outflow'].includes(r.flow?.state??''))||(r.status==='Cooling'&&['Strong','Building'].includes(r.flow?.state??'')):true);
 return [...selected].sort((a,b)=>b.aligned_streak-a.aligned_streak||a.name.localeCompare(b.name));
}
function Evidence({rows,intent,date,months}:{rows:LeadershipRow[];intent:Intent;date?:string;months:number}) {
 const story=leadershipStory(rows,intent);
 return <section className="vani-story" data-tone={story.tone} aria-label="Longer-term interpretation">
  <p className="vani-eyebrow">What stands out</p><h4>{story.title}</h4>
  <p className="vani-eyebrow">Why it matters</p><p>{story.meaning}</p>
  <div className="vani-next"><p className="vani-eyebrow">Inspect next</p><p>{story.next}</p>
   {story.focus&&<Link className="sector-question" to={`/sector-rotation/${story.focus.index_id}?asof=${date}&research=leadership&months=${months}`}>Inspect {story.focus.name}</Link>}
  </div>
 </section>;
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
  {loading?<p role="status" className="flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>Consulting VaNi…</p>:error?<p role="alert">{error.message}</p>:<details key={intent} className="vani-explanation"><summary>VaNi explanation</summary><p className="text-sm leading-6">{reading.data?.response}</p>{reading.data?.log_id&&<VaNiFeedback key={`${intent}-${reading.data.log_id}`} logId={reading.data.log_id}/>}</details>}
  {!loading&&reading.data?.context_changed&&<p>The data changed. Refresh the reading.</p>}
  {!loading&&(error||reading.data?.context_changed)&&<button className="sector-question" onClick={retry}>Refresh reading</button>}
  {!evidence.error&&evidence.data&&<SectorPersonalConnections sourceKey={evidence.data.snapshot} date={evidence.data.date} membership={evidence.data.membership} sectors={examples(evidence.data.rows,intent).map(r=>({id:r.index_id,name:r.name,reading:`${r.status}; current flow: ${r.flow?.state??'Unavailable'}`}))}/>}
  <p className="text-xs text-muted">Readings describe the selected category and closing-data session. Alignment is an observation, not a prediction.</p>
 </aside>;
}