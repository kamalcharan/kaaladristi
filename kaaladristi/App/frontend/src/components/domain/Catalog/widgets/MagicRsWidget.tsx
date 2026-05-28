import { useInstrumentPulse } from '@/hooks/useInstrumentPulse'
import MagicRsSubchart, { type MagicRsDataPoint } from '@/components/domain/VisualPulse/MagicRsSubchart'

interface Props {
  symbolId?:   number              // defaults to 1 (NIFTY 50) for Catalog preview
  symbolType?: 'index' | 'equity'  // defaults to 'index'
}

export default function MagicRsWidget({ symbolId = 1, symbolType = 'index' }: Props) {
  const { bars, isLoading } = useInstrumentPulse(symbolId, symbolType)

  if (isLoading || bars.length === 0) {
    return <div style={{ height: 140 }} />
  }

  const data: MagicRsDataPoint[] = bars.map(b => ({
    trade_date:    b.trade_date,
    magic_rs:      b.magic_rs,
    magic_ma:      b.magic_ma,
    magic_rs_zone: b.magic_rs_zone,
  }))

  return (
    <MagicRsSubchart
      data={data}
      activeIndex={data.length - 1}
      benchmarkLabel="NIFTY 500"
    />
  )
}
