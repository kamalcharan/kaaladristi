import { from, rpc } from './postgrest';
import type { CommodityCatalogItem } from '@/types';

export async function fetchCommodityCatalog(): Promise<CommodityCatalogItem[]> {
  const { data, error } = await from('mv_commodity_catalog')
    .select('*')
    .order('exchange', { ascending: true })
    .order('symbol', { ascending: true })
    .execute();

  if (error) throw new Error(`Failed to fetch commodity catalog: ${error.message}`);
  return (data ?? []) as CommodityCatalogItem[];
}

// Commodities don't have is_active yet — placeholder for future use
export async function refreshCommodityCatalog(): Promise<void> {
  await rpc('refresh_commodity_catalog');
}
