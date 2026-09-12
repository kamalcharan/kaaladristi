import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {useAuthStore} from '@/stores/authStore';
import {useBookmarkStore} from '@/stores/bookmarkStore';
import {fetchSectorPersonal,personalConnections,type PersonalSector,type SectorMembership} from '@/services/sectorPersonal';

export default function SectorPersonalConnections({sectors,date,sourceKey,membership}:{sectors:PersonalSector[];date?:string;sourceKey?:string;membership?:SectorMembership}) {
 const user=useAuthStore(s=>s.profile?.id);
 const token=useAuthStore(s=>s.session?.access_token);
 const authLoading=useAuthStore(s=>s.isLoading);
 // Refresh after local bookmark/position changes; data remains keyed by account.
 const local=useBookmarkStore(s=>s.bookmarks);
 const revision=local.map(b=>`${b.equity_id}:${b.entry_price!=null}`).sort().join(',');
 const ids=sectors.map(s=>s.id).sort((a,b)=>a-b);
 const query=useQuery({queryKey:['sector-personal',user,ids,sourceKey,revision],enabled:!!user&&!!token,
  staleTime:30000,gcTime:0,retry:false,queryFn:()=>fetchSectorPersonal(user!,ids,membership)});
 const links=<div className="flex flex-wrap gap-2"><Link className="sector-question" to="/bookmarks?tab=watchlist">Add bookmarks</Link><Link className="sector-question" to="/bookmarks?tab=positions">Add positions</Link></div>;
 let body;
 if(authLoading) body=<p role="status">Loading your account…</p>;
 else if(!user||!token) body=<p><Link className="underline" to="/login">Sign in</Link> to connect sector readings to your bookmarks and positions.</p>;
 else if(query.isPending||query.isFetching) body=<p role="status">Checking your bookmarks and positions…</p>;
 else if(query.error) body=<><p role="alert">I couldn’t load your bookmarks, positions or their sector connections. Please retry.</p><button className="sector-question" onClick={()=>query.refetch()}>Retry personal connections</button></>;
 else if(!query.data?.bookmarks.length) body=<><p>I didn’t find any bookmarks or active positions.</p>{links}<p className="text-xs">Add stocks you follow or hold so I can connect sector readings to your personal list.</p></>;
 else {
  const matches=personalConnections(query.data,sectors);
  const cards=matches.map(({stock,kind,sectors:connected})=><article key={stock.equity_id} className="rounded-lg border border-[var(--border)] p-2 space-y-1">
   <p><strong>{kind}</strong> · <Link className="underline break-words" to={`/chart/equity/${stock.equity_id}?name=${encodeURIComponent(stock.symbol)}`}>{stock.symbol}</Link></p>
   {connected.map(s=><p key={s.id} className="text-xs"><Link className="underline break-words" to={`/sector-rotation/${s.id}${date?`?asof=${date}`:''}`}>{s.name}</Link> · {s.reading}</p>)}
  </article>);
  body=matches.length?<><p>{matches.length} of your saved stocks {matches.length===1?'is':'are'} linked to sectors in this reading.</p>{cards.slice(0,3)}{cards.length>3&&<details><summary className="sector-question cursor-pointer">Show {cards.length-3} more connections</summary><div className="space-y-2 pt-2">{cards.slice(3)}</div></details>}<p className="text-xs">A sector’s condition does not establish the stock’s own strength. Open its chart to inspect its participation.</p><Link className="underline" to="/bookmarks">Manage bookmarks and positions</Link></>:<><p>None of your saved stocks are linked to the sectors highlighted in this reading.</p><Link className="underline" to="/bookmarks">View bookmarks and positions</Link></>;
 }
 return <section className="space-y-2 border-t border-[var(--border)] pt-3 text-sm" aria-label="Connected to your stocks"><h3 className="font-medium">Connected to your stocks</h3>{body}<p className="text-xs text-muted">Your saved stocks reflect your account today. Connections use recorded basket membership, including when viewing an earlier market session.</p></section>;
}
