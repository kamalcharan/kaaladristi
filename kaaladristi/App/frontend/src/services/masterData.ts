import { from } from './postgrest';
import type {
  KmPlanet, KmNakshatra, KmNakshatraLord,
  KmZodiacSign, KmZodiacLord,
  KmDayOfWeek, KmDayLord,
  KmSector, KmSectorLord,
  KmIndexMaster, KmIndexComposition,
  KmIndexSymbol, KmIndexConstituent,
} from '@/types';

// ── Generic fetch helper ──
async function fetchTable<T>(table: string): Promise<T[]> {
  const { data, error } = await from(table).select('*').execute();
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

// ── Indices (deprecated — use fetchIndexSymbols instead) ──
export const fetchIndices = () => fetchTable<KmIndexMaster>('km_index_master');

export async function fetchIndexComposition(indexId: number): Promise<KmIndexComposition[]> {
  const { data, error } = await from('km_index_composition')
    .select('*')
    .eq('index_id', indexId)
    .execute();
  if (error) throw new Error(`[km_index_composition] ${error.message}`);
  return (data ?? []) as KmIndexComposition[];
}

// ── Indices (production — km_index_symbols + km_index_constituents) ──

export const fetchIndexSymbols = () => fetchTable<KmIndexSymbol>('km_index_symbols');

export async function fetchIndexConstituents(indexId: number): Promise<KmIndexConstituent[]> {
  const { data, error } = await from('km_index_constituents')
    .select('*')
    .eq('index_id', indexId)
    .execute();
  if (error) throw new Error(`[km_index_constituents] ${error.message}`);
  return (data ?? []) as KmIndexConstituent[];
}

/** Fetch constituents with equity details (symbol, company_name, industry) */
export async function fetchIndexBreakdown(indexId: number) {
  const { data, error } = await from('km_index_constituents')
    .select('id,index_id,equity_id,sector,weight_pct,snapshot_date,km_equity_symbols(symbol,company_name,industry,is_fno)')
    .eq('index_id', indexId)
    .execute();
  if (error) throw new Error(`[km_index_constituents] ${error.message}`);
  return (data ?? []) as Array<KmIndexConstituent & {
    km_equity_symbols: { symbol: string; company_name: string | null; industry: string | null; is_fno: boolean };
  }>;
}

// ── Derived: sector breakdown for an index ──

/** @deprecated Use fetchConstituentSectorBreakdown instead */
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

export async function fetchConstituentSectorBreakdown(indexId: number) {
  const constituents = await fetchIndexConstituents(indexId);
  const sectorMap = new Map<string, number>();

  for (const row of constituents) {
    const sector = row.sector || 'Unknown';
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + (row.weight_pct || 0));
  }

  return Array.from(sectorMap.entries())
    .map(([sector, totalWeight]) => ({ sector, totalWeight }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}
