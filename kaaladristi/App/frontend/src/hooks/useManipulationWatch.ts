import { useQuery } from '@tanstack/react-query';
import { executeManipulationWatch, type ManipulationWatchResult } from '@/services/scanEngine';

export function useManipulationWatch() {
  return useQuery<ManipulationWatchResult>({
    queryKey: ['manipulation-watch'],
    queryFn: executeManipulationWatch,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
