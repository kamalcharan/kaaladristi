import { useQuery } from '@tanstack/react-query';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

async function pingBackend(): Promise<true> {
  const res = await fetch(`${PIPELINE_API}/api/pipeline2/health`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error('unhealthy');
  return true;
}

export type BackendState = 'online' | 'offline' | 'checking';

export function useBackendStatus(): BackendState {
  const { isError, isLoading, isFetching, isSuccess } = useQuery({
    queryKey: ['backend-health'],
    queryFn: pingBackend,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
    retryDelay: 1000,
  });

  if (isError) return 'offline';
  if (isLoading || (isFetching && !isSuccess)) return 'checking';
  return 'online';
}
