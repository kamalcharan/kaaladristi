import { useMemo } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import SmartMoneyCard, { type SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard'
import { computeSmartMoney, computeDots } from '@/services/visualPulseEngine'
import type { PulseBar, DotSignals } from '@/services/visualPulseEngine'

export default function SmartMoneyWidget() {
  const { data = [], isLoading } = useWorkspaceEod()

  // IndicatorRow is a structural superset of PulseBar
  const bars = data as unknown as PulseBar[]
  const idx  = bars.length - 1

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

  const sm = useMemo(() => bars.length === 0 ? null : computeSmartMoney(bars, idx), [bars, idx])

  if (isLoading || bars.length === 0 || !sm) {
    return <div style={{ height: 80 }} />
  }

  return (
    <SmartMoneyCard
      smHistory={smHistory}
      sm={sm}
      dots={dotsHistory}
      narrative=""
    />
  )
}
