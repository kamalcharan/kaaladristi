/**
 * ConcedeChart — "Where would you concede you were wrong?" answered on a real
 * chart. Draws three horizontal lines on the chosen setup's last six months
 * (10-day low, 22-day low, Golden Line = 150-day SMA) and lets the user tap
 * the one they would honour. The chosen line lights; the answer is stored as
 * concede_level. With no chosen stock the three chips still work.
 *
 * Reuses TradingChart's setupLevels — the same lines the Story View draws.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import TradingChart from '@/components/charts/TradingChart'
import { fetchEquityEodById, type IndicatorRow } from '@/services/indicatorData'
import { displaySymbol } from '@/lib/symbolUtils'
import { CONCEDE_LEVEL_IDS, CONCEDE_LEVEL_OPTIONS, type ConcedeLevel } from '@/constants/personaConfig'
import type { ScanStock } from '@/types'
import { Chip, MONO, fmtInr } from './ui'

const EMPTY: never[] = []

function lowOf(bars: IndicatorRow[], n: number): number | null {
  const slice = bars.slice(-n).map(b => b.low).filter((v): v is number => v != null && Number.isFinite(v))
  return slice.length ? Math.min(...slice) : null
}
function goldenLine(bars: IndicatorRow[]): number | null {
  for (let i = bars.length - 1; i >= Math.max(0, bars.length - 5); i--) {
    const v = bars[i].sma_150
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

export default function ConcedeChart({ stock, value, onChange }: {
  stock: ScanStock | null
  value: ConcedeLevel | null
  onChange: (v: ConcedeLevel) => void
}) {
  const { data: bars = [], isLoading } = useQuery({
    queryKey: ['onboarding-bars', stock?.equity_id ?? 0],
    queryFn: () => fetchEquityEodById(stock!.equity_id, '6M'),
    enabled: !!stock,
    staleTime: 10 * 60 * 1000,
  })

  const prices = useMemo<Record<ConcedeLevel, number | null>>(() => ({
    tight: lowOf(bars, 10),
    swing_low: lowOf(bars, 22),
    structure: goldenLine(bars),
  }), [bars])

  const levels = useMemo(() =>
    CONCEDE_LEVEL_IDS.flatMap(k => {
      const price = prices[k]
      return price == null ? [] : [{ price, label: CONCEDE_LEVEL_OPTIONS[k].line, tone: (value === k ? 'bull' : 'neutral') as 'bull' | 'neutral' }]
    }), [prices, value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {stock && (
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{displaySymbol(stock)}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)' }}>last 6 months · tap a line below</span>
          </div>
          {isLoading || bars.length === 0 ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
              {isLoading ? 'Loading chart…' : 'No bars for this symbol.'}
            </div>
          ) : (
            <TradingChart data={bars} compact workspaceMode height={300}
              overlays={EMPTY} astroBands={EMPTY} bigMoneyEvents={EMPTY} setupLevels={levels} />
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CONCEDE_LEVEL_IDS.map(k => {
          const opt = CONCEDE_LEVEL_OPTIONS[k]
          const price = prices[k]
          return (
            <Chip key={k} active={value === k} onClick={() => onChange(k)} title={opt.line}>
              <span>{opt.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, marginLeft: 8, opacity: .8 }}>
                {opt.line}{stock && price != null ? ` · ${fmtInr(price)}` : ''}
              </span>
            </Chip>
          )
        })}
      </div>
    </div>
  )
}
