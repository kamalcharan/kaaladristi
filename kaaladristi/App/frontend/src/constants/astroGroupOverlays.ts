// Display-only compatibility for saved legacy selections. These are not
// selectable catalog items; publication is owned by the managed event API.
export const ASTRO_GROUP_OVERLAYS = ['Mercury','Venus','Panchak','Bayer','Gola','MajorTransit','Gandanta','Neptune'].map(name=>({id:`astro_group:${name}`,display_name:name}))
export function astroGroupPillLabel(id:string):string|null {
 return id.startsWith('astro_group:') ? `Retired · ${id.slice(12)}` : null
}
