import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import { fetchIndicatorDataById } from '@/services/indicatorData'
import SmartMoneyCard, { type SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard'
import { computeSmartMoney, computeDots } from '@/services/visualPulseEngine'
import type { PulseBar, DotSignals } from '@/services/visualPulseEngine'

interface Props {
  /** When provided (catalog context), fetches this index directly.
   *  When absent (workspace context), reads from useWorkspaceEod. */
  symbolId?: number
}

export default function SmartMoneyWidget({ symbolId }: Props) {
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
