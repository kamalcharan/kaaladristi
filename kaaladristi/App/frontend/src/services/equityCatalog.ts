import { from, rpc } from './postgrest';
import type { EquityCatalogItem, EquityExchangeFilter } from '@/types';

export interface EquityCatalogResult {
  rows: EquityCatalogItem[];
  total: number;
}

export interface EquityCatalogParams {
  exchange: EquityExchangeFilter;
  search: string;
  page: number;
  pageSize: number;
}

export async function fetchEquityCatalog(params: EquityCatalogParams): Promise<EquityCatalogResult> {
  const { exchange, search, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  let q = from('mv_equity_catalog')
    .select('*')
    .withCount();

  if (exchange !== 'ALL') {
    q = q.eq('exchange', exchange);
  }

  const trimmed = search.trim();
  if (trimmed) {
    q = q.ilike('symbol', `*${trimmed}*`);
  }

  const { data, error, count } = await q
    .order('exchange', { ascending: true })
    .order('symbol', { ascending: true })
    .range(offset, offset + pageSize - 1)
    .execute();

  if (error) throw new Error(`Failed to fetch equity catalog: ${error.message}`);

  return {
    rows: (data ?? []) as EquityCatalogItem[],
    total: count ?? 0,
  };
}

export async function toggleEquityActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await from('km_equity_symbols')
    .eq('id', id)
    .update({ is_active: isActive } as Record<string, unknown>)
    .execute();

  if (error) throw new Error(`Failed to update equity: ${error.message}`);

  await rpc('refresh_equity_catalog');
}
