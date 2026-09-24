/**
 * Filings page data.
 *
 * ⚠ EVERY FIELD OF `FilingsQuery` MUST APPEAR IN `queryKey`. A filter missing
 * from the key does not fail, does not warn, and does not filter: React Query
 * sees the same key, serves the cached page, and the control looks dead. That
 * is exactly how `subjects` shipped broken — the sub-chip lit up, the request
 * was never made, and the list was unchanged. `scripts/qa/check-filings.mjs`
 * now reads the interface and asserts each field is named here.
 *
 * `placeholderData` keeps the previous page on screen while the next one
 * loads — a table that empties between pages reads as "no results".
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchFilings, type FilingsQuery, type FilingsResult } from '@/services/filings';

export function useFilings(q: FilingsQuery) {
  return useQuery<FilingsResult>({
    queryKey: [
      'filings', q.tab ?? 'all', q.search ?? '', q.fromDate ?? '', q.toDate ?? '',
      (q.groupIds ?? []).join(','), (q.subjects ?? []).join(','),
      q.sort ?? 'date', q.ascending ?? false,
      q.page ?? 0, q.pageSize ?? 50,
    ],
    queryFn: () => fetchFilings(q),
    staleTime: 5 * 60 * 1000,   // the ingest runs a few times a day
    placeholderData: keepPreviousData,
  });
}
