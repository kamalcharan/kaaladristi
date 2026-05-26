import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { fetchInstrumentEod } from '@/services/indicatorData'
import TradingChart from '@/components/charts/TradingChart'

const DISPLAY_NAME: Record<string, string> = {
  NIFTY50:   'NIFTY 50',
  NIFTY:     'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT:   'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
}

const HEADER_H = 36

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

  const displayName = DISPLAY_NAME[symbol.toUpperCase()] ?? symbol.toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Name strip */}
      <div style={{
        height: HEADER_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 14px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          {displayName}
        </span>
        {isLoading && (
          <span style={{
            marginLeft: 8, fontSize: 10, color: 'rgba(255,255,255,.2)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            loading…
          </span>
        )}
      </div>

      {/* Chart */}
      {!isLoading && (
        <TradingChart
          data={data}
          height={height - HEADER_H}
          overlays={overlays}
          compact
        />
      )}
    </div>
  )
}

