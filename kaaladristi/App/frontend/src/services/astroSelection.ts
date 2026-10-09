import type { ChartOverlay } from '@/types/framework';
import { LEGACY_ASTRO_FAMILIES } from './astroEvents';
/** Saved family selections become one planet selection, including conjunctions. */
export function migrateAstroSelections(overlays:ChartOverlay[]):ChartOverlay[]{
 const result:ChartOverlay[]=[];
 const grouped=new Map<string,ChartOverlay>();
 for(const o of overlays){
  if(o.type!=='astro_zone'||o.config?.retired){result.push(o);continue;}
  const id=o.catalog_item_id;
  const family=id.startsWith('astro_event:')?id.slice(12):LEGACY_ASTRO_FAMILIES[id.replace('astro_rule:','')];
  const planet=id==='astro_group:Mercury'||id==='astro_group:Venus'?id.slice(12):family?.startsWith('mercury-')?'Mercury':family?.startsWith('venus-')?'Venus':null;
  if(!planet){result.push({...o,visible:false,label:`Retired · ${o.label??id}`,config:{...o.config,retired:true}});continue;}
  const key=`astro_group:${planet}`,existing=grouped.get(key);
  if(existing){existing.visible=existing.visible||o.visible;continue;}
  const next={...o,catalog_item_id:key,label:planet,...(id===key?{}:{config:{...o.config,migrated_from:id}})};
  grouped.set(key,next);result.push(next);
 }
 return result;
}
