import { useAstroSignal } from '@/hooks/useDashboardExtras'
import { useLastTradingDate } from '@/hooks/useLastTradingDate'

function atmosphericConfig(netScore: number): { color: string; label: string } {
  if (netScore > 2)   return { color: 'var(--teal, #00c9a0)', label: 'Favorable'   }
  if (netScore >= -1) return { color: 'var(--caution)',        label: 'Neutral'     }
  return                     { color: 'var(--bear)',           label: 'Unfavorable' }
}

export default function AtmosphericBadge() {
  const today = new Date().toISOString().slice(0, 10)
  const { lastTradingDate } = useLastTradingDate(today)
  const { data: astro } = useAstroSignal(lastTradingDate)

  if (!astro) return null

  const atm = atmosphericConfig(astro.net_score ?? 0)

  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 11, color: atm.color,
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: atm.color, flexShrink: 0,
        display: 'inline-block',
      }} />
      Atmospheric · {atm.label}
    </span>
  )
}
