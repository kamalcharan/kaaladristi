import { useMemo } from 'react'
import { useNiftyPulse } from '@/hooks/useNiftyPulse'
import OrderFlowCard from '@/components/domain/VisualPulse/OrderFlowCard'
import { computeRssSignals } from '@/services/visualPulseEngine'

const NARRATIVE = 'NIFTY 50 · Live'

export default function OrderFlowWidget() {
  const { bars, isLoading } = useNiftyPulse()

  const idx = bars.length - 1

  const rss = useMemo(() => {
    if (bars.length === 0) return null
    return computeRssSignals(bars, idx)
  }, [bars, idx])

  const rssHistory = useMemo(() => bars.map(b => b.rss_value ?? 0), [bars])

  if (isLoading || bars.length === 0 || !rss) {
    return <div style={{ height: 80 }} />
  }

  return (
    <OrderFlowCard
      bar={bars[idx]}
      rss={rss}
      rssHistory={rssHistory}
      narrative={NARRATIVE}
    />
  )
}
