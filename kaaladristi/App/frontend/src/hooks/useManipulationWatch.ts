import { useQuery } from '@tanstack/react-query';
import { executeManipulationWatch, type ManipulationWatchResult } from '@/services/scanEngine';

export function useManipulationWatch(lookbackDays: number = 30) {
  return useQuery<ManipulationWatchResult>({
    queryKey: ['manipulation-watch', lookbackDays],
    queryFn: () => executeManipulationWatch(lookbackDays),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
