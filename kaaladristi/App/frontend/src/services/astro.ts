import { from } from './postgrest';
import type { AstroSignal } from '@/types';

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
