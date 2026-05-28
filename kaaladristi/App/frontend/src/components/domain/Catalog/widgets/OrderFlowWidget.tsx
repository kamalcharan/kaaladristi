import { useMemo } from 'react'
import { useInstrumentPulse } from '@/hooks/useInstrumentPulse'
import OrderFlowCard from '@/components/domain/VisualPulse/OrderFlowCard'
import { computeRssSignals } from '@/services/visualPulseEngine'

interface Props {
  symbolId?:   number
  symbolType?: 'index' | 'equity'
  narrative?:  string
}

export default function OrderFlowWidget({ symbolId = 1, symbolType = 'index', narrative = 'NIFTY 50 · Live' }: Props) {
  const { bars, isLoading } = useInstrumentPulse(symbolId, symbolType)

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
      narrative={narrative}
    />
  )
}
