import { from } from './postgrest';
import type { AstroSignal, AstroTransit } from '@/types';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101');

export async function fetchAstroTransits(from_date: string, to_date: string): Promise<AstroTransit[]> {
  const params = new URLSearchParams({ from_date, to_date });
  const res = await fetch(`${PIPELINE_API}/api/astro/transits?${params}`);
  if (!res.ok) throw new Error(`[astro/transits] HTTP ${res.status}`);
  return res.json() as Promise<AstroTransit[]>;
}

export async function fetchAstroSignal(date: string): Promise<AstroSignal | null> {
  const { data, error } = await from('km_astro_daily_signal')
    .select('*')
    .eq('trade_date', date)
    .maybeSingle()
    .execute();
  if (error) throw new Error(`[km_astro_daily_signal] ${error.message}`);
  return data as AstroSignal | null;
}

export async function fetchAstroWeek(fromDate: string, toDate: string): Promise<AstroSignal[]> {
  const { data, error } = await from('km_astro_daily_signal')
    .select('*')
    .gte('trade_date', fromDate)
    .lt('trade_date', toDate)
    .order('trade_date', { ascending: true })
    .execute();
  if (error) throw new Error(`[km_astro_daily_signal] ${error.message}`);
  return (data ?? []) as AstroSignal[];
}
