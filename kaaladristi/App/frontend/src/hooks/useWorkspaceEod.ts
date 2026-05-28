import { useQuery } from '@tanstack/react-query'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { fetchInstrumentEod } from '@/services/indicatorData'

/**
 * Reads the workspace EOD dataset from the React Query cache.
 * Uses the same key as WorkspaceChart so no extra network call is made —
 * the data WorkspaceChart already fetched is returned instantly.
 */
export function useWorkspaceEod() {
  const symbol = useFrameworkStore(s => s.framework?.instruments?.[0] ?? null)
  return useQuery({
    queryKey: ['workspace-chart', symbol, '1Y'],
    queryFn:  () => fetchInstrumentEod(symbol!, '1Y'),
    staleTime: 120_000,
    enabled:  !!symbol,
  })
}
