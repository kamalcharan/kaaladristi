import { fetchAstroEvents, fetchAstroFamilies, astroToday, LEGACY_ASTRO_FAMILIES } from './astroEvents';
export type PanchakTier = 'base' | 'yoga' | 'vara';
export interface AstroBand {
    eventKey?: string;
    ruleCode: string;
    ruleId: number;
    displayName: string;
    from: string;
    to: string;
    matched: boolean | null;
    baseBias: string | null;
    color: string;
    opacity: number;
    isPanchak: boolean;
    panchakTier?: PanchakTier;
    groupTag: string;
    isPoint: boolean;
    startTs?: string | null;
    endTs?: string | null;
    precision?: string;
}
export async function fetchAstroBands(colors: Map<string, string>, opacities: Map<string, number>, since: string, until?: string): Promise<AstroBand[]> {
    if (!colors.size)
        return [];
    const end = until ?? `${Number(astroToday().slice(0, 4)) + 1}-12-31`;
    const [families, events] = await Promise.all([fetchAstroFamilies(), fetchAstroEvents(since, end)]);
    const selected = new Map<string, string>();
    for (const key of colors.keys()) {
        if (key.startsWith('astro_group:')) {
            const planet = key.slice(12);
            for (const f of families)
                if (f.planets.includes(planet))
                    selected.set(f.id, key);
        }
        else {
            const id = key.startsWith('astro_event:') ? key.slice(12) : LEGACY_ASTRO_FAMILIES[key];
            if (id)
                selected.set(id, key);
        }
    }
    return events.filter(e => selected.has(e.family_id)).map(e => {
        const key = selected.get(e.family_id)!;
        return { eventKey: e.event_key, ruleCode: `astro_event:${e.family_id}`, ruleId: e.rule_id,
            displayName: e.display_name + (e.details?.contra_directional === true ? ' · Mercury direct / Venus retrograde' : '') + (e.details?.sign ? ` · ${e.details.sign}` : '') + (e.bracket_start_date ? ` · ${e.bracket_start_date}–${e.bracket_end_date} (bracket)` : ''),
            from: e.start_date, to: e.end_date, matched: null, baseBias: null, color: colors.get(key) ?? '#c9a84c',
            opacity: opacities.get(key) ?? 0.1, isPanchak: false, groupTag: e.event_type, isPoint: e.shape === 'point',
            startTs: e.start_ts, endTs: e.end_ts, precision: e.precision };
    });
}
