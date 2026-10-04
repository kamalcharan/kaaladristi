import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAstroHorizon } from './useAstroHorizon'
import { astroToday } from '@/services/astroEvents'
import type { ChartOverlay } from '@/types/framework'
import { fetchAstroBands, type AstroBand } from '@/services/astroOverlayService'
import { ITEM_DEFAULT_COLOR, TYPE_DEFAULT_COLOR } from '@/components/domain/Workspace/overlayColors'

// Stable empty reference — prevents new [] on every render when data is undefined
const EMPTY_BANDS: AstroBand[] = []

/** Returns AstroBand[] for all visible astro_zone overlays. */
export function useAstroOverlayBands(overlays: ChartOverlay[], startDate?:string): AstroBand[] {
  // Only visible astro_zone overlays
  const activeAstro = useMemo(
    () => overlays.filter(o => o.type === 'astro_zone' && o.visible),
    [overlays],
  )

  // Map ruleCode → user color — identity preserved, no redirects
  const overlayColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of activeAstro) {
      const code  = o.catalog_item_id.replace('astro_rule:', '')
      const color = o.color
        ?? ITEM_DEFAULT_COLOR[o.catalog_item_id]
        ?? TYPE_DEFAULT_COLOR[o.type]
        ?? '#6366f1'
      map.set(code, color)
    }
    return map
  }, [activeAstro])

  // Map ruleCode → user opacity (undefined = use tier default in service)
  const overlayOpacities = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of activeAstro) {
      if (o.opacity != null) {
        const code = o.catalog_item_id.replace('astro_rule:', '')
        map.set(code, o.opacity)
      }
    }
    return map
  }, [activeAstro])

  const horizon=useAstroHorizon()
  const since=startDate ?? `${Number(astroToday().slice(0,4))-2}-01-01`

  const queryKey = useMemo(
    () => [
      'astro-bands',
      // Include color VALUES (not just keys) so a color change invalidates the
      // cache — bands bake in the color, so stale cache = stale color.
      Array.from(overlayColors.entries()).map(([k, v]) => `${k}:${v}`).sort().join(','),
      Array.from(overlayOpacities.entries()).map(([k, v]) => `${k}:${v}`).sort().join(','),
      since, horizon.cutoffIso,
    ],
    [overlayColors, overlayOpacities, since, horizon.cutoffIso],
  )

  const { data } = useQuery({
    queryKey,
    queryFn:  () => fetchAstroBands(overlayColors, overlayOpacities, since, horizon.cutoffIso),
    staleTime: 5 * 60_000,
    enabled:  overlayColors.size > 0,
  })

  return data ?? EMPTY_BANDS
}
