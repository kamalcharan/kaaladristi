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

import React, { useEffect, useRef, useMemo } from 'react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useCorrelationResult } from './useCorrelationResult'
import { useActiveRuleToday } from './useRuleInsight'

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
        // Astro pairs suppressed (owner 2026-07-22): this engine has no base
        // rate and uses directional ("strong bullish/bearish") language —
        // exactly what astro-story.md principle #2 exists to prevent. It
        // also fires near-constantly for Mercury (e.g. Combust ∩ Sign is
        // overlapping almost whenever combust is active — not a real
        // confluence). Leave it live for non-astro indicator pairs, which
        // this suppression doesn't touch.
        if (ids[i].startsWith('astro_') || ids[j].startsWith('astro_')) continue
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
  /** Only fire when the overlap is active TODAY — used for intra-group
   * rule pairs so the island surfaces live overlaps, not every
   * historical co-occurrence of two rules in the same group. */
  requireActive?: boolean
}

/**
 * Renders nothing. Watches one overlay pair and fires addVaNiCorrelation
 * when the correlation has ≥3 instances and is currently active.
 */
export function ConfluencePairMonitor({
  itemA, itemB, benchmark = 'NIFTY50', requireActive = false,
}: PairMonitorProps): null {
  const { result } = useCorrelationResult(itemA, itemB, benchmark)
  const addVaNiCorrelation = useFrameworkStore(s => s.addVaNiCorrelation)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!result) return
    if (result.n_instances < 3) return
    if (requireActive && !result.currently_active) return
    if (firedRef.current) return

    firedRef.current = true
    addVaNiCorrelation(itemA, itemB, result)
  }, [result])  // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/**
 * Overlap Visibility Phases 3-4 — intra-group overlaps reach the island.
 *
 * A group overlay (astro_group:Bayer, astro_group:MajorTransit …) bundles
 * many rules; the confluence engine previously saw it only as ONE merged
 * event, so "Mercury combust ∩ Neptune retrograde" inside the same group
 * was invisible ("they did not come on the island, so I will never know").
 *
 * Renders nothing. For one visible group overlay: fetches the tag's rules
 * active TODAY (same /api/ai/active-rule-today the explain popover uses),
 * pairs them, and mounts a ConfluencePairMonitor per pair as astro_rule:
 * items — riding the existing correlation engine, island chips, drawer,
 * and full-analysis page. requireActive keeps it to live overlaps.
 */
const MAX_GROUP_RULES = 4   // 4 active rules → 6 pairs, the practical ceiling

export function GroupOverlapMonitor({ tag }: { tag: string }): React.ReactElement | null {
  const { data } = useActiveRuleToday(tag)
  const active = (data?.active_now ?? []).slice(0, MAX_GROUP_RULES)
  if (active.length < 2) return null

  const pairs: Array<[string, string]> = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      pairs.push([`astro_rule:${active[i].rule_code}`, `astro_rule:${active[j].rule_code}`])
    }
  }
  return (
    <>
      {pairs.map(([a, b]) => (
        <ConfluencePairMonitor key={`${a}:${b}`} itemA={a} itemB={b} requireActive />
      ))}
    </>
  )
}
