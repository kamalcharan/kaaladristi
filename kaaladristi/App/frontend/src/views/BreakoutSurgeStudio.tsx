import { useEffect, useState } from 'react'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { CardExchangeBadge, ScanCardWrapper, ScanSectionLabel, VaniBadge } from '@/components/domain/ScanCardShell'
import { BREAKOUT_SURGE_DISPLAY_FIELDS, BREAKOUT_SURGE_DEFAULT_SORT } from '@/services/breakoutSurgeSpec'
import { computeCohortStats, isHighlight, buildWhyTags } from '@/services/breakoutSurgeInsights'
import type { ScanStock } from '@/types'

/**
 * Phase 1 — cohort stat strip, VaNi Highlight tier surfaced first, watchlist/
 * position badges, Table/Cards toggle with curated fields, per-row inline
 * "why" expand. All facts below are deterministic (no LLM call yet) — see
 * docs/claude/breakout-surge-vani-poa.md Phase 2 for VaNi narration itself.
 * Still the same real useScan() data path from Phase 0.
 */
export default function BreakoutSurgeStudio() {
  const [exchangeFilter] = useState<ExchangeFilter>('combined')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: rows, isLoading, error } = useScan('breakout_surge', exchangeFilter)
  const { bookmarks, bookmarkedIds, load: loadBookmarks } = useBookmarkStore()
  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const meta = getPresetMeta('breakout_surge')
  const all = rows ?? []
  const stats = computeCohortStats(all)

  const dir = BREAKOUT_SURGE_DEFAULT_SORT.dir === 'desc' ? -1 : 1
  const byScore = (a: ScanStock, b: ScanStock) =>
    (((a[BREAKOUT_SURGE_DEFAULT_SORT.key] as number | null) ?? 0) -
     ((b[BREAKOUT_SURGE_DEFAULT_SORT.key] as number | null) ?? 0)) * dir

  const highlights = all.filter(isHighlight).sort(byScore)
  const sorted = all.slice().sort(byScore)

  const isPosition = (equityId: number) =>
    bookmarks.some((b) => b.equity_id === equityId && b.entry_price != null)

  const fmt = (r: ScanStock, key: keyof ScanStock, format: string) => {
    const v = r[key]
    if (v == null) return '—'
    if (format === 'pct') return `${(v as number) > 0 ? '+' : ''}${(v as number).toFixed(2)}%`
    if (format === 'price') return `₹${(v as number).toFixed(2)}`
    if (format === 'multiplier') return `${(v as number).toFixed(2)}×`
    if (format === 'score') return typeof v === 'number' ? v.toFixed(1) : String(v)
    return String(v)
  }

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        Preview · Phase 1
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, margin: '0 0 6px', color: 'var(--text-primary)' }}>
        {meta?.name ?? 'Breakout Surge'}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.55, marginBottom: 22 }}>
        {meta?.description}
      </p>

      {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading real scan results…</p>}
      {error && <p style={{ color: 'var(--bear)' }}>Failed to load: {(error as Error).message}</p>}

      {!isLoading && !error && (
        <>
          {/* ── Cohort summary strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
            <StatTile label="Broke Out Today" value={String(stats.brokeOutCount)} />
            <StatTile label="VaNi Highlights" value={String(stats.highlightCount)} accent="gold" sub={`of ${stats.brokeOutCount}`} />
            <StatTile label="Accelerating" value={`${stats.acceleratingPct}%`} sub="5D ≥ 22D pace" />
            <StatTile label="Real Volume Behind" value={`${stats.realVolumePct}%`} sub="RVOL > 3×" />
            <StatTile label="Leading Industry" value={stats.leadingIndustry?.name ?? '—'} sub={stats.leadingIndustry ? `${stats.leadingIndustry.count} names` : undefined} />
            <StatTile
              label="Your Watchlist"
              value={String(all.filter((r) => bookmarkedIds.has(r.equity_id)).length)}
              accent="green" sub="already tracking"
            />
          </div>

          {/* ── VaNi Highlight tier ── */}
          {highlights.length > 0 && (
            <>
              <ScanSectionLabel>✦ VaNi Highlight · {highlights.length}</ScanSectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 26 }}>
                {highlights.map((r) => (
                  <RowCard key={r.equity_id} r={r} fmt={fmt} isPosition={isPosition(r.equity_id)}
                    watched={bookmarkedIds.has(r.equity_id)} highlight
                    expanded={expandedId === r.equity_id}
                    onToggle={() => setExpandedId((id) => (id === r.equity_id ? null : r.equity_id))} />
                ))}
              </div>
            </>
          )}

          {/* ── All results ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map((r) => (
              <RowCard key={r.equity_id} r={r} fmt={fmt} isPosition={isPosition(r.equity_id)}
                watched={bookmarkedIds.has(r.equity_id)} highlight={isHighlight(r)}
                compact={viewMode === 'cards'}
                expanded={expandedId === r.equity_id}
                onToggle={() => setExpandedId((id) => (id === r.equity_id ? null : r.equity_id))} />
            ))}
          </div>
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

function RowCard({ r, fmt, watched, isPosition, highlight, compact, expanded, onToggle }: {
  r: ScanStock
  fmt: (r: ScanStock, key: keyof ScanStock, format: string) => string
  watched: boolean
  isPosition: boolean
  highlight: boolean
  compact?: boolean
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div>
    <ScanCardWrapper isVani={highlight} symbol={r.symbol} onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: compact ? undefined : 1.4 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{displaySymbol(r)}</span>
            <CardExchangeBadge exchange={r.exchange} />
            {isPosition && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--bull)', background: 'var(--bull-bg)', borderRadius: 4, padding: '2px 6px' }}>Position</span>
            )}
            {!isPosition && watched && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--caution)', background: 'var(--caution-bg)', borderRadius: 4, padding: '2px 6px' }}>Watchlist</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name}</div>
        </div>
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 18, flex: 1, justifyContent: 'flex-end' }}>
          {BREAKOUT_SURGE_DISPLAY_FIELDS.map((f) => (
            <div key={f.key} style={{ width: 76, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {fmt(r, f.key, f.format)}
            </div>
          ))}
        </div>
      )}
      {compact && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <span>{fmt(r, 'close', 'price')}</span>
          <span style={{ color: (r.pct_chng ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)' }}>{fmt(r, 'pct_chng', 'pct')}</span>
          <span>{fmt(r, 'score_5d', 'score')}</span>
        </div>
      )}
      {highlight && <VaniBadge />}
    </ScanCardWrapper>
    {expanded && (
      <div style={{ margin: '4px 0 0 14px', padding: '10px 14px', background: 'var(--accent-glow)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {buildWhyTags(r).map((t) => (
          <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '3px 9px', borderRadius: 100, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--accent)' }}>{t}</span>
        ))}
      </div>
    )}
    </div>
  )
}
