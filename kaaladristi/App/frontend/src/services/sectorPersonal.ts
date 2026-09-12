import { fetchBookmarks, type BookmarkRow } from './bookmarks';
import { from } from './postgrest';

export interface PersonalSector { id:number; name:string; reading:string }
export type SectorMembership = Record<string,number[]>;
export interface PersonalSectorData { bookmarks:BookmarkRow[]; membership:SectorMembership }

/** Uses the authenticated bookmark API. No personal data is sent to VaNi or its shared cache. */
export async function fetchSectorPersonal(userId:string, sectorIds:number[], recorded?:SectorMembership):Promise<PersonalSectorData> {
 const bookmarks=await fetchBookmarks(userId);
 if(!Array.isArray(bookmarks)) throw new Error('Invalid bookmark response');
 if(!bookmarks.length||!sectorIds.length) return {bookmarks,membership:{}};
 if(recorded) return {bookmarks,membership:recorded};
 const ids=[...new Set(bookmarks.map(b=>b.equity_id))];
 const sectors=[...new Set(sectorIds)];
 const membership:SectorMembership={};
 for(let i=0;i<ids.length;i+=100) for(let j=0;j<sectors.length;j+=100) {
  let finished=false;
  for(let offset=0;offset<100000;offset+=500) {
   const result=await from('km_index_constituents').select('index_id,equity_id')
    .in('equity_id',ids.slice(i,i+100)).in('index_id',sectors.slice(j,j+100))
    .order('index_id',{ascending:true}).order('equity_id',{ascending:true})
    .range(offset,offset+499).execute();
   if(result.error) throw new Error('Sector membership could not be loaded');
   const rows=(result.data??[]) as {index_id:number;equity_id:number}[];
   for(const r of rows) (membership[r.index_id]??=[]).push(r.equity_id);
   if(rows.length<500){finished=true;break;}
  }
  if(!finished) throw new Error('Sector membership read was incomplete');
 }
 return {bookmarks,membership};
}

export function personalConnections(data:PersonalSectorData,sectors:PersonalSector[]) {
 const seen=new Set<number>();
 return data.bookmarks.flatMap(stock=>{
  if(seen.has(stock.equity_id)) return [];
  seen.add(stock.equity_id);
  const links=[...new Map(sectors.filter(s=>data.membership[s.id]?.includes(stock.equity_id)).map(s=>[s.id,s])).values()];
  return links.length?[{stock,kind:stock.entry_price!=null?'Position':'Bookmark',sectors:links}]:[];
 }).sort((a,b)=>Number(b.kind==='Position')-Number(a.kind==='Position')||a.stock.symbol.localeCompare(b.stock.symbol));
}
