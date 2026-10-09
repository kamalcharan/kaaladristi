import { useQuery } from '@tanstack/react-query';
import { astroToday, fetchAstroEvents } from '@/services/astroEvents';
import { useAstroHorizon } from './useAstroHorizon';
export interface ActiveRule {
    id: number;
    rule_code: string;
    display_name: string;
    base_bias: string | null;
    probability_label: string | null;
    start_date: string | null;
    end_date: string | null;
    days_remaining?: number | null;
    days_until?: number | null;
    confidence_score?: number | null;
    avg_return_matched?: number | null;
    total_occurrences?: number | null;
}
export interface ActiveRuleToday {
    tag: string;
    date: string;
    active_now: ActiveRule[];
    upcoming: ActiveRule[];
}
/** Compatibility shape for saved group pills; only published canonical events. */
export function useActiveRuleToday(tag: string | null) {
    const today = astroToday(), horizon = useAstroHorizon();
    return useQuery({ queryKey: ['astro', 'active', tag, today, horizon.cutoffIso], enabled: !!tag, staleTime: 60000, queryFn: async (): Promise<ActiveRuleToday> => {
            const events = (await fetchAstroEvents(today, horizon.cutoffIso)).filter(e => e.planets.includes(tag!) || e.family_id === tag);
            const map = (e: typeof events[number]): ActiveRule => ({ id: e.rule_id, rule_code: `astro_event:${e.family_id}`, display_name: e.display_name, base_bias: null, probability_label: null, start_date: e.start_date, end_date: e.end_date });
            return { tag: tag!, date: today, active_now: events.filter(e => e.start_date <= today && e.end_date >= today).map(map), upcoming: events.filter(e => e.start_date > today).map(map) };
        } });
}
