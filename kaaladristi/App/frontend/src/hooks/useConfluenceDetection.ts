/**
 * Confluence Detection — VaNi Phase 3
 *
 * Mount <ConfluencePairMonitor> inside WorkspaceCanvas for each visible
 * overlay pair. Each monitor runs useCorrelationResult for one pair and
 * fires addVaNiCorrelation when conditions are met.
 *
 * Suppression is tracked in a module-level Map in frameworkStore (24hr window)
 * so it survives component remounts.
 */

import { useEffect, useRef, useMemo } from 'react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useCorrelationResult } from './useCorrelationResult'

/**
 * Returns all pairs of visible overlay catalog_item_ids.
 */
export function useVisibleOverlayPairs(): Array<[string, string]> {
  const visibleIds = useFrameworkStore(s => {
    const overlays = s.framework?.chart_overlays ?? []
    return overlays
      .filter(o => o.visible)
      .map(o => o.catalog_item_id)
      .join(',')
  })

  return useMemo(() => {
    if (!visibleIds) return []
    const ids = visibleIds.split(',')
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (ids[i] === ids[j]) continue
        pairs.push([ids[i], ids[j]])
      }
    }
    return pairs
  }, [visibleIds])
}

interface PairMonitorProps {
  itemA: string
  itemB: string
  benchmark?: string
}

/**
 * Renders nothing. Watches one overlay pair and fires addVaNiCorrelation
 * when the correlation has ≥3 instances and is currently active.
 */
export function ConfluencePairMonitor({
  itemA, itemB, benchmark = 'NIFTY50',
}: PairMonitorProps): null {
  const { result } = useCorrelationResult(itemA, itemB, benchmark)
  const addVaNiCorrelation = useFrameworkStore(s => s.addVaNiCorrelation)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!result) return
    if (result.n_instances < 3) return
    if (firedRef.current) return

    firedRef.current = true
    addVaNiCorrelation(itemA, itemB, result)
  }, [result])  // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
