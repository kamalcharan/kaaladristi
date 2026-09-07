import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { downloadScanXls, type ScanVariant, type XlsColumn } from '@/utils/downloadXls'
import type { ScanStock } from '@/types'

/**
 * Extracted from views/ScanView.tsx's private DownloadXlsButton /
 * TradingViewExportButton (not exported there) — duplicated here rather
 * than modifying ScanView.tsx, since the Breakout Surge preview page is
 * explicitly not touching the existing scanner page. Worth migrating
 * ScanView.tsx to import from here once the preview pages are the norm,
 * not urgent while both still work independently.
 */

const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 12px', borderRadius: 100,
  border: '1px solid var(--border)', background: 'transparent',
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'var(--font-body)', transition: 'all 0.15s', whiteSpace: 'nowrap',
}

export function DownloadXlsButton({ stocks, scanName, variant = 'default', columns }: {
  stocks: ScanStock[]; scanName: string; variant?: ScanVariant; columns?: XlsColumn[]
}) {
  if (stocks.length === 0) return null
  return (
    <button
      onClick={() => downloadScanXls(stocks, scanName, variant, columns)}
      title={`Download ${stocks.length} rows as Excel`}
      style={{ ...btnBase, color: 'var(--text-muted)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <Download style={{ width: 12, height: 12 }} />
      XLS
    </button>
  )
}

function toTvSymbol(symbol: string, exchange: string | null): string {
  const ex = exchange === 'BSE' ? 'BSE' : 'NSE'
  return `${ex}:${symbol}`
}

function buildTvList(stocks: Array<{ symbol: string; exchange: string | null }>): string {
  return stocks
    .filter((s) => !/^\d+$/.test(s.symbol)) // skip BSE numeric codes
    .map((s) => toTvSymbol(s.symbol, s.exchange))
    .join(',')
}

export function TradingViewExportButton({ stocks, scanName }: {
  stocks: Array<{ symbol: string; exchange: string | null }>; scanName: string
}) {
  const [copied, setCopied] = useState(false)
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  if (stocks.length === 0) return null

  const list = buildTvList(stocks)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(list)
      setCopied(true)
      if (resetRef.current) clearTimeout(resetRef.current)
      resetRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      const blob = new Blob([list], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${scanName.replace(/\s+/g, '_')}_tradingview.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${stocks.length} symbols for TradingView`}
      style={{ ...btnBase, color: copied ? 'var(--bull)' : 'var(--text-muted)' }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {copied ? 'Copied ✓' : 'TV'}
    </button>
  )
}
