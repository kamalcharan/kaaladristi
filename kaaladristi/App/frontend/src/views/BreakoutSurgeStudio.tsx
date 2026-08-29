import { useState } from 'react'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import type { ExchangeFilter } from '@/services/scanEngine'
import { BREAKOUT_SURGE_DISPLAY_FIELDS, BREAKOUT_SURGE_DEFAULT_SORT } from '@/services/breakoutSurgeSpec'

/**
 * Phase 0 scaffold — direct-URL-only preview of the Breakout Surge redesign
 * (see the published design canvas for the full vision). Not linked from the
 * sidebar nav on purpose. Reuses the real useScan()/executeScan() data path —
 * no new fetching logic — so this page lives or dies on real data from day
 * one, not a mock. Phase 1 adds the cohort strip, VaNi Highlight tier,
 * watchlist badges, and row-expand; this phase only proves the pipeline.
 */
export default function BreakoutSurgeStudio() {
  const [exchangeFilter] = useState<ExchangeFilter>('combined')
  const { data: rows, isLoading, error } = useScan('breakout_surge', exchangeFilter)

  const sorted = (rows ?? []).slice().sort((a, b) => {
    const dir = BREAKOUT_SURGE_DEFAULT_SORT.dir === 'desc' ? -1 : 1
    const key = BREAKOUT_SURGE_DEFAULT_SORT.key
    const av = (a[key] as number | null) ?? 0
    const bv = (b[key] as number | null) ?? 0
    return (av - bv) * dir
  })

  return (
    <div style={{ padding: '28px', maxWidth: 900 }}>
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        Preview · Phase 0 scaffold
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, margin: '0 0 6px', color: 'var(--text-primary)' }}>
        Breakout Surge
      </h1>

      {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading real scan results…</p>}
      {error && <p style={{ color: 'var(--bear)' }}>Failed to load: {(error as Error).message}</p>}
      {!isLoading && !error && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            {sorted.length} real results, sorted by {String(BREAKOUT_SURGE_DEFAULT_SORT.key)}.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sorted.slice(0, 30).map((r) => (
              <div key={r.equity_id} style={{
                display: 'flex', gap: 16, padding: '8px 12px',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                fontFamily: 'var(--font-mono)', fontSize: 13,
              }}>
                <span style={{ minWidth: 140, color: 'var(--text-primary)' }}>{displaySymbol(r)}</span>
                {BREAKOUT_SURGE_DISPLAY_FIELDS.map((f) => (
                  <span key={f.key} style={{ minWidth: 70, textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {r[f.key] != null ? String(r[f.key]) : '—'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
