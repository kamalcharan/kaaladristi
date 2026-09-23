/**
 * Filings — reader over `km_corporate_events` (migration 212).
 *
 * Server-side everything. 31,294 rows on 2026-09-23 and growing several times
 * a day, so this is a paged PostgREST read with a total count; it is never a
 * fetch-the-table-and-filter-in-the-browser page.
 *
 * ⚠ `day_0_trade_date` is the session the market could ACT on the filing, and
 * it is what the page sorts and filters by. `disseminated_at` is the exchange
 * timestamp and is shown as the TIME on the row — the two are different facts
 * and both matter: OPTIEMUS's three filings on its +20% day were disseminated
 * at 12:26 / 12:32 / 12:38 IST, mid-session, which is the whole explanation of
 * that bar.
 */

import { from } from './postgrest';
import {
  descsForGroups, HIGH_PRIORITY_DESCS, FILING_GROUPS,
} from '@/constants/filingCategories';

export type FilingTab = 'all' | 'priority' | 'call' | 'results';
export type FilingSortKey = 'date' | 'company' | 'category';

export interface FilingRow {
  id: number;
  equityId: number | null;
  isin: string | null;
  companyName: string;
  descRaw: string;
  disseminatedAt: string | null;
  day0: string | null;
  isResult: boolean;
}

export interface FilingsQuery {
  search?: string;
  fromDate?: string;
  toDate?: string;
  groupIds?: string[];
  tab?: FilingTab;
  sort?: FilingSortKey;
  ascending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface FilingsResult {
  rows: FilingRow[];
  /** Total matching the filters, from PostgREST's Content-Range. */
  total: number;
  page: number;
  pageSize: number;
  /** True when the request failed. An error must never render as "no filings". */
  failed: boolean;
}

const COLS = 'id,equity_id,isin,company_name,desc_raw,disseminated_at,day_0_trade_date,is_result_announcement';

const SORT_COLUMN: Record<FilingSortKey, string> = {
  date: 'day_0_trade_date',
  company: 'company_name',
  category: 'desc_raw',
};

export const FILINGS_PAGE_SIZE = 50;

export async function fetchFilings(q: FilingsQuery = {}): Promise<FilingsResult> {
  const page = Math.max(0, q.page ?? 0);
  const pageSize = q.pageSize ?? FILINGS_PAGE_SIZE;
  const tab = q.tab ?? 'all';
  const sort = q.sort ?? 'date';
  const ascending = q.ascending ?? false;

  let b = from('km_corporate_events').select(COLS).withCount();

  // ── Tab ────────────────────────────────────────────────────────────────
  // The tabs are mutually exclusive row filters, not a second category axis.
  if (tab === 'priority') {
    b = b.in('desc_raw', HIGH_PRIORITY_DESCS);
  } else if (tab === 'results') {
    b = b.is('is_result_announcement', 'true');
  } else if (tab === 'call') {
    b = b.in('desc_raw', descsForGroups(['call']));
  } else if (q.groupIds && q.groupIds.length) {
    // Category chips apply on the All tab only — on a filtered tab they would
    // silently intersect and show an empty page the user cannot explain.
    //
    // ⚠ Send the SHORTER side. All 117 desc_raw values inline are ~3.5KB raw
    // and ~7KB URL-encoded, which sits on nginx's 8KB header limit — and the
    // DEFAULT state (everything except Administrative) is 104 of them. The
    // complement is 13 values, ~1KB. Measured 2026-09-23.
    const wanted = new Set(q.groupIds);
    const excludedIds = FILING_GROUPS.map((g) => g.id).filter((id) => !wanted.has(id));
    if (excludedIds.length === 0) {
      // Every group selected — no category filter at all.
    } else {
      const include = descsForGroups(q.groupIds);
      const exclude = descsForGroups(excludedIds);
      if (exclude.length && exclude.length < include.length) b = b.notIn('desc_raw', exclude);
      else if (include.length) b = b.in('desc_raw', include);
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────
  // Search is company name OR symbol-ish text. The QueryBuilder has no .or(),
  // so this matches company_name only — the field users actually type.
  const search = q.search?.trim();
  if (search) b = b.ilike('company_name', `*${search}*`);
  if (q.fromDate) b = b.gte('day_0_trade_date', q.fromDate);
  if (q.toDate) b = b.lte('day_0_trade_date', q.toDate);

  // ── Sort + page ────────────────────────────────────────────────────────
  // Secondary sort on id keeps paging stable: day_0_trade_date is shared by
  // hundreds of rows, and without a tiebreaker PostgREST may return the same
  // row on two pages and drop another entirely.
  b = b.order(SORT_COLUMN[sort], { ascending }).order('id', { ascending: false });
  b = b.range(page * pageSize, page * pageSize + pageSize - 1);

  const res = await b.execute();

  if (res.error || !res.data) {
    return { rows: [], total: 0, page, pageSize, failed: true };
  }

  const rows: FilingRow[] = (res.data as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    equityId: r.equity_id == null ? null : Number(r.equity_id),
    isin: (r.isin as string) ?? null,
    companyName: (r.company_name as string) ?? '—',
    descRaw: (r.desc_raw as string) ?? '',
    disseminatedAt: (r.disseminated_at as string) ?? null,
    day0: (r.day_0_trade_date as string) ?? null,
    isResult: r.is_result_announcement === true,
  }));

  return { rows, total: res.count ?? rows.length, page, pageSize, failed: false };
}
