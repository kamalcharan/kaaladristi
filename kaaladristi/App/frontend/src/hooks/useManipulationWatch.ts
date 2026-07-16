import { useQuery } from '@tanstack/react-query';
import { executeManipulationWatch, type ManipulationWatchResult } from '@/services/scanEngine';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';

// Keyed on the pipeline-confirmed date (same fix as hooks/useScan.ts) — a
// watch page like this is exactly the kind of tab left open for hours.
export function useManipulationWatch(lookbackDays: number = 30) {
  const { latestDataDate } = usePipelineStatus();
  return useQuery<ManipulationWatchResult>({
    queryKey: ['manipulation-watch', lookbackDays, latestDataDate ?? 'unknown'],
    queryFn: () => executeManipulationWatch(lookbackDays),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
