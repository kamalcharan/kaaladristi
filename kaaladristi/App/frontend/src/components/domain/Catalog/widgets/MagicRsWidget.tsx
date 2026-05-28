import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import MagicRsSubchart, { type MagicRsDataPoint } from '@/components/domain/VisualPulse/MagicRsSubchart'

export default function MagicRsWidget() {
  const { data = [], isLoading } = useWorkspaceEod()

  if (isLoading || data.length === 0) {
    return <div style={{ height: 140 }} />
  }

  const points: MagicRsDataPoint[] = data.map(b => ({
    trade_date:    b.trade_date,
    magic_rs:      b.magic_rs,
    magic_ma:      b.magic_ma,
    magic_rs_zone: b.magic_rs_zone,
  }))

  return (
    <MagicRsSubchart
      data={points}
      activeIndex={points.length - 1}
      benchmarkLabel="NIFTY 500"
    />
  )
}
