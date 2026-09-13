import {useLeadership} from '@/services/sectorLeadership';
import type {SectorTab} from '@/services/sectorRotation';
import {horizonStory} from '@/lib/sectorHorizonStory';
import {VaNiConsulting} from './VaNiBrand';
export default function SectorHorizonComparison({indexId,category,date,months,depth,greed}:{indexId:number;category:SectorTab;date?:string;months:number;depth:string;greed?:boolean}) {
 const evidence=useLeadership(category,date,months);
 const row=evidence.data?.rows.find(r=>r.index_id===indexId&&r.current.date===date);
 if(evidence.isFetching) return <VaNiConsulting/>;
 if(evidence.error) return <div role="alert"><p>{evidence.error.message}</p><button className="sector-question" onClick={()=>evidence.refetch()}>Retry horizon comparison</button></div>;
 if(!row) return <p>No matching longer-term evidence is available for this index and selected session. Current flow alone cannot establish longer-term strength.</p>;
 return <section aria-label="Horizon comparison" className="space-y-3"><p className="text-sm leading-7 whitespace-pre-wrap">{horizonStory(row,depth)}</p>
  {greed&&<p className="vani-evidence-caution text-xs">Breadth is in its Greed zone. That caution remains relevant even when the two horizons agree; agreement is not an entry signal.</p>}
  <details><summary className="text-sm cursor-pointer">Horizon evidence</summary><p className="text-xs leading-6">Selected session: {date}. Weekly close: {row.current.weekly_date??'unavailable'}; monthly close: {row.current.monthly_date??'unavailable'}. History: {months} months. Stock coverage: {row.current.eligible} of {row.current.total}.</p></details>
 </section>;
}
