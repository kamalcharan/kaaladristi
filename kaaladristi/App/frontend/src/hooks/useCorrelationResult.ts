import { useState, useEffect, useRef } from 'react'
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
  state?:        string   // EVENT_IN_STATE only — indicator state at overlap start
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

// Cache outside React so StrictMode double-mount doesn't re-fetch
const _cache = new Map<string, CorrelationResult | null>()

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
  const cacheKey = `${itemA}|${itemB}|${benchmark}`
  const [result, setResult]   = useState<CorrelationResult | null>(_cache.get(cacheKey) ?? null)
  const [loading, setLoading] = useState(!_cache.has(cacheKey))
  const [error, setError]     = useState<string | null>(null)
  const fetchedRef            = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return       // already fired in this mount
    if (_cache.has(cacheKey)) {          // already cached from a previous mount
      setResult(_cache.get(cacheKey) ?? null)
      setLoading(false)
      return
    }

    fetchedRef.current = true
    setLoading(true)

    fetch(`${PIPELINE_URL}/api/correlation/compute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body:    JSON.stringify({ item_a: itemA, item_b: itemB, benchmark }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<CorrelationResult>
      })
      .then(data => {
        const value = data.insufficient_data ? null : data
        _cache.set(cacheKey, value)
        setResult(value)
        setLoading(false)
      })
      .catch(err => {
        setError(String(err))
        setLoading(false)
      })
  }, [cacheKey])  // eslint-disable-line react-hooks/exhaustive-deps

  return {
    result,
    loading,
    error,
    insufficientData: result === null && !loading && !error,
  }
}
