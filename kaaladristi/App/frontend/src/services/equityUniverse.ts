import { from } from '@/services/postgrest';

export interface EquityRow {
  id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string;
  isin: string | null;
}

/**
 * Custom-index equity universe: all active NSE equities plus BSE-only
 * additions — a BSE scrip is included only when its ISIN has no active NSE
 * listing (NSE is the priority exchange). Mirrors the backend discover
 * endpoint's universe rule.
 */
export async function fetchEquityUniverse(): Promise<EquityRow[]> {
  const { data, error } = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry,exchange,isin')
    .is('is_active', 'true')
    .order('symbol', { ascending: true })
    .limit(8000)
    .execute();
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EquityRow[];
  const nseIsins = new Set(
    rows.filter((r) => r.exchange === 'NSE' && r.isin).map((r) => r.isin as string),
  );
  return rows.filter(
    (r) => r.exchange === 'NSE' || (r.isin !== null && !nseIsins.has(r.isin)),
  );
}
