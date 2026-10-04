import { api } from './apiClient';
import type { CatalogItem } from '@/constants/catalogItems';
export interface AstroFamily {
    id: string;
    rule_id: number;
    planets: string[];
    name: string;
    description: string;
    catalog_visible: boolean;
    is_active: boolean;
    occurrences: number;
    first_date: string | null;
    last_date: string | null;
    previous_date: string | null;
    next_date: string | null;
    ongoing: boolean;
}
export interface AstroOccurrence {
    family_id: string;
    rule_id: number;
    family_name: string;
    planets: string[];
    event_key: string;
    event_type: string;
    display_name: string;
    shape: 'point' | 'period';
    start_date: string;
    end_date: string;
    start_ts: string | null;
    end_ts: string | null;
    precision: string;
    source: string;
    calculation_method: string | null;
    bracket_start_date: string | null;
    bracket_end_date: string | null;
    details: Record<string, unknown>;
}
export function astroToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function astroDate(s: string | null) { return s ? new Date(s + 'T12:00:00+05:30').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'Not recorded'; }
export function boundary(e: AstroOccurrence, side: 'start' | 'end') {
    const ts = e[`${side}_ts`];
    return ts ? new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' : astroDate(e[`${side}_date`]);
}
async function get<T>(url: string): Promise<T> { const r = await api.fetch(url); if (!r.ok)
    throw new Error('Event data unavailable. Verify deployment and migration 237.'); return r.json(); }
export const fetchAstroFamilies = (admin = false) => get<AstroFamily[]>(`/api/${admin ? 'admin/' : ''}astro/families`);
export const fetchAstroEvents = (start: string, end: string, admin = false) => get<AstroOccurrence[]>(`/api/${admin ? 'admin/' : ''}astro/events?from_date=${start}&to_date=${end}`);
export async function publishAstroFamily(id: string, visible: boolean) { const r = await api.fetch(`/api/admin/astro/families/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog_visible: visible }) }); if (!r.ok)
    throw new Error('Publication failed. Your saved setting has not changed.'); }
export function planetCatalogItem(planet: 'Mercury'|'Venus'): CatalogItem {
 return {id:`astro_group:${planet}`,display_name:planet,description:`All published ${planet} events, including shared conjunctions.`,block_type:'astro_rule',placement:'chart_overlay',overlay_type:'astro_zone',data_source:'rule_engine',applicable_to:['index'],tier_required:'free',color:planet==='Mercury'?'#60a5fa':'#e879f9'};
}
// Explicit identity migration. Angular Venus combustion is deliberately NOT
// translated into Tara Asta; unresolved/unsupported items remain retired.
export const LEGACY_ASTRO_FAMILIES: Record<string, string> = {
    'TRN-MER-MAN-TRN': 'mercury-sign', 'TRN-MER-RIS-W-BUL': 'mercury-motion', 'TR-MER-RET': 'mercury-motion', 'TR-MER-CMB-E-BEA': 'mercury-visibility',
    'BAY-R03-VEN-RET': 'venus-motion', 'TRN-VEN-RIS-W-BUL': 'venus-motion', 'TRN-VEN-RIS-E-BUL': 'venus-motion',
    'CON-MER-VEN-BEA': 'mercury-venus-conjunction', 'CON-VEN-MER-BEA': 'mercury-venus-conjunction', 'CON-MER-VEN-CD-BEA': 'mercury-venus-conjunction'
};
