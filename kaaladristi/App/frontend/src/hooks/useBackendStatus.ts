import { useQuery } from '@tanstack/react-query';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

async function pingBackend(): Promise<true> {
  // Use the lightweight liveness endpoint (a trivial `SELECT 1`), NOT
  // /api/pipeline2/health — that one runs the full health-grid computation
  // (per-dimension coverage over km_equity_eod) and can take >4s under heavy DB
  // load (backfills/recomputes), which was false-tripping "Backend offline"
  // even though the backend was up. /ping stays fast regardless of DB load.
  const res = await fetch(`${PIPELINE_API}/api/pipeline2/ping`, { signal: AbortSignal.timeout(6000) });
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
