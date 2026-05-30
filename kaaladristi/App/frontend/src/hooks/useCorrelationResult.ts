import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) || ''

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface CorrelationInstance {
  start_date:    string
  end_date:      string
  duration_days: number
  return_5d:     number | null
  return_22d:    number | null
}

export interface CorrelationResult {
  shape:            'EVENT_OVERLAP' | 'THRESHOLD_CROSS' | 'ZONE_CONFLUENCE' | 'EVENT_IN_STATE'
  n_instances:      number
  bearish_count:    number
  bullish_count:    number
  avg_return_5d:    number
  avg_return_22d:   number
  currently_active: boolean
  instances:        CorrelationInstance[]
  insufficient_data?: boolean
}

export function useCorrelationResult(
  itemA: string,
  itemB: string,
  benchmark = 'NIFTY50',
): {
  result:           CorrelationResult | null
  loading:          boolean
  error:            string | null
  insufficientData: boolean
} {
  const { data, isLoading, error } = useQuery<CorrelationResult>({
    queryKey:  ['correlation', itemA, itemB, benchmark],
    queryFn:   async () => {
      const res = await fetch(`${PIPELINE_URL}/api/correlation/compute`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ item_a: itemA, item_b: itemB, benchmark }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60_000,
    retry:     1,
    enabled:   !!itemA && !!itemB,
  })

  return {
    result:           data?.insufficient_data ? null : (data ?? null),
    loading:          isLoading,
    error:            error ? String(error) : null,
    insufficientData: data?.insufficient_data === true,
  }
}
