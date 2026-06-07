import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { subYears, format } from 'date-fns'
import type { ChartOverlay } from '@/types/framework'
import { fetchAstroBands, type AstroBand } from '@/services/astroOverlayService'
import { ITEM_DEFAULT_COLOR, TYPE_DEFAULT_COLOR } from '@/components/domain/Workspace/overlayColors'

// Stable empty reference — prevents new [] on every render when data is undefined
const EMPTY_BANDS: AstroBand[] = []

/** Returns AstroBand[] for all visible astro_zone overlays. */
export function useAstroOverlayBands(overlays: ChartOverlay[]): AstroBand[] {
  // Only visible astro_zone overlays
  const activeAstro = useMemo(
    () => overlays.filter(o => o.type === 'astro_zone' && o.visible),
    [overlays],
  )

  // Map ruleCode → user color
  const overlayColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of activeAstro) {
      const ruleCode = o.catalog_item_id.replace('astro_rule:', '')
      const color    = o.color
        ?? ITEM_DEFAULT_COLOR[o.catalog_item_id]
        ?? TYPE_DEFAULT_COLOR[o.type]
        ?? '#c9a84c'
      map.set(ruleCode, color)
    }
    return map
  }, [activeAstro])

  const since = useMemo(
    () => format(subYears(new Date(), 1), 'yyyy-MM-dd'),
    [],
  )

  const queryKey = useMemo(
    () => ['astro-bands', Array.from(overlayColors.keys()).sort().join(','), since],
    [overlayColors, since],
  )

  const { data } = useQuery({
    queryKey,
    queryFn:  () => fetchAstroBands(overlayColors, since),
    staleTime: 5 * 60_000,
    enabled:  overlayColors.size > 0,
  })

  return data ?? EMPTY_BANDS
}
