import type { ExchangeFilter } from '@/services/scanEngine'

/**
 * Extracted from views/ScanView.tsx's private ExchangeTabs (not exported
 * there) — same pattern as ScannerExportButtons.tsx: duplicated here rather
 * than modifying ScanView.tsx, since the scanner preview pages are
 * explicitly not touching the existing scanner page. Worth migrating
 * ScanView.tsx to import from here once the preview pages are the norm.
 */
export function ExchangeTabs({
  value,
  onChange,
  disabledOptions = [],
}: {
  value: ExchangeFilter
  onChange: (f: ExchangeFilter) => void
  disabledOptions?: ExchangeFilter[]
}) {
  return (
    <div style={{
      display: 'flex', gap: '2px', padding: '4px',
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '100px',
    }}>
      {(['combined', 'NSE', 'BSE'] as ExchangeFilter[]).map((ex) => {
        const isDisabled = disabledOptions.includes(ex)
        return (
          <button
            key={ex}
            onClick={() => !isDisabled && onChange(ex)}
            disabled={isDisabled}
            style={{
              padding: '6px 16px', borderRadius: '100px', border: 'none',
              background: value === ex ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'transparent',
              color: value === ex ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: 500,
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              opacity: isDisabled ? 0.3 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {ex === 'combined' ? 'Combined' : ex}
          </button>
        )
      })}
    </div>
  )
}
