import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { fetchInstrumentEod } from '@/services/indicatorData'
import TradingChart from '@/components/charts/TradingChart'

interface Props {
  height: number
}

export default function WorkspaceChart({ height }: Props) {
  const framework = useFrameworkStore(s => s.framework)
  const symbol = framework?.instruments?.[0] ?? null
  const overlays = framework?.chart_overlays ?? []

  const { data = [], isLoading } = useQuery({
    queryKey: ['workspace-chart', symbol, '1Y'],
    queryFn: () => fetchInstrumentEod(symbol!, '1Y'),
    staleTime: 120_000,
    enabled: !!symbol,
  })

  if (!symbol) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>
          No instrument selected
        </span>
        <Link
          to="/settings"
          style={{ fontSize: 11, color: '#7c6af7', textDecoration: 'none' }}
        >
          Go to settings →
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
      }}>
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,.2)',
          fontFamily: 'var(--font-mono, monospace)',
        }}>
          Loading {symbol}…
        </span>
      </div>
    )
  }

  return (
    <TradingChart
      data={data}
      height={height}
      overlays={overlays}
      compact
    />
  )
}
