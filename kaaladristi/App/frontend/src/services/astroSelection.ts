import type { ChartOverlay } from '@/types/framework';
import { LEGACY_ASTRO_FAMILIES } from './astroEvents';
const groups: Record<string, string[]> = { Mercury: ['mercury-motion', 'mercury-sign', 'mercury-visibility', 'mercury-venus-conjunction'], Venus: ['venus-motion', 'venus-sign', 'venus-visibility', 'mercury-venus-conjunction'] };
export function migrateAstroSelections(overlays: ChartOverlay[]): ChartOverlay[] {
    const result: ChartOverlay[] = [];
    const seen = new Set<string>();
    for (const o of overlays) {
        if (o.type !== 'astro_zone' || o.config?.retired) {
            result.push(o);
            continue;
        }
        const id = o.catalog_item_id;
        const families = id.startsWith('astro_event:') ? [id.slice(12)] : id.startsWith('astro_group:') ? groups[id.slice(12)] : [LEGACY_ASTRO_FAMILIES[id.replace('astro_rule:', '')]].filter(Boolean);
        if (!families?.length) {
            result.push({ ...o, visible: false, label: `Retired · ${o.label ?? id}`, config: { ...o.config, retired: true } });
            continue;
        }
        for (const f of families) {
            const key = `astro_event:${f}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            result.push(id === key ? o : { ...o, catalog_item_id: key, label: f.replaceAll('-', ' '), config: { ...o.config, migrated_from: id } });
        }
    }
    return result;
}
