/**
 * Confluence Detection — VaNi Phase 3
 *
 * Mount <ConfluencePairMonitor> inside WorkspaceCanvas for each visible
 * overlay pair. Each monitor runs useCorrelationResult for one pair and
 * fires addVaNiBlock when conditions are met.
 *
 * Suppression is tracked in a useRef inside each monitor so the guard is
 * synchronous — avoids the async-state race that causes infinite loops.
 */

import { useEffect, useRef, useMemo } from 'react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useCorrelationResult } from './useCorrelationResult'
import type { CorrelationResult } from './useCorrelationResult'
import type { FrameworkBlock } from '@/types/framework'

/**
 * Returns all pairs of visible overlay catalog_item_ids.
 * Uses a stable memo so the array reference only changes when overlay IDs
 * actually change — prevents Zustand from force-re-rendering on unrelated
 * store updates.
 */
export function useVisibleOverlayPairs(): Array<[string, string]> {
  // Select only the IDs of visible overlays — primitives, stable comparison
  const visibleIds = useFrameworkStore(s => {
    const overlays = s.framework?.chart_overlays ?? []
    return overlays
      .filter(o => o.visible)
      .map(o => o.catalog_item_id)
      .join(',')   // string — stable reference when content doesn't change
  })

  return useMemo(() => {
    console.debug('[VaNi] visibleIds:', visibleIds)
    if (!visibleIds) return []
    const ids = visibleIds.split(',')
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push([ids[i], ids[j]])
      }
    }
    return pairs
  }, [visibleIds])
}

interface PairMonitorProps {
  itemA:       string
  itemB:       string
  benchmark?:  string
  onSuppress:  (key: string) => void
}

/**
 * Renders nothing. Watches one overlay pair and fires addVaNiBlock when
 * the correlation has ≥3 instances and is currently active.
 *
 * Uses a ref-based "has fired" guard so the guard is synchronous —
 * React setState (async) would lose the race and allow re-entry.
 */
export function ConfluencePairMonitor({
  itemA, itemB, benchmark = 'NIFTY50', onSuppress,
}: PairMonitorProps): null {
  console.debug('[VaNi] ConfluencePairMonitor mounted:', itemA, itemB)
  const { result } = useCorrelationResult(itemA, itemB, benchmark)
  const addVaNiBlock  = useFrameworkStore(s => s.addVaNiBlock)
  const existingBlock = useFrameworkStore(
    s => s.framework?.blocks.some(b => b.catalog_item_id === `vani_corr:${itemA}:${itemB}`) ?? false,
  )

  // Synchronous guard — prevents re-entry before React state updates commit
  const firedRef = useRef(false)

  useEffect(() => {
    if (!result) return
    if (!result.currently_active) return
    if (result.n_instances < 3) return
    if (existingBlock) return
    if (firedRef.current) return

    firedRef.current = true   // synchronous — safe against concurrent effect runs

    const block: FrameworkBlock = {
      id:              crypto.randomUUID(),
      type:            'vani_correlation',
      catalog_item_id: `vani_corr:${itemA}:${itemB}`,
      placement:       'panel_block',
      grid_position:   { col_start: 17, col_end: 25, row_start: 1, row_end: 9 },
      config:          {
        item_a: itemA,
        item_b: itemB,
        correlation_result: result as unknown as Record<string, unknown>,
      },
      added_by: 'vani',
      added_at: new Date().toISOString(),
    }
    addVaNiBlock(block)
    onSuppress(`${itemA}:${itemB}`)
  }, [result, existingBlock])  // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
