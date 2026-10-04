import EventWorkspace from '@/components/astro/EventWorkspace'
import type { DeepDiveItem } from './DeepDivePanel'
export default function CatalogAstroSection(_props:{onSelect?:(item:DeepDiveItem)=>void;compact?:boolean}){return <EventWorkspace mode="catalog"/>}
