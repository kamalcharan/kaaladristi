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
/** Row cap for a full active-universe fetch.
 *
 *  These all used a bare 8,000, sized when the universe was around 7,000
 *  symbols. The 2026-08-03 expansion took it to 10,412 active rows, so 8,000
 *  silently dropped 2,412 of them — and where no ORDER BY was given, WHICH
 *  2,412 was arbitrary and could shift after any UPDATE or VACUUM.
 *
 *  The visible symptom was a dual-listed stock resolving to its BSE row. The
 *  ISIN dedup prefers NSE, but it can only prefer among rows that arrived, and
 *  IndusInd's NSE row was not in the payload — so search landed on
 *  /chart/equity/5906 (BSE 532187), whose index_names is empty, while the NSE
 *  row carries all 18 memberships.
 *
 *  Sized with real headroom rather than to today's count, so the next universe
 *  expansion does not reintroduce this quietly. */
export const ACTIVE_UNIVERSE_CAP = 25000;

export async function fetchEquityUniverse(): Promise<EquityRow[]> {
  const { data, error } = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry,exchange,isin')
    .is('is_active', 'true')
    .order('symbol', { ascending: true })
    .limit(ACTIVE_UNIVERSE_CAP)
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
