import { useQuery } from '@tanstack/react-query';
import { executeScan } from '@/services/scanEngine';
import type { ScanStock } from '@/types';

export function useScan(scanId: string) {
  return useQuery<ScanStock[]>({
    queryKey: ['scan', scanId],
    queryFn: () => executeScan(scanId),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
