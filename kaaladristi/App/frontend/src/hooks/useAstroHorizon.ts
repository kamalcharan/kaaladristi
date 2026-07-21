// Astro forward-horizon gating (POA-astro-layer-mercury-launch §Phase C).
// Every astro surface that shows FUTURE events clamps through this hook —
// story ribbon, chart future pins, almanac future zone. History is never
// gated. free/quarterly see today + 4 days; annual/trial/beta see 90 days.

import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { ASTRO_HORIZON_DAYS, type TierType } from '@/constants/frameworkConstants'

export interface AstroHorizon {
  /** Days visible ahead, inclusive of today (5 = today + 4). */
  days: number
  /** Last visible ISO date (YYYY-MM-DD). Events with date > cutoffIso are locked. */
  cutoffIso: string
  /** True when the tier sees the full quarter (no upgrade prompt needed). */
  fullQuarter: boolean
}

export function useAstroHorizon(): AstroHorizon {
  const tier = useAuthStore(s => (s.profile?.tier ?? 'free') as TierType)
  return useMemo(() => {
    const days = ASTRO_HORIZON_DAYS[tier] ?? ASTRO_HORIZON_DAYS.free
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days - 1)
    return {
      days,
      cutoffIso: cutoff.toISOString().slice(0, 10),
      fullQuarter: days >= 90,
    }
  }, [tier])
}
