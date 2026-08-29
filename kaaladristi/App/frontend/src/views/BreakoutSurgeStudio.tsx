import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { DownloadXlsButton, TradingViewExportButton } from '@/components/domain/ScannerExportButtons'
import { ExchangeTabs } from '@/components/domain/ExchangeTabs'
import { ScanFilterBar, applyFilters, DEFAULT_FILTERS, hasActiveFilters, type ScanFilters } from '@/components/domain/ScanFilterBar'
import { computeCohortStats, isHighlight, type CohortStats } from '@/services/breakoutSurgeInsights'
import ScanTable from '@/components/domain/ScanTable'
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable'
import ScanVaNiPublisher, { toVaNiScanRows } from '@/components/domain/ScanVaNiPublisher'
import VaNiInsight from '@/components/domain/VaNiInsight'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { useVaNiStore } from '@/stores/vaniStore'
import type { ScanStock, ScanDefinition } from '@/types'

type QuickFilterKey = 'hl' | 'ob' | 'watch'
const DEFAULT_QUICK: Record<QuickFilterKey, boolean> = { hl: false, ob: false, watch: false }

/**
 * Phase 1 (v4) — filtering now goes through the REAL ScanFilterBar
 * (MCap, Industry multi-select, Score 5D/22D min, Accelerating, RVOL Min,
 * % From Breakout Min/Max, 5D Move<) + its `applyFilters`/`DEFAULT_FILTERS`,
 * same as ScanTable/BreakoutSurgeCards in v3. A prior version hand-built an
 * "Industry" dropdown and stat-tile toggles for Accelerating/RVOL — both
 * duplicated controls ScanFilterBar already has. Those are gone; the stat
 * tiles for Accelerating and Real Volume Behind now drive the SAME
 * `filters.accelerating` / `filters.rvolMin` fields ScanFilterBar's own
 * inputs write to (one state, two affordances — not a second filter
 * mechanism). Only VaNi Highlights / Not overbought / Watchlist-only stay
 * as page-specific quick toggles, since none of those exist in
 * ScanFilterBar (bookmarks especially: real personalization, not something
 * to retrofit into the shared component).
 *
 * `DEFAULT_FILTERS` (`{ mcapMin: 100 }`) is what the real Scanner page also
 * opens with — this is why the real page reads ~243 rows, not 252: 252 is
 * the full unfiltered cohort (this page's "Broke Out Today" stat, which
 * intentionally always reflects the whole day, not the filtered view).
 *
 * v3→v4 also fixed a real bug: `isHighlight()` was reading
 * `r.is_vani_surge`/`r.is_vani_breakout`, raw DB flags scanEngine.ts never
 * copies onto the returned row (see breakoutSurgeInsights.ts) — VaNi
 * Highlights read 0 instead of the real ~15. Fixed to read
 * `r.vaniOpportunity`, the field that's actually populated.
 */
export default function BreakoutSurgeStudio() {
  const navigate = useNavigate()
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS)
  const [quick, setQuick] = useState<Record<QuickFilterKey, boolean>>(DEFAULT_QUICK)

  const { data: rows, isLoading, error } = useScan('breakout_surge', exchangeFilter)
  const { bookmarkedIds, load: loadBookmarks } = useBookmarkStore()
  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const meta = getPresetMeta('breakout_surge')
  const all = rows ?? []
  const stats = computeCohortStats(all)

  let filtered = applyFilters(all, filters)
  if (quick.hl) filtered = filtered.filter(isHighlight)
  if (quick.ob) filtered = filtered.filter((r) => (r.rsi_14 ?? 0) < 70)
  if (quick.watch) filtered = filtered.filter((r) => bookmarkedIds.has(r.equity_id))

  const toggleQuick = (key: QuickFilterKey) => setQuick((p) => ({ ...p, [key]: !p[key] }))
  const quickActiveCount = Object.values(quick).filter(Boolean).length
  const anyFilterActive = hasActiveFilters(filters) || quickActiveCount > 0
  const clearAll = () => { setFilters(DEFAULT_FILTERS); setQuick(DEFAULT_QUICK) }

  const onRowClick = (s: ScanStock) =>
    navigate(`/chart/equity/${s.equity_id}?name=${encodeURIComponent(displaySymbol(s))}&tab=chart&setup=breakout_surge`)

  return (
    <>
      {/* Phase 2 Tier A: publishes real cohort-level facts (computed over
          the FULL result set, not the 25-row sample scanner.read_results
          otherwise falls back to) so VaNi's "Read today's results" doesn't
          have to guess aggregate stats from a partial sample. This page had
          no ScanVaNiPublisher at all before — VaNi's stock-lookup gate and
          scanner intents had zero context here. */}
      {meta && (
        <ScanVaNiPublisher
          preset={meta}
          timeframe="daily"
          exchange={exchangeFilter}
          stocks={filtered}
          isLoading={isLoading}
          cohortStats={{
            vaniHighlightCount: stats.highlightCount,
            acceleratingPct: stats.acceleratingPct,
            realVolumePct: stats.realVolumePct,
            leadingIndustry: stats.leadingIndustry?.name ?? null,
            leadingIndustryCount: stats.leadingIndustry?.count ?? null,
          }}
        />
      )}
    {/* No maxWidth cap — ScanView.tsx's content area is unconstrained (just
        `flex: 1` + padding). A 1200px cap here made the table hit horizontal
        overflow far more often than production for the same column set. */}
    <div style={{ padding: '28px 32px 48px' }}>
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        Preview · Phase 2
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
          {/* ── Cohort summary strip — always reflects the FULL day's cohort (all
              252), not the filtered subset. Several tiles double as filter
              shortcuts into the shared filter state below. ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
            <StatTile
              label="Broke Out Today"
              value={String(stats.brokeOutCount)}
              onClick={anyFilterActive ? clearAll : undefined}
              title={anyFilterActive ? 'Click to clear all filters' : undefined}
            />
            <StatTile
              label="VaNi Highlights"
              value={String(stats.highlightCount)}
              accent="gold"
              sub={`of ${stats.brokeOutCount}`}
              active={quick.hl}
              onClick={() => toggleQuick('hl')}
            />
            <StatTile
              label="Accelerating"
              value={`${stats.acceleratingPct}%`}
              sub="5D ≥ 22D pace"
              active={!!filters.accelerating}
              onClick={() => setFilters((f) => ({ ...f, accelerating: f.accelerating ? undefined : true }))}
            />
            <StatTile
              label="Real Volume Behind"
              value={`${stats.realVolumePct}%`}
              sub="RVOL > 3×"
              active={filters.rvolMin != null}
              onClick={() => setFilters((f) => ({ ...f, rvolMin: f.rvolMin != null ? undefined : 3 }))}
            />
            <StatTile
              label="Leading Industry"
              value={stats.leadingIndustry?.name ?? '—'}
              sub={stats.leadingIndustry ? `${stats.leadingIndustry.count} names` : undefined}
              active={!!stats.leadingIndustry && (filters.industries?.length === 1) && filters.industries?.[0] === stats.leadingIndustry.name}
              onClick={stats.leadingIndustry ? () => {
                const name = stats.leadingIndustry!.name
                setFilters((f) => ({
                  ...f,
                  industries: f.industries?.length === 1 && f.industries[0] === name ? undefined : [name],
                }))
              } : undefined}
              title="Click to filter to this industry — or pick any industry from Filters below"
            />
            <StatTile
              label="Your Watchlist"
              value={String(all.filter((r) => bookmarkedIds.has(r.equity_id)).length)}
              accent="green"
              sub="already tracking"
              active={quick.watch}
              onClick={() => toggleQuick('watch')}
            />
          </div>

          {/* ── VaNi Read — on-page, always visible (owner call: users should
              SEE it, not have to open a drawer). Built entirely on VaNiInsight
              (the common component every VaNi surface now shares, see
              docs/claude/vani-common-component.md) — this file only owns the
              pill row's actions, not a second bespoke card. ── */}
          {meta && (
            <ScannerVaNiCard
              presetId="breakout_surge"
              meta={meta}
              rowsForContext={filtered}
              totalCount={all.length}
              dataDate={all[0]?.trade_date ?? null}
              exchangeFilter={exchangeFilter}
              cohortStats={stats}
              onApplyHighlights={() => setQuick((p) => ({ ...p, hl: true }))}
              onApplyWatchlist={() => setQuick((p) => ({ ...p, watch: true }))}
            />
          )}

          {/* ── Exchange + quick toggles (no ScanFilterBar equivalent) + real filter bar + view toggle ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={meta?.universe === 'NSE_ONLY' ? ['BSE'] : []} />
            <button onClick={() => toggleQuick('ob')} style={{
              padding: '6px 13px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${quick.ob ? 'var(--accent)' : 'var(--border)'}`,
              background: quick.ob ? 'var(--accent-glow)' : 'transparent',
              color: quick.ob ? 'var(--accent)' : 'var(--text-muted)',
            }}>Not overbought</button>

            <ScanFilterBar presetId="breakout_surge" stocks={all} filters={filters} onFiltersChange={setFilters} />

            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-faint)' }}>
              {filtered.length} shown
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
    </>
  )
}

/**
 * On-page VaNi card — third attempt at this, and the difference from the
 * first two matters: v8/v9 built a fully bespoke card (own header, own
 * loading state, own feedback wiring) that duplicated VaNiInsight; v10
 * deleted it entirely in favor of the header drawer only. Owner's actual
 * ask, once the "two kinds of UX" confusion got sorted out: an always-
 * visible on-page card IS wanted (users should see it, not click to open
 * it) — the fix was never "delete the card," it was "don't reinvent the
 * card's rendering." This component owns only the fetch (fires
 * `scanner.read_results` once per trading date, same Tier A `cohort_stats`
 * wired in earlier) and the pill row's page-specific actions (apply a
 * filter, or hand off to the drawer). All rendering — header, loading
 * state, body text, feedback — is `VaNiInsight`, unmodified.
 *
 * The pill row deliberately does NOT include "Why so many breakouts?" /
 * "Which to skip?" / "What changed vs yesterday?" from the reference
 * mockup — those need new backend VaNi intents (prompts, registration in
 * vani_intents.py) that don't exist yet. Faking buttons that don't do
 * anything real would be worse than not having them; real ones only:
 * apply the highlights filter, apply the watchlist filter, the one real
 * registered "explain this screener" intent (via the drawer), and a plain
 * hand-off to the drawer for anything else.
 */
function ScannerVaNiCard({
  presetId, meta, rowsForContext, totalCount, dataDate, exchangeFilter, cohortStats, onApplyHighlights, onApplyWatchlist,
}: {
  presetId: string
  meta: ScanDefinition
  rowsForContext: ScanStock[]
  totalCount: number
  dataDate: string | null
  exchangeFilter: ExchangeFilter
  cohortStats: CohortStats
  onApplyHighlights: () => void
  onApplyWatchlist: () => void
}) {
  const askMutation = useVaNiAsk()
  const firedForDate = useRef<string | null>(null)
  const { openWithIntent, toggle: toggleVaniPanel } = useVaNiStore()

  useEffect(() => {
    if (!dataDate || firedForDate.current === dataDate) return
    firedForDate.current = dataDate
    const hideVani = meta.vani_rule === 'always_true'
    const rows = toVaNiScanRows(rowsForContext, hideVani)
    askMutation.mutate({
      intent_id: 'scanner.read_results',
      preset_id: presetId,
      data_date: dataDate,
      timeframe: 'daily',
      exchange: exchangeFilter,
      total_count: totalCount,
      rows: rows.map((r) => ({
        symbol: r.symbol, industry: r.industry, zone: r.zone, flow: r.flow,
        rsi: r.rsi, rvol: r.rvol, pct_chng: r.pctChng, surge: r.surge, vani: r.vani,
      })),
      ...(hideVani ? {} : {
        cohort_stats: {
          vani_highlight_count: cohortStats.highlightCount,
          accelerating_pct: cohortStats.acceleratingPct,
          real_volume_pct: cohortStats.realVolumePct,
          leading_industry: cohortStats.leadingIndustry?.name ?? null,
          leading_industry_count: cohortStats.leadingIndustry?.count ?? null,
        },
      }),
    })
    // rowsForContext/cohortStats/etc. intentionally excluded — fires once
    // per new trading day's data, not on every filter/sort change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataDate])

  if (!dataDate) return null

  const done = !askMutation.isPending && !!askMutation.data?.response
  const pillStyle: React.CSSProperties = {
    border: '1px solid var(--border-indigo)', color: 'var(--indigo)', background: 'transparent',
    borderRadius: 100, padding: '6px 13px', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <VaNiInsight
        insight={askMutation.data?.response}
        isLoading={askMutation.isPending}
        logId={askMutation.data?.log_id ?? undefined}
        className="mt-0"
      />
      {done && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {cohortStats.highlightCount > 0 && (
            <button onClick={onApplyHighlights} className="text-white" style={{ ...pillStyle, background: 'var(--indigo)', border: 'none', fontWeight: 600 }}>
              Start with the {cohortStats.highlightCount} Highlights →
            </button>
          )}
          <button onClick={() => openWithIntent('scanner.explain_preset')} style={pillStyle}>What does this screener show?</button>
          <button onClick={onApplyWatchlist} style={pillStyle}>My Watchlist</button>
          <button onClick={toggleVaniPanel} style={pillStyle}>Ask a follow-up →</button>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, sub, accent, active, onClick, title }: {
  label: string; value: string; sub?: string; accent?: 'gold' | 'green'; active?: boolean; onClick?: () => void; title?: string
}) {
  const accentColor = accent === 'gold' ? 'var(--gold)' : accent === 'green' ? 'var(--bull)' : undefined
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      title={title}
      style={{
        background: accent ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, var(--card) 60%)` : 'var(--card)',
        border: `1px solid ${active ? 'var(--accent)' : accent ? `color-mix(in srgb, ${accentColor} 35%, transparent)` : 'var(--border)'}`,
        borderLeft: accent ? `3px solid ${accentColor}` : active ? '3px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 12, padding: '13px 15px', cursor: onClick ? 'pointer' : undefined,
        boxShadow: active ? '0 0 0 1px var(--accent)' : undefined,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.07em', textTransform: 'uppercase', color: accent ? accentColor : active ? 'var(--accent)' : 'var(--text-faint)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        {label}
        {active && <span style={{ color: 'var(--accent)' }}>●</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
        {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>{sub}</span>}
      </div>
    </div>
  )
}
