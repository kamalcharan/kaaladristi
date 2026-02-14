import { supabase } from './supabase';
import type {
  KmPlanet, KmNakshatra, KmNakshatraLord,
  KmZodiacSign, KmZodiacLord,
  KmDayOfWeek, KmDayLord,
  KmSector, KmSectorLord,
  KmIndexMaster, KmIndexComposition,
} from '@/types';

// ── Generic fetch helper ──
async function fetchTable<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`[${table}] ${error.message}`);
  return (data ?? []) as T[];
}

// ── Planets ──
export const fetchPlanets = () => fetchTable<KmPlanet>('km_planets');

// ── Nakshatras ──
export const fetchNakshatras = () => fetchTable<KmNakshatra>('km_nakshatras');
export const fetchNakshatraLords = () => fetchTable<KmNakshatraLord>('km_nakshatra_lords');

// ── Zodiac ──
export const fetchZodiacSigns = () => fetchTable<KmZodiacSign>('km_zodiac_signs');
export const fetchZodiacLords = () => fetchTable<KmZodiacLord>('km_zodiac_lords');

// ── Days ──
export const fetchDaysOfWeek = () => fetchTable<KmDayOfWeek>('km_days_of_week');
export const fetchDayLords = () => fetchTable<KmDayLord>('km_day_lords');

// ── Sectors ──
export const fetchSectors = () => fetchTable<KmSector>('km_sectors');
export const fetchSectorLords = () => fetchTable<KmSectorLord>('km_sector_lords');

// ── Indices ──
export const fetchIndices = () => fetchTable<KmIndexMaster>('km_index_master');

export async function fetchIndexComposition(indexId: number): Promise<KmIndexComposition[]> {
  const { data, error } = await supabase
    .from('km_index_composition')
    .select('*')
    .eq('index_id', indexId);
  if (error) throw new Error(`[km_index_composition] ${error.message}`);
  return (data ?? []) as KmIndexComposition[];
}

// ── Derived: sector breakdown for an index ──
export async function fetchIndexSectorBreakdown(indexId: number) {
  const composition = await fetchIndexComposition(indexId);
  const sectorMap = new Map<string, number>();

  for (const row of composition) {
    const sector = row.sector || 'Unknown';
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + (row.weight_pct || 0));
  }

  return Array.from(sectorMap.entries())
    .map(([sector, totalWeight]) => ({ sector, totalWeight }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}
