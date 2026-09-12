import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {useSectorResearchStore} from '@/stores/sectorResearchStore';
import {useAuthStore} from '@/stores/authStore';
import {useLeadership,askLeadership} from '@/services/sectorLeadership';
import VaNiFeedback from './VaNiFeedback';
export default function LeadershipCompanion() {
 const c=useSectorResearchStore();
 const user=useAuthStore(s=>s.profile?.id);
 const evidence=useLeadership(c.category,c.date,c.months??6);
 const key=JSON.stringify([c.category,c.date,c.months,evidence.data?.snapshot]);
 const [presented,setPresented]=useState('');
 useEffect(()=>{const t=setTimeout(()=>setPresented(key),450);return()=>clearTimeout(t)},[key]);
 const reading=useQuery({queryKey:['vani','sector.leadership',user,evidence.data?.snapshot],enabled:!!evidence.data?.snapshot,
  staleTime:1800000,retry:false,refetchInterval:q=>q.state.data?.pending?1500:false,
  queryFn:()=>askLeadership({intent_id:'sector.leadership',date:c.date,sector_category:c.category,leadership_months:c.months??6,sector_snapshot:evidence.data?.snapshot})});
 const loading=key!==presented||evidence.isFetching||reading.isFetching||reading.data?.pending;
 const error=evidence.error||reading.error;
 return <aside className="sector-vani p-4 space-y-3" aria-label="VaNi longer-term companion">
  <h2 className="text-lg font-serif">VaNi · Longer-term picture</h2>
  <p className="text-xs text-muted">{c.months??6} months · {c.category==='custom'?'Curated':c.category} · {c.date}</p>
  <p className="text-sm">Read index structure, constituent support and persistence together.</p>
  {loading?<p role="status" className="flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin"/>Consulting VaNi…</p>:error?<p role="alert">{error.message}</p>:<p className="text-sm leading-6">{reading.data?.response}</p>}
  {!loading&&reading.data?.context_changed&&<p>The data changed. Refresh the reading.</p>}
  {!loading&&(error||reading.data?.context_changed)&&<button className="sector-question" onClick={async()=>{setPresented('');await evidence.refetch();await reading.refetch();setTimeout(()=>setPresented(key),450)}}>Refresh reading</button>}
  {!loading&&!error&&reading.data?.log_id&&<VaNiFeedback logId={reading.data.log_id}/>}
  <p className="text-xs text-muted">The page contains the underlying readings. Alignment is an observed condition, not a prediction.</p>
 </aside>;
}
