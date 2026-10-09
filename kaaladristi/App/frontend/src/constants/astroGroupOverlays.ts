// Planet pill labels plus compatibility for retired selections.
// Published membership comes from the managed event API.
export const ASTRO_GROUP_OVERLAYS = ['Mercury','Venus','Panchak','Bayer','Gola','MajorTransit','Gandanta','Neptune'].map(name=>({id:`astro_group:${name}`,display_name:name}))
export function astroGroupPillLabel(id:string):string|null {
 if(id==='astro_group:Mercury'||id==='astro_group:Venus')return id.slice(12)
 return id.startsWith('astro_group:') ? `Retired · ${id.slice(12)}` : null
}
