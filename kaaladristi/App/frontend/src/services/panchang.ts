import { from } from './postgrest';
import type { DailyPanchang, MarketBreadthDay, BreadthRocDay, ConfluenceData, ConfluenceHeatmap, ConfluenceTimelineEntry } from '@/types';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

export async function fetchPanchang(date: string): Promise<DailyPanchang | null> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/daily?date=${encodeURIComponent(date)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`[panchang] HTTP ${res.status}`);
  return res.json() as Promise<DailyPanchang>;
}

export async function fetchMarketBreadth(days = 66): Promise<MarketBreadthDay[]> {
  const { data, error } = await from('km_market_breadth')
    .select('*')
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (error) throw new Error(`[km_market_breadth] ${error.message}`);
  return ((data ?? []) as MarketBreadthDay[]).reverse();
}

export async function fetchBreadthRoc(days = 66): Promise<BreadthRocDay[]> {
  const { data, error } = await from('km_breadth_roc')
    .select('*')
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (error) throw new Error(`[km_breadth_roc] ${error.message}`);
  return ((data ?? []) as BreadthRocDay[]).reverse();
}

export async function fetchConfluenceHeatmap(date: string): Promise<ConfluenceHeatmap> {
  const res = await fetch(`${PIPELINE_API}/api/confluence/heatmap?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(`[confluence/heatmap] HTTP ${res.status}`);
  return res.json() as Promise<ConfluenceHeatmap>;
}

export async function fetchConfluenceHistorical(): Promise<ConfluenceData> {
  const res = await fetch(`${PIPELINE_API}/api/confluence/historical`);
  if (!res.ok) throw new Error(`[confluence] HTTP ${res.status}`);
  return res.json() as Promise<ConfluenceData>;
}

export async function fetchConfluenceTimeline(days: number): Promise<ConfluenceTimelineEntry[]> {
  const res = await fetch(`${PIPELINE_API}/api/confluence/timeline?days=${days}`);
  if (!res.ok) throw new Error(`[confluence/timeline] HTTP ${res.status}`);
  return res.json() as Promise<ConfluenceTimelineEntry[]>;
}
