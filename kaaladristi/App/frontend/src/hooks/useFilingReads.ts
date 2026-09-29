/**
 * Reads + second opinions for the events on the current Filings page.
 *
 * Keyed on the sorted id list, so a page change refetches and a re-render of
 * the same page does not. Polls while any row on the page is still pending
 * or running — the reader works in the background and the status column is
 * the only place its progress shows.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchFilingReads, type FilingReadsResult } from '@/services/filingReads';

const LIVE = new Set(['pending', 'reading', 'running']);

export function useFilingReads(eventIds: number[]) {
  const key = Array.from(new Set(eventIds)).sort((a, b) => a - b);
  return useQuery<FilingReadsResult>({
    queryKey: ['filing-reads', key.join(',')],
    queryFn: () => fetchFilingReads(key),
    enabled: key.length > 0,
    staleTime: 30 * 1000,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return false;
      for (const r of d.reads.values()) if (LIVE.has(r.status)) return 20 * 1000;
      for (const list of d.checks.values()) for (const c of list) if (LIVE.has(c.status)) return 20 * 1000;
      return false;
    },
  });
}
