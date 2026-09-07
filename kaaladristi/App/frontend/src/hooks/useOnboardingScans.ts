/**
 * useOnboardingScans — the live rows the setup wizard shows.
 *
 * Plain useScan() calls (React Query, 3-minute staleTime), so the same fetch
 * serves step 1 (intro card), step 2 (one card per "act on" option), step 3
 * (try-it sort) and step 4 (the three picks) without re-querying.
 */
import { useScan } from '@/hooks/useScan'
import { ACTS_ON_PRESETS, INTRO_PRESET, type ActsOn } from '@/constants/personaConfig'
import type { ScanStock } from '@/types'

export interface ActsOnRows {
  rows: Record<ActsOn, ScanStock[]>
  loading: boolean
  failed: Record<ActsOn, boolean>
}

export function useActsOnRows(): ActsOnRows {
  const confirmed = useScan(ACTS_ON_PRESETS.confirmed, 'NSE')
  const early     = useScan(ACTS_ON_PRESETS.early, 'NSE')
  const extreme   = useScan(ACTS_ON_PRESETS.extreme, 'NSE')
  return {
    rows: { confirmed: confirmed.data ?? [], early: early.data ?? [], extreme: extreme.data ?? [] },
    loading: confirmed.isLoading || early.isLoading || extreme.isLoading,
    failed: { confirmed: confirmed.isError, early: early.isError, extreme: extreme.isError },
  }
}

export function useIntroRows() {
  return useScan(INTRO_PRESET, 'NSE')
}
