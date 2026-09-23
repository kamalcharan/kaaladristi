/**
 * Filings page data. Keyed on every filter so a changed chip is a new query,
 * and `placeholderData` keeps the previous page on screen while the next one
 * loads — a table that empties between pages reads as "no results".
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchFilings, type FilingsQuery, type FilingsResult } from '@/services/filings';

export function useFilings(q: FilingsQuery) {
  return useQuery<FilingsResult>({
    queryKey: [
      'filings', q.tab ?? 'all', q.search ?? '', q.fromDate ?? '', q.toDate ?? '',
      (q.groupIds ?? []).join(','), q.sort ?? 'date', q.ascending ?? false,
      q.page ?? 0, q.pageSize ?? 50,
    ],
    queryFn: () => fetchFilings(q),
    staleTime: 5 * 60 * 1000,   // the ingest runs a few times a day
    placeholderData: keepPreviousData,
  });
}
