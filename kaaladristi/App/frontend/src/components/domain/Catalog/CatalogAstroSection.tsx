import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useFrameworkStore } from '@/stores/frameworkStore';
import { fetchAstroFamilies, fetchAstroEvents, planetCatalogItem, astroToday, astroDate } from '@/services/astroEvents';
import { useAstroHorizon } from '@/hooks/useAstroHorizon';
import type { DeepDiveItem } from './DeepDivePanel';
import '@/components/astro/eventWorkspace.css';
export default function CatalogAstroSection(_props:{onSelect?:(item:DeepDiveItem)=>void;compact?:boolean}) {
 const fw=useFrameworkStore(),profile=useAuthStore(s=>s.profile),horizon=useAstroHorizon(),today=astroToday();
 useEffect(()=>{if(!fw.framework&&profile?.id)fw.loadFramework(profile.id)},[fw.framework,profile?.id,fw.loadFramework]);
 const families=useQuery({queryKey:['astro','families',false],queryFn:()=>fetchAstroFamilies()});
 const events=useQuery({queryKey:['astro','catalog-upcoming',today,horizon.cutoffIso],queryFn:()=>fetchAstroEvents(today,horizon.cutoffIso)});
 return <section className="ae-workspace"><h1>Choose your planetary overlays.</h1><p>One selection includes every published event for that planet. Shared conjunctions appear once on the chart.</p>
 {families.isPending&&<p role="status">Loading planets…</p>}
 {families.isError&&<p role="alert">Unable to load planets. <button onClick={()=>families.refetch()}>Retry</button></p>}
 <div className="ae-planet-cards">{(['Mercury','Venus'] as const).map(planet=>{
  const included=(families.data??[]).filter(f=>f.planets.includes(planet));if(!included.length)return null;
  const existing=fw.framework?.chart_overlays.find(o=>o.catalog_item_id===`astro_group:${planet}`);
  const active=existing?.visible===true;
  const upcoming=(events.data??[]).filter(e=>e.planets.includes(planet)&&e.start_date>=today&&e.shape==='point').slice(0,3);
  return <article className="ae-card ae-planet-card" key={planet}><h2>{planet}<button className="ae-switch" role="switch" aria-label={`${planet} chart overlay`} aria-checked={active} disabled={!fw.framework} onClick={()=>existing?fw.toggleOverlayVisibility(`astro_group:${planet}`):fw.addOverlay(planetCatalogItem(planet))}><span className="ae-switch-thumb" aria-hidden="true"/></button></h2><p>{included.map(f=>f.name).join(' · ')}</p>
  <small>{active?'Added to your index charts':'Add to your index charts'}</small><h3>Upcoming dates</h3>
  {events.isPending?<p role="status">Loading dates…</p>:events.isError?<p role="alert">Dates unavailable. <button onClick={()=>events.refetch()}>Retry</button></p>:upcoming.length?<ul>{upcoming.map(e=><li key={e.event_key}>{e.display_name} · {e.bracket_start_date?`${astroDate(e.bracket_start_date)} – ${astroDate(e.bracket_end_date)} (bracket)`:astroDate(e.start_date)}</li>)}</ul>:<p>No upcoming point events within your calendar horizon.</p>}
  <Link to={`/almanac?family=${included[0].id}`}>View calendar and event details →</Link></article>
 })}</div>{!families.isPending&&!families.isError&&!families.data?.length&&<p>No planetary events are currently published.</p>}</section>
}
