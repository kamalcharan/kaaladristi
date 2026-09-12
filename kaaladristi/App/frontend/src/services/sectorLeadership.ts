import { useQuery } from '@tanstack/react-query';
import type { MagicRsDataPoint } from '@/components/domain/VisualPulse/MagicRsSubchart';
import type { SectorTab } from '@/services/sectorRotation';
export interface LeadershipSample {
 date:string; weekly:boolean|null; monthly:boolean|null; weekly_date:string|null; monthly_date:string|null;
 eligible:number; total:number; leaders:number|null; watch:number|null; leaders_pct:number|null; watch_pct:number|null;
}
export interface LeadershipRow {
 index_id:number; name:string; category:string; current:LeadershipSample; history:LeadershipSample[];
 status:'Running broadly'|'Building'|'Cooling'|'Limited coverage'|'Not aligned'|'Unavailable';
 alignment_history:{date:string;weekly:boolean|null;monthly:boolean|null}[];
 charts:{weekly:MagicRsDataPoint[];monthly:MagicRsDataPoint[];weekly_method:'long'|'short'};
 flow?:{state:string;score_5d:number|null;score_22d:number|null};
 aligned_samples:number; known_samples:number; aligned_streak:number;
}
export interface LeadershipSnapshot { membership?:Record<string,number[]>; snapshot:string; date:string; start:string; months:number; rows:LeadershipRow[]; counts:Record<string,number> }
export async function askLeadership(body:object) {
 const api=import.meta.env.VITE_PIPELINE_API_URL?.trim() || '';
 const res=await fetch(`${api}/api/vani/ask`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!res.ok) throw new Error('Longer-term readings could not be loaded. Please retry.');
 const data=await res.json();
 if(data.error) throw new Error(data.error);
 return data;
}
export function useLeadership(category:SectorTab,date:string|undefined,months:number) {
 return useQuery<LeadershipSnapshot>({queryKey:['sector-leadership',category,date,months],enabled:!!date,
  staleTime:60000,retry:false,queryFn:()=>askLeadership({intent_id:'sector.leadership.context',sector_category:category,date,leadership_months:months})});
}
