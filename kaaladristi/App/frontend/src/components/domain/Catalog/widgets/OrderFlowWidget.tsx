import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import { fetchIndicatorDataById } from '@/services/indicatorData'
import OrderFlowCard from '@/components/domain/VisualPulse/OrderFlowCard'
import { computeRssSignals } from '@/services/visualPulseEngine'
import type { PulseBar } from '@/services/visualPulseEngine'

interface Props {
  /** When provided (catalog context), fetches this index directly.
   *  When absent (workspace context), reads from useWorkspaceEod. */
  symbolId?: number
}

export default function OrderFlowWidget({ symbolId }: Props) {
  const { data: catalogData = [], isLoading: catalogLoading } = useQuery({
    queryKey: ['widget-catalog-eod', symbolId],
    queryFn:  () => fetchIndicatorDataById(symbolId!, '1Y'),
    staleTime: 120_000,
    enabled:  symbolId != null,
  })

  const workspace = useWorkspaceEod()

  const visibleData    = symbolId != null ? catalogData : workspace.visibleData
  const activeBarIndex = symbolId != null ? (catalogData.length > 0 ? catalogData.length - 1 : 0) : workspace.activeBarIndex
  const isLoading      = symbolId != null ? catalogLoading : workspace.isLoading

  const bars = visibleData as unknown as PulseBar[]
  const idx  = activeBarIndex

  const rss        = useMemo(() => bars.length === 0 ? null : computeRssSignals(bars, idx), [bars, idx])
  const rssHistory = useMemo(() => bars.map(b => b.rss_value ?? 0), [bars])

  if (isLoading || bars.length === 0 || !rss) {
    return <div style={{ height: 80 }} />
  }

  return (
    <OrderFlowCard
      bar={bars[idx]}
      rss={rss}
      rssHistory={rssHistory}
      narrative=""
    />
  )
}
