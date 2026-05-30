/**
 * Confluence Detection — VaNi Phase 3
 *
 * Mount <ConfluencePairMonitor> inside WorkspaceCanvas for each visible
 * overlay pair. Each monitor runs useCorrelationResult for one pair and
 * fires addVaNiBlock when conditions are met.
 *
 * Suppression is in-memory (local state in WorkspaceCanvas) — Phase 5 adds DB.
 */

import { useEffect } from 'react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useCorrelationResult } from './useCorrelationResult'
import type { CorrelationResult } from './useCorrelationResult'
import type { FrameworkBlock } from '@/types/framework'

/** Returns all pairs of visible overlay catalog_item_ids. */
export function useVisibleOverlayPairs(): Array<[string, string]> {
  const overlays = useFrameworkStore(
    s => s.framework?.chart_overlays.filter(o => o.visible) ?? [],
  )
  const pairs: Array<[string, string]> = []
  for (let i = 0; i < overlays.length; i++) {
    for (let j = i + 1; j < overlays.length; j++) {
      pairs.push([overlays[i].catalog_item_id, overlays[j].catalog_item_id])
    }
  }
  return pairs
}

interface PairMonitorProps {
  itemA:       string
  itemB:       string
  benchmark?:  string
  suppressed:  Set<string>
  onSuppress:  (key: string) => void
}

/**
 * Renders nothing. Watches one overlay pair and fires addVaNiBlock when
 * the correlation has ≥3 instances and is currently active.
 *
 * Mount one per pair inside WorkspaceCanvas. Uses a hook internally so
 * we avoid the hooks-in-loops rule.
 */
export function ConfluencePairMonitor({
  itemA, itemB, benchmark = 'NIFTY50', suppressed, onSuppress,
}: PairMonitorProps): null {
  const { result } = useCorrelationResult(itemA, itemB, benchmark)
  const addVaNiBlock  = useFrameworkStore(s => s.addVaNiBlock)
  const existingBlock = useFrameworkStore(
    s => s.framework?.blocks.some(b => b.catalog_item_id === `vani_corr:${itemA}:${itemB}`) ?? false,
  )

  useEffect(() => {
    if (!result) return
    if (!result.currently_active) return
    if (result.n_instances < 3) return

    const suppKey = `${itemA}:${itemB}`
    if (suppressed.has(suppKey)) return
    if (existingBlock) return

    const block: FrameworkBlock = {
      id:              crypto.randomUUID(),
      type:            'vani_correlation',
      catalog_item_id: `vani_corr:${itemA}:${itemB}`,
      placement:       'panel_block',
      grid_position:   { col_start: 17, col_end: 25, row_start: 1, row_end: 9 },
      config:          { item_a: itemA, item_b: itemB, correlation_result: result as unknown as Record<string, unknown> },
      added_by:        'vani',
      added_at:        new Date().toISOString(),
    }
    addVaNiBlock(block)
    onSuppress(suppKey)
  }, [result, existingBlock, suppressed])  // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
