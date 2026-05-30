import { useMemo } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import OrderFlowCard from '@/components/domain/VisualPulse/OrderFlowCard'
import { computeRssSignals } from '@/services/visualPulseEngine'
import type { PulseBar } from '@/services/visualPulseEngine'

export default function OrderFlowWidget() {
  const { visibleData, activeBarIndex, isLoading } = useWorkspaceEod()

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
