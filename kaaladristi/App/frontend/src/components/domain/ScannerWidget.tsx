import { Loader2 } from 'lucide-react'
import { useScan } from '@/hooks/useScan'
import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'

interface ScannerWidgetProps {
  presetId: string
  title: string
  maxRows?: number
}

function ZoneDot({ zone }: { zone: string | null }) {
  const normalized = zone?.toLowerCase().replace(/ /g, '_')
  const color =
    normalized === 'strong_bull' ? 'var(--bull)' :
    normalized === 'mild_bull'   ? 'rgba(var(--bull-rgb, 34,197,94), .55)' :
    normalized === 'strong_bear' ? 'var(--bear)' :
    normalized === 'mild_bear'   ? 'rgba(var(--bear-rgb, 239,68,68), .55)' :
    'var(--text-faint)'
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6,
      borderRadius: '50%', background: color, flexShrink: 0,
    }} />
  )
}

function StockRow({ stock }: { stock: ScanStock }) {
  const sym = displaySymbol(stock)
  const chgColor =
    stock.pct_chng != null && stock.pct_chng > 0 ? 'var(--bull)' :
    stock.pct_chng != null && stock.pct_chng < 0 ? 'var(--bear)' :
    'var(--text-faint)'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '16px 1fr 44px 44px',
      gap: 6, alignItems: 'center',
      padding: '4px 0',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 11,
    }}>
      <ZoneDot zone={stock.magic_rs_zone} />
      <span style={{
        color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {sym}
      </span>
      <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
        {stock.magic_rs != null ? stock.magic_rs.toFixed(1) : '—'}
      </span>
      <span style={{ color: chgColor, textAlign: 'right' }}>
        {stock.pct_chng != null
          ? `${stock.pct_chng > 0 ? '+' : ''}${stock.pct_chng.toFixed(1)}%`
          : '—'}
      </span>
    </div>
  )
}

export default function ScannerWidget({ presetId, title, maxRows = 4 }: ScannerWidgetProps) {
  const { data, isLoading, isError } = useScan(presetId)

  return (
    <div style={{
      background: 'var(--card-soft)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '.04em' }}>
          {title}
        </span>
        {!isLoading && !isError && data && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-faint)',
          }}>
            {data.length}
          </span>
        )}
      </div>

      {/* Column headers */}
      {!isLoading && !isError && data && data.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '16px 1fr 44px 44px',
          gap: 6,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 9,
          color: 'var(--text-faint)',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          paddingBottom: 4,
          borderBottom: '1px solid var(--border)',
        }}>
          <span />
          <span>Symbol</span>
          <span style={{ textAlign: 'right' }}>RS</span>
          <span style={{ textAlign: 'right' }}>Chg</span>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0',
          color: 'var(--text-faint)', fontSize: 11 }}>
          <Loader2 size={12} className="animate-spin" />
          <span>Loading…</span>
        </div>
      ) : isError ? (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', padding: '8px 0' }}>
          Failed to load
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', padding: '8px 0' }}>
          No results
        </div>
      ) : (
        data.slice(0, maxRows).map(stock => (
          <StockRow key={stock.equity_id} stock={stock} />
        ))
      )}
    </div>
  )
}
