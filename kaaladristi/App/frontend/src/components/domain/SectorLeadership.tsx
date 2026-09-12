import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLeadership, type LeadershipRow } from '@/services/sectorLeadership';
import type { SectorTab } from '@/services/sectorRotation';
import { sectorSessionDate } from '@/lib/sectorFlow';
const state=(value:boolean|null)=>value==null?'Unavailable':value?'Aligned':'Not aligned';
const pct=(value:number|null)=>value==null?'Unavailable':`${value.toFixed(1)}%`;
function Basket({row}:{row:LeadershipRow}) {
 const c=row.current;
 return <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 min-w-0 space-y-3">
  <Link className="font-medium underline" to={`/sector-rotation/${row.index_id}?asof=${c.date}`}>{row.name}</Link>
  <div className="grid gap-4 md:grid-cols-3 text-sm">
   <div><h3 className="font-medium">Index structure</h3><p>Weekly: {state(c.weekly)}</p><p>Monthly: {state(c.monthly)}</p>
    <p className="text-xs text-muted">Period closes: {c.weekly_date ? sectorSessionDate(c.weekly_date):'unavailable'} / {c.monthly_date ? sectorSessionDate(c.monthly_date):'unavailable'}</p></div>
   <div><h3 className="font-medium">Constituent support</h3><p>Stage 2 Leaders: {pct(c.leaders_pct)}{c.leaders!=null && ` (${c.leaders}/${c.eligible})`}</p>
    <p>Stage 2 Watch: {pct(c.watch_pct)}{c.watch!=null && ` (${c.watch}/${c.eligible})`}</p>
    <p className="text-xs text-muted">Classified: {c.eligible} of {c.total} members{c.eligible<5?' · At least 5 required':''}</p></div>
   <div><h3 className="font-medium">Persistence</h3><p>Both aligned: {row.aligned_samples} of {row.known_samples} known samples</p><p>Run within this window: {row.aligned_streak} samples</p>
    <p className="text-xs text-muted">Weekly samples plus selected session. Missing alignment breaks the run.</p></div>
  </div>
  <details><summary className="cursor-pointer min-h-11 text-sm">Inspect participation history</summary>
   <p className="text-xs text-muted">Percentage of classified constituents; gaps mean fewer than five readings. These are stage categories, not returns.</p>
   <div className="h-48 w-full min-w-0" role="img" aria-label={`${row.name} Stage 2 participation history`}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={row.history}>
     <XAxis dataKey="date" tickFormatter={sectorSessionDate} minTickGap={55} tick={{fontSize:10}}/><YAxis domain={[0,100]} width={32} tick={{fontSize:10}}/>
     <Tooltip labelFormatter={v=>sectorSessionDate(String(v))} contentStyle={{background:'var(--card)',borderColor:'var(--border)'}}/>
     <Line dataKey="leaders_pct" name="Leaders %" stroke="var(--risk-green)" dot={false} connectNulls={false} isAnimationActive={false}/>
     <Line dataKey="watch_pct" name="Watch %" stroke="var(--risk-amber)" dot={false} connectNulls={false} isAnimationActive={false}/>
    </LineChart></ResponsiveContainer>
   </div>
   <p className="text-xs">Green: Leaders · Amber: Watch</p>
   <div className="max-h-72 overflow-auto"><table className="w-full text-xs"><thead><tr><th>Session</th><th>Weekly</th><th>Monthly</th><th>Leaders</th><th>Watch</th></tr></thead>
    <tbody>{[...row.history].reverse().map(s=><tr key={s.date}><td>{sectorSessionDate(s.date)}</td><td>{state(s.weekly)}</td><td>{state(s.monthly)}</td><td>{pct(s.leaders_pct)}</td><td>{pct(s.watch_pct)}</td></tr>)}</tbody></table></div>
  </details>
 </article>;
}
export default function SectorLeadership({category,date,months}:{category:SectorTab;date?:string;months:number}) {
 const {data,isFetching,error,refetch}=useLeadership(category,date,months);
 const [sort,setSort]=useState('name');
 if(isFetching) return <p role="status" className="p-4">Preparing longer-term readings…</p>;
 if(error) return <div role="alert" className="p-4"><p>{error.message}</p><button className="sector-question" onClick={()=>refetch()}>Retry longer-term readings</button></div>;
 const rows=[...(data?.rows??[])].sort((a,b)=>sort==='leaders'?(b.current.leaders_pct??-1)-(a.current.leaders_pct??-1)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
 return <section className="p-4 space-y-4" aria-label="Longer-term leadership">
  <p className="text-sm">Three separate readings, with no combined score. Weekly/monthly MagicRS uses NIFTY 500 and completed calendar periods. Recent flow remains in Current Flow.</p>
  <p className="text-xs text-muted">{data?.start} to {data?.date}. History is reconstructed using current recorded constituents. It is not a record of when the basket was first discovered. Stage percentages use raw classifications, without scanner display limits or extra filters.</p>
  <label className="text-sm">Compare by <select className="sector-question" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Basket name</option><option value="leaders">Stage 2 Leaders share</option></select></label>
  {!rows.length && <p>No baskets are available for this selection.</p>}
  {rows.map(r=><Basket key={r.index_id} row={r}/>)}
 </section>;
}
