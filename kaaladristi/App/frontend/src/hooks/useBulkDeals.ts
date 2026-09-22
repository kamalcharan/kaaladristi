/**
 * Bulk & block deals for one equity over the chart's own window.
 *
 * Keyed on the window, because the card's coverage line is a statement ABOUT
 * that window ("none of these sessions were fetched") and would be wrong if a
 * cached result from a different range were served.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBulkDeals, type BulkDealsResult } from '@/services/bulkDeals';

export function useBulkDeals(
  equityId: number | null,
  fromIso: string | undefined,
  toIso: string | undefined,
  sharesOutstanding?: number | null,
) {
  return useQuery<BulkDealsResult>({
    queryKey: ['bulk-deals', equityId, fromIso, toIso, sharesOutstanding ?? null],
    enabled: !!equityId && !!fromIso && !!toIso,
    staleTime: 30 * 60 * 1000, // the ingest runs twice a day
    queryFn: () => fetchBulkDeals(equityId as number, fromIso as string, toIso as string, sharesOutstanding),
  });
}
