import { from } from './postgrest';
import type { AstroSignal, AstroTransit } from '@/types';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

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

/** Last N net_score values up to and including toDate — oldest first */
export async function fetchRecentAstroScores(toDate: string, n: number): Promise<number[]> {
  const { data, error } = await from('km_astro_daily_signal')
    .select('trade_date,net_score')
    .lte('trade_date', toDate)
    .order('trade_date', { ascending: false })
    .limit(n)
    .execute();
  if (error) throw new Error(`[km_astro_daily_signal scores] ${error.message}`);
  const rows = (data ?? []) as { trade_date: string; net_score: number }[];
  return rows.reverse().map(r => r.net_score);
}
