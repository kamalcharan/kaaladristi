import { useMemo } from 'react'
import { useInstrumentPulse } from '@/hooks/useInstrumentPulse'
import SmartMoneyCard, { type SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard'
import { computeSmartMoney, computeDots } from '@/services/visualPulseEngine'
import type { DotSignals } from '@/services/visualPulseEngine'

interface Props {
  symbolId?:   number
  symbolType?: 'index' | 'equity'
  narrative?:  string
}

export default function SmartMoneyWidget({ symbolId = 1, symbolType = 'index', narrative = 'NIFTY 50 · Live' }: Props) {
  const { bars, isLoading } = useInstrumentPulse(symbolId, symbolType)

  const idx = bars.length - 1

  const dotsHistory: DotSignals[] = useMemo(
    () => bars.map((b, i) => computeDots(b, i > 0 ? bars[i - 1] : null)),
    [bars],
  )

  const smHistory: SmartMoneyBar[] = useMemo(() => {
    if (bars.length === 0) return []
    const start = Math.max(0, idx - 29)
    return bars.slice(start, idx + 1).map((b, i) => ({
      sm:    b.sniper_inst ?? 0,
      fm:    b.sniper_hot  ?? 0,
      isSVD: dotsHistory[start + i]?.isSVD ?? false,
      isSBD: dotsHistory[start + i]?.isSBD ?? false,
      isSYD: dotsHistory[start + i]?.isSYD ?? false,
    }))
  }, [bars, idx, dotsHistory])

  const sm = useMemo(() => {
    if (bars.length === 0) return null
    return computeSmartMoney(bars, idx)
  }, [bars, idx])

  if (isLoading || bars.length === 0 || !sm) {
    return <div style={{ height: 80 }} />
  }

  return (
    <SmartMoneyCard
      smHistory={smHistory}
      sm={sm}
      dots={dotsHistory}
      narrative={narrative}
    />
  )
}
