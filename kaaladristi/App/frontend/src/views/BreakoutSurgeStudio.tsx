import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { CardExchangeBadge, ScanCardWrapper, ScanSectionLabel, VaniBadge } from '@/components/domain/ScanCardShell'
import { DownloadXlsButton, TradingViewExportButton } from '@/components/domain/ScannerExportButtons'
import { BREAKOUT_SURGE_DISPLAY_FIELDS, type DisplayField } from '@/services/breakoutSurgeSpec'
import { computeCohortStats, isHighlight, buildWhyTags } from '@/services/breakoutSurgeInsights'
import type { ScanStock } from '@/types'

type FilterKey = 'hl' | 'rvol' | 'ob' | 'watch'
type SortKey = keyof ScanStock

/**
 * Phase 1 (revised) — sortable columns, real filter chips, watchlist toggle,
 * XLS/TV export, a Cards view that's an actual grid (not the table restacked),
 * and a header row so every column is labeled. Still the same real useScan()
 * data path; still zero changes to ScanTable.tsx/ScanFilterBar.tsx/
 * ScanView.tsx/Sidebar.tsx.
 */
export default function BreakoutSurgeStudio() {
  const [exchangeFilter] = useState<ExchangeFilter>('combined')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score_5d')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({ hl: false, rvol: false, ob: false, watch: false })

  const { data: rows, isLoading, error } = useScan('breakout_surge', exchangeFilter)
  const { bookmarks, bookmarkedIds, load: loadBookmarks, toggle: toggleBookmark } = useBookmarkStore()
  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const meta = getPresetMeta('breakout_surge')
  const all = rows ?? []
  const stats = computeCohortStats(all)

  const isPosition = (equityId: number) => bookmarks.some((b) => b.equity_id === equityId && b.entry_price != null)

  let filtered = all
  if (filters.hl) filtered = filtered.filter(isHighlight)
  if (filters.rvol) filtered = filtered.filter((r) => (r.rvol ?? 0) > 3)
  if (filters.ob) filtered = filtered.filter((r) => (r.rsi_14 ?? 0) < 70)
  if (filters.watch) filtered = filtered.filter((r) => bookmarkedIds.has(r.equity_id))

  const sortRows = (list: ScanStock[]) => {
    const dir = sortDir === 'desc' ? -1 : 1
    return list.slice().sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return ((av as number) - (bv as number)) * dir
    })
  }
  const sorted = sortRows(filtered)
  const highlights = sortRows(filtered.filter(isHighlight))

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

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
          <DownloadXlsButton stocks={sorted} scanName="Breakout_Surge" variant="breakout_surge" />
          <TradingViewExportButton stocks={sorted} scanName="Breakout_Surge" />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
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
              {sorted.length} shown{Object.values(filters).some(Boolean) ? ` · ${Object.values(filters).filter(Boolean).length} filters` : ''}
            </span>
          </div>

          {/* ── VaNi Highlight tier ── */}
          {highlights.length > 0 && (
            <>
              <ScanSectionLabel>✦ VaNi Highlight · {highlights.length}</ScanSectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 26 }}>
                {highlights.map((r) => (
                  <RowExpandable key={r.equity_id} r={r} isPosition={isPosition(r.equity_id)}
                    watched={bookmarkedIds.has(r.equity_id)} highlight
                    onBookmark={() => toggleBookmark(r.equity_id)}
                    expanded={expandedId === r.equity_id}
                    onToggle={() => setExpandedId((id) => (id === r.equity_id ? null : r.equity_id))} />
                ))}
              </div>
            </>
          )}

          {/* ── All results ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <ScanSectionLabel>All Results · {sorted.length}</ScanSectionLabel>
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

          {viewMode === 'table' ? (
            <TableView rows={sorted} sortKey={sortKey} sortDir={sortDir} onSort={onSort}
              bookmarkedIds={bookmarkedIds} isPosition={isPosition} onBookmark={toggleBookmark}
              expandedId={expandedId} onExpand={setExpandedId} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
              {sorted.map((r) => (
                <CardView key={r.equity_id} r={r} watched={bookmarkedIds.has(r.equity_id)}
                  isPosition={isPosition(r.equity_id)} highlight={isHighlight(r)}
                  onBookmark={() => toggleBookmark(r.equity_id)}
                  expanded={expandedId === r.equity_id}
                  onToggle={() => setExpandedId((id) => (id === r.equity_id ? null : r.equity_id))} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared formatting ──────────────────────────────────────────────────────

function fmtField(r: ScanStock, f: DisplayField): string {
  const v = r[f.key]
  if (v == null) return '—'
  if (f.format === 'pct') return `${(v as number) > 0 ? '+' : ''}${(v as number).toFixed(2)}%`
  if (f.format === 'price') return `₹${(v as number).toFixed(2)}`
  if (f.format === 'multiplier') return `${(v as number).toFixed(2)}×`
  if (f.format === 'score') return typeof v === 'number' ? v.toFixed(1) : String(v)
  return String(v)
}

function BookmarkStar({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} title={active ? 'Remove from watchlist' : 'Add to watchlist'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
      <Star size={14} fill={active ? 'var(--caution)' : 'none'} stroke={active ? 'var(--caution)' : 'var(--text-faint)'} />
    </button>
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

function WhyPanel({ r }: { r: ScanStock }) {
  return (
    <div style={{ margin: '4px 0 0', padding: '10px 14px', background: 'var(--accent-glow)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {buildWhyTags(r).map((t) => (
        <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '3px 9px', borderRadius: 100, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--accent)' }}>{t}</span>
      ))}
    </div>
  )
}

// ── Highlight-tier row (reused for both the Highlight section and inline expand) ──

function RowExpandable({ r, watched, isPosition, highlight, onBookmark, expanded, onToggle }: {
  r: ScanStock; watched: boolean; isPosition: boolean; highlight: boolean
  onBookmark: () => void; expanded: boolean; onToggle: () => void
}) {
  return (
    <div>
      <ScanCardWrapper isVani={highlight} symbol={r.symbol} onClick={onToggle}>
        <BookmarkStar active={watched} onClick={onBookmark} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{displaySymbol(r)}</span>
            <CardExchangeBadge exchange={r.exchange} />
            {isPosition && <Tag color="var(--bull)" bg="var(--bull-bg)">Position</Tag>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name}</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {BREAKOUT_SURGE_DISPLAY_FIELDS.slice(0, 4).map((f) => (
            <div key={f.key} style={{ width: 66, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{fmtField(r, f)}</div>
          ))}
        </div>
        {highlight && <VaniBadge />}
      </ScanCardWrapper>
      {expanded && <WhyPanel r={r} />}
    </div>
  )
}

function Tag({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color, background: bg, borderRadius: 4, padding: '2px 6px' }}>{children}</span>
}

// ── Table view — real header row, click-to-sort ──

function TableView({ rows, sortKey, sortDir, onSort, bookmarkedIds, isPosition, onBookmark, expandedId, onExpand }: {
  rows: ScanStock[]; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void
  bookmarkedIds: Set<number>; isPosition: (id: number) => boolean; onBookmark: (id: number) => void
  expandedId: number | null; onExpand: (id: number | null) => void
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--card-soft)' }}>
        <div style={{ width: 22, flexShrink: 0 }} />
        <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Symbol</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {BREAKOUT_SURGE_DISPLAY_FIELDS.map((f) => (
            <button key={f.key} onClick={() => onSort(f.key)} style={{
              width: 78, textAlign: 'right', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase',
              color: sortKey === f.key ? 'var(--accent)' : 'var(--text-faint)', fontWeight: sortKey === f.key ? 700 : 500,
            }}>{f.label}{sortKey === f.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}</button>
          ))}
        </div>
      </div>
      {rows.map((r) => {
        const expanded = expandedId === r.equity_id
        return (
          <div key={r.equity_id}>
            <div onClick={() => onExpand(expanded ? null : r.equity_id)} style={{
              display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer',
              borderBottom: '1px solid var(--border)', background: expanded ? 'var(--accent-glow)' : 'transparent',
            }}>
              <div style={{ width: 22, flexShrink: 0 }}><BookmarkStar active={bookmarkedIds.has(r.equity_id)} onClick={() => onBookmark(r.equity_id)} /></div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {isHighlight(r) && <span style={{ color: 'var(--gold)', fontSize: 12 }}>✦</span>}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{displaySymbol(r)}</span>
                <CardExchangeBadge exchange={r.exchange} />
                {isPosition(r.equity_id) && <Tag color="var(--bull)" bg="var(--bull-bg)">Position</Tag>}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {BREAKOUT_SURGE_DISPLAY_FIELDS.map((f) => (
                  <div key={f.key} style={{
                    width: 78, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5,
                    color: f.key === 'pct_chng' ? ((r.pct_chng ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)') : 'var(--text-secondary)',
                  }}>{fmtField(r, f)}</div>
                ))}
              </div>
            </div>
            {expanded && <div style={{ padding: '0 14px 10px' }}><WhyPanel r={r} /></div>}
          </div>
        )
      })}
    </div>
  )
}

// ── Cards view — a real grid, vertically-stacked content, not the table restacked ──

function CardView({ r, watched, isPosition, highlight, onBookmark, expanded, onToggle }: {
  r: ScanStock; watched: boolean; isPosition: boolean; highlight: boolean
  onBookmark: () => void; expanded: boolean; onToggle: () => void
}) {
  return (
    <div style={{
      background: highlight ? 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 8%, transparent) 0%, var(--card) 55%)' : 'var(--card)',
      border: '1px solid var(--border)', borderLeft: highlight ? '3px solid var(--gold)' : '1px solid var(--border)',
      borderRadius: 12, padding: '13px 14px', cursor: 'pointer',
    }} onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{displaySymbol(r)}</span>
            {highlight && <span style={{ color: 'var(--gold)', fontSize: 12 }}>✦</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{r.company_name}</div>
        </div>
        <BookmarkStar active={watched} onClick={onBookmark} />
      </div>
      {isPosition && <div style={{ marginBottom: 8 }}><Tag color="var(--bull)" bg="var(--bull-bg)">Position</Tag></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
        {BREAKOUT_SURGE_DISPLAY_FIELDS.slice(0, 4).map((f) => (
          <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.label}</span>
            <span style={{ color: f.key === 'pct_chng' ? ((r.pct_chng ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)') : 'var(--text-secondary)' }}>{fmtField(r, f)}</span>
          </div>
        ))}
      </div>
      {expanded && <div style={{ marginTop: 10 }}><WhyPanel r={r} /></div>}
    </div>
  )
}
