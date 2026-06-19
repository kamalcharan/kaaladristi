import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useScan } from '@/hooks/useScan'
import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'

type ColumnVariant = 'default' | 'stage'

interface ScannerWidgetProps {
  presetId: string
  title: string
  maxRows?: number
  variant?: ColumnVariant
}

const GRID_COLS: Record<ColumnVariant, string> = {
  default: '16px 1fr 44px 44px',
  stage:   '16px 1fr 54px 40px 30px 44px',
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

function formatClose(c: number | null): string {
  if (c == null) return '—'
  return c >= 1000 ? c.toFixed(0) : c.toFixed(1)
}

function formatStage(s: string | null | undefined): string {
  if (!s) return '—'
  return s === 'S2_CANDIDATE' ? 'S2C' : s
}

function StockRow({ stock, onClick, variant = 'default' }: {
  stock: ScanStock
  onClick: () => void
  variant?: ColumnVariant
}) {
  const sym = displaySymbol(stock)
  const chgColor =
    stock.pct_chng != null && stock.pct_chng > 0 ? 'var(--bull)' :
    stock.pct_chng != null && stock.pct_chng < 0 ? 'var(--bear)' :
    'var(--text-faint)'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS[variant],
        gap: 6, alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
        cursor: 'pointer',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <ZoneDot zone={stock.magic_rs_zone} />
      <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sym}
      </span>

      {variant === 'default' ? (
        <>
          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
            {stock.magic_rs != null ? stock.magic_rs.toFixed(1) : '—'}
          </span>
          <span style={{ color: chgColor, textAlign: 'right' }}>
            {stock.pct_chng != null
              ? `${stock.pct_chng > 0 ? '+' : ''}${stock.pct_chng.toFixed(1)}%`
              : '—'}
          </span>
        </>
      ) : (
        <>
          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
            {formatClose(stock.close)}
          </span>
          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
            {stock.magic_rs != null ? stock.magic_rs.toFixed(1) : '—'}
          </span>
          <span style={{ color: 'var(--text-faint)', textAlign: 'right', fontSize: 9, letterSpacing: '.02em' }}>
            {formatStage(stock.stage)}
          </span>
          <span style={{ color: chgColor, textAlign: 'right' }}>
            {stock.pct_chng != null
              ? `${stock.pct_chng > 0 ? '+' : ''}${stock.pct_chng.toFixed(1)}%`
              : '—'}
          </span>
        </>
      )}
    </div>
  )
}

function ColumnHeaders({ variant = 'default' }: { variant?: ColumnVariant }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: GRID_COLS[variant],
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
      {variant === 'default' ? (
        <>
          <span style={{ textAlign: 'right' }}>RS</span>
          <span style={{ textAlign: 'right' }}>Chg</span>
        </>
      ) : (
        <>
          <span style={{ textAlign: 'right' }}>Close</span>
          <span style={{ textAlign: 'right' }}>MRS</span>
          <span style={{ textAlign: 'right' }}>Stg</span>
          <span style={{ textAlign: 'right' }}>D%</span>
        </>
      )}
    </div>
  )
}

export default function ScannerWidget({ presetId, title, maxRows = 4, variant = 'default' }: ScannerWidgetProps) {
  const { data, isLoading, isError } = useScan(presetId)
  const navigate = useNavigate()

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
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-faint)' }}>
            {data.length}
          </span>
        )}
      </div>

      {/* Column headers */}
      {!isLoading && !isError && data && data.length > 0 && (
        <ColumnHeaders variant={variant} />
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
          <StockRow
            key={stock.equity_id}
            stock={stock}
            onClick={() => navigate(`/pulse/equity/${stock.equity_id}`)}
            variant={variant}
          />
        ))
      )}

      {/* View all footer */}
      {!isLoading && !isError && data && data.length > 0 && (
        <button
          onClick={() => navigate(`/scanner/${presetId}`)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--accent)', textAlign: 'right',
            padding: '4px 0 0', letterSpacing: '.04em',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.7' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        >
          View all {data.length} →
        </button>
      )}
    </div>
  )
}
