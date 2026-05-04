/**
 * usePlanetaryPositions
 * =====================
 * Fetches all 9 grahas' positions for a single date directly from
 * km_planetary_positions via PostgREST. Returns only what's there —
 * DristiQ has Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu,
 * Ketu (no Herschel, no Pluto).
 */

import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';

export interface PlanetaryPosition {
  planet: string;
  longitude: number | null;
  speed: number | null;
  retrograde: boolean | null;
  sign: number | null;
  sign_name: string | null;
  nakshatra: number | null;
  nakshatra_name: string | null;
  nakshatra_pada: number | null;
  combust: boolean | null;
}

const COLS = [
  'planet', 'longitude', 'speed', 'retrograde',
  'sign', 'sign_name',
  'nakshatra', 'nakshatra_name', 'nakshatra_pada',
  'combust',
].join(',');

async function fetchPositions(date: string): Promise<PlanetaryPosition[]> {
  const { data, error } = await from('km_planetary_positions')
    .select(COLS)
    .eq('date', date)
    .execute();
  if (error) throw new Error(`Planetary positions fetch failed: ${error.message}`);
  return (data ?? []) as PlanetaryPosition[];
}

export function usePlanetaryPositions(date: string | null) {
  const query = useQuery({
    queryKey: ['planetary-positions', date],
    queryFn: () => fetchPositions(date!),
    staleTime: 30 * 60 * 1000,
    enabled: !!date,
  });
  return {
    positions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
