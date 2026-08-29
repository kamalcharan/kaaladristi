import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { DownloadXlsButton, TradingViewExportButton } from '@/components/domain/ScannerExportButtons'
import { computeCohortStats, isHighlight } from '@/services/breakoutSurgeInsights'
import ScanTable from '@/components/domain/ScanTable'
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable'
import type { ScanStock } from '@/types'

type FilterKey = 'hl' | 'rvol' | 'ob' | 'watch'

/**
 * Phase 1 (v3) — now reuses the REAL production row-rendering components
 * instead of hand-rolled ones: ScanTable (sort, column-visibility gear,
 * proven interaction) and BreakoutSurgeCards (already exists, already
 * splits VaNi tier vs rest, already correct — a v2 mistake was building a
 * parallel Cards view when this was sitting in the codebase unused by this
 * page). This page still owns only what's genuinely new: the cohort stat
 * strip, filter chips, and XLS/TV export — page-level additions, not row
 * rendering.
 *
 * Trade-off worth knowing (see docs/claude/breakout-surge-vani-poa.md):
 * neither ScanTable nor BreakoutSurgeCards support a bookmark-star toggle
 * or an inline "why" expand per row — both v2 features are dropped here
 * rather than forked into a second, unproven copy of row rendering. Row
 * click now navigates to the real stock chart page (matching the exact
 * convention ScanView.tsx uses), same as the production Scanner page.
 * Adding the star/expand back means a deliberate, reviewed change to the
 * shared ScanCardWrapper/ScanTable components themselves — worth doing,
 * but as its own decision, not smuggled into this page's fork.
 */
export default function BreakoutSurgeStudio() {
  const navigate = useNavigate()
  const [exchangeFilter] = useState<ExchangeFilter>('combined')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({ hl: false, rvol: false, ob: false, watch: false })

  const { data: rows, isLoading, error } = useScan('breakout_surge', exchangeFilter)
  const { bookmarkedIds, load: loadBookmarks } = useBookmarkStore()
  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const meta = getPresetMeta('breakout_surge')
  const all = rows ?? []
  const stats = computeCohortStats(all)

  let filtered = all
  if (filters.hl) filtered = filtered.filter(isHighlight)
  if (filters.rvol) filtered = filtered.filter((r) => (r.rvol ?? 0) > 3)
  if (filters.ob) filtered = filtered.filter((r) => (r.rsi_14 ?? 0) < 70)
  if (filters.watch) filtered = filtered.filter((r) => bookmarkedIds.has(r.equity_id))

  const onRowClick = (s: ScanStock) =>
    navigate(`/chart/equity/${s.equity_id}?name=${encodeURIComponent(displaySymbol(s))}&tab=chart&setup=breakout_surge`)

  const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
    { key: 'hl', label: 'VaNi Highlights' },
    { key: 'rvol', label: 'RVOL > 3×' },
    { key: 'ob', label: 'Not overbought' },
    { key: 'watch', label: 'Watchlist only' },
  ]

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        Preview · Phase 1
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            {meta?.name ?? 'Breakout Surge'}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.55 }}>{meta?.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <DownloadXlsButton stocks={filtered} scanName="Breakout_Surge" variant="breakout_surge" />
          <TradingViewExportButton stocks={filtered} scanName="Breakout_Surge" />
        </div>
      </div>

      {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading real scan results…</p>}
      {error && <p style={{ color: 'var(--bear)' }}>Failed to load: {(error as Error).message}</p>}

      {!isLoading && !error && (
        <>
          {/* ── Cohort summary strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
            <StatTile label="Broke Out Today" value={String(stats.brokeOutCount)} />
            <StatTile label="VaNi Highlights" value={String(stats.highlightCount)} accent="gold" sub={`of ${stats.brokeOutCount}`} />
            <StatTile label="Accelerating" value={`${stats.acceleratingPct}%`} sub="5D ≥ 22D pace" />
            <StatTile label="Real Volume Behind" value={`${stats.realVolumePct}%`} sub="RVOL > 3×" />
            <StatTile label="Leading Industry" value={stats.leadingIndustry?.name ?? '—'} sub={stats.leadingIndustry ? `${stats.leadingIndustry.count} names` : undefined} />
            <StatTile label="Your Watchlist" value={String(all.filter((r) => bookmarkedIds.has(r.equity_id)).length)} accent="green" sub="already tracking" />
          </div>

          {/* ── Filters ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Filters</span>
            {FILTER_CHIPS.map((f) => (
              <button key={f.key} onClick={() => setFilters((p) => ({ ...p, [f.key]: !p[f.key] }))} style={{
                padding: '6px 13px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${filters[f.key] ? 'var(--accent)' : 'var(--border)'}`,
                background: filters[f.key] ? 'var(--accent-glow)' : 'transparent',
                color: filters[f.key] ? 'var(--accent)' : 'var(--text-muted)',
              }}>{f.label}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-faint)' }}>
              {filtered.length} shown{Object.values(filters).some(Boolean) ? ` · ${Object.values(filters).filter(Boolean).length} filters` : ''}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['table', 'cards'] as const).map((m) => (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)',
                  background: viewMode === m ? 'var(--accent-glow)' : 'transparent',
                  color: viewMode === m ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 11.5, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'capitalize',
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* ── Real production row rendering — not reinvented ── */}
          {viewMode === 'table' ? (
            <ScanTable stocks={filtered} presetId="breakout_surge" onRowClick={onRowClick} />
          ) : (
            <BreakoutSurgeCards stocks={filtered} />
          )}
        </>
      )}
    </div>
  )
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'gold' | 'green' }) {
  const accentColor = accent === 'gold' ? 'var(--gold)' : accent === 'green' ? 'var(--bull)' : undefined
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, var(--card) 60%)` : 'var(--card)',
      border: `1px solid ${accent ? `color-mix(in srgb, ${accentColor} 35%, transparent)` : 'var(--border)'}`,
      borderLeft: accent ? `3px solid ${accentColor}` : '1px solid var(--border)',
      borderRadius: 12, padding: '13px 15px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.07em', textTransform: 'uppercase', color: accent ? accentColor : 'var(--text-faint)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
        {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>{sub}</span>}
      </div>
    </div>
  )
}
