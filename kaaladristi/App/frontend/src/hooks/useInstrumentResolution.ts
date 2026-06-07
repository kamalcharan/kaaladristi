import { useQuery } from '@tanstack/react-query'
import { resolveInstrumentId } from '@/services/indicatorData'

export function useInstrumentResolution(symbol: string | null) {
  return useQuery({
    queryKey: ['instrument-resolution', symbol],
    queryFn: () => resolveInstrumentId(symbol!),
    enabled: !!symbol,
    staleTime: Infinity, // symbol → id mapping never changes
    gcTime: Infinity,
  })
}
