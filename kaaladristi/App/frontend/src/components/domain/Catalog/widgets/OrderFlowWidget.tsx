import { useMemo } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import OrderFlowCard from '@/components/domain/VisualPulse/OrderFlowCard'
import { computeRssSignals } from '@/services/visualPulseEngine'
import type { PulseBar } from '@/services/visualPulseEngine'

export default function OrderFlowWidget() {
  const { data = [], isLoading } = useWorkspaceEod()

  // IndicatorRow is a structural superset of PulseBar
  const bars = data as unknown as PulseBar[]
  const idx  = bars.length - 1

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
