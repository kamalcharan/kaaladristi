import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { DownloadXlsButton, TradingViewExportButton } from '@/components/domain/ScannerExportButtons'
import { ExchangeTabs } from '@/components/domain/ExchangeTabs'
import { ScanFilterBar, applyFilters, DEFAULT_FILTERS, hasActiveFilters, type ScanFilters } from '@/components/domain/ScanFilterBar'
import { computeCohortStats, computeHighlightExplainFacts, isHighlight, type CohortStats } from '@/services/breakoutSurgeInsights'
import ScanTable from '@/components/domain/ScanTable'
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable'
import ScanVaNiPublisher, { toVaNiScanRows } from '@/components/domain/ScanVaNiPublisher'
import VaNiInsight from '@/components/domain/VaNiInsight'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
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
  // The results table sits well below the VaNi card (past the stat-tile
  // grid + the card itself). Clicking "Start with the N Highlights →"
  // applies the filter correctly, but with no visible change anywhere near
  // the click — reads as "nothing happens" unless the user scrolls down on
  // their own. Scroll the results section into view on click so the
  // (now-filtered) table is what they see next.
  const resultsRef = useRef<HTMLDivElement>(null)
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

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
        overflow far more often than production for the same column set.
        Padding itself is now responsive (Tailwind, not inline — dynamic
        inline padding isn't needed here, so plain classes suffice and stay
        simpler): 32px sides wastes ~17% of a 375px phone's width. */}
    <div className="px-4 pt-7 pb-12 sm:px-6 md:px-8">
      {/* This page now renders inside ScanView's shell (left category rail +
          within-category tab strip, both scoped to price_action's 9
          siblings) — see ScanView.tsx's breakout_surge branch. It used to be
          a standalone route with no shell of its own and a flat "Other
          scanners" pill row listing all ~22 presets across every category as
          a stopgap; that's gone now that the real navigation (rail + tabs)
          is present. */}
      {/* flexWrap added — the export buttons are flexShrink:0 (won't shrink)
          and on a narrow screen the pair alone can be wider than the
          available width; without wrap they'd overflow past the edge with
          no way to scroll back to them (body{overflow-x:hidden}, no local
          scroll region here). Now they drop to their own row instead. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
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
              allStocks={all}
              totalCount={all.length}
              dataDate={all[0]?.trade_date ?? null}
              exchangeFilter={exchangeFilter}
              cohortStats={stats}
              onApplyHighlights={() => { setQuick((p) => ({ ...p, hl: true })); scrollToResults() }}
              onApplyWatchlist={() => { setQuick((p) => ({ ...p, watch: true })); scrollToResults() }}
            />
          )}

          {/* ── Exchange + quick toggles (no ScanFilterBar equivalent) + real filter bar + view toggle ── */}
          {/* scrollMarginTop clears Layout.tsx's sticky topbar (~76px tall)
              so scrollIntoView doesn't land this row underneath it. */}
          <div ref={resultsRef} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8, scrollMarginTop: 88 }}>
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
 * On-page VaNi card — fourth pass. v8/v9 reinvented VaNiInsight's rendering;
 * v10 deleted the card entirely; v11 restored it correctly (rendering-wise)
 * but still routed "What does this screener show?" through
 * `openWithIntent()`, which opens the header drawer — exactly the thing the
 * owner said not to do ("existing VaNi space should be used rather than
 * right draw"). v11 also silently dropped the `collapsible` prop while
 * rebuilding this file, so the long-response truncation from
 * `vani-common-component.md` was live in the component but never wired up
 * here — both fixed now.
 *
 * v13 (owner-specified intent set): five intents now render in THIS card,
 * swapped in place by local state — no drawer involved for any of them.
 * Each gets its own `useVaNiAsk()` instance so switching back and forth
 * never refetches or drops a sibling's already-fetched answer.
 *   - `scanner.read_results` ("Today's Results") — fires eagerly, unchanged.
 *   - `scanner.your_view` ("Your View") — the owner's 1st-priority intent:
 *     the user's own bookmarked stocks in today's results (lead item),
 *     the biggest 5D-vs-22D acceleration names, and the VaNi-highlight
 *     count. Bookmarks/accelerators are computed client-side from data this
 *     page already has (bookmarkStore + score_5d/score_22d) — no new fetch.
 *     Fires lazily on first click, like explain_preset.
 *   - `scanner.explain_preset` ("How to use this scanner", relabeled from
 *     "What does this screener show?") — unchanged mechanics.
 *   - `scanner.how_bookmarks_work` / `scanner.legend_vani_dot` — universal
 *     glossary answers, pre-seeded into km_vani_cache via the admin
 *     `POST /api/vani/warm-help-intents` endpoint so these never invoke the
 *     LLM live; still real intents through the same ask/cache path.
 *
 * v16 — `scanner.why_highlighted`, fired by "Start with the N Highlights →"
 * itself (in addition to its existing filter-apply + scroll, not instead of
 * it). Owner's push-back on the original filter-only button: "VaNi intent
 * is for explanation — tell why those 15 are picked to be highlighted."
 * Grounded in `computeHighlightExplainFacts()` (breakoutSurgeInsights.ts) —
 * real per-stock numbers over the full day's highlighted cohort (avg RVOL,
 * avg closeness to 52-week high, avg RS, 1-2 named examples ranked by
 * RVOL) — NOT the generic "reward-to-risk vs ATR" story `legend_vani_dot`
 * used to tell, which turned out to be flatly wrong for this preset (its
 * real gate, `is_vani_surge_or_breakout`, is volume + 52-week-high
 * proximity + RS, see backfill_vani_flags.py). Caps at 1-2 named stocks,
 * same convention as every other intent on this page.
 *
 * v17 — "My Watchlist" had the same filter-only gap "Start with the N
 * Highlights" had before v16: it applied the `watch` filter and scrolled,
 * but fired nothing VaNi. Fixed the same way — its `onClick` now also calls
 * `showYourView()`, reusing the EXISTING `scanner.your_view` intent (it
 * already covers "your bookmarked stocks in today's results" precisely, so
 * no new intent was needed). v17 also adds `useMinVaNiLoading()`: floors
 * the "Consulting VaNi…" spinner at `MIN_VANI_LOADING_MS` (700ms)
 * regardless of how fast the real response arrives, so a cache hit
 * (near-instant) and a live LLM call (a couple of seconds) both feel like a
 * deliberate pause instead of one popping content in abruptly. Content is
 * withheld while the floor is still holding, not just the spinner shown
 * early — otherwise text could flash in before the hold period ends.
 *
 * Deliberately NOT built this round (see docs/claude/breakout-surge-vani-poa.md
 * v13): "new since yesterday" — day-over-day scan-membership tracking
 * (Tier B, scannerenhancement.md) doesn't exist yet, so "Your View" can't
 * surface newly-appeared stocks.
 */
type ScannerIntentKey = 'read_results' | 'your_view' | 'explain_preset' | 'why_highlighted' | 'how_bookmarks_work' | 'legend_vani_dot'

/**
 * Floors how long the "Consulting VaNi…" spinner shows at MIN_VANI_LOADING_MS,
 * regardless of how fast the real request resolves. A cache hit (the two
 * glossary intents, or any repeat ask) can come back in well under 100ms —
 * with no floor, the spinner would flash or not appear at all while a live
 * LLM call takes a couple of seconds, an inconsistent feel depending on
 * something the user has no way to know (cached vs. freshly generated).
 * Genuinely slow calls are unaffected: if `isPending` is still true once
 * MIN_VANI_LOADING_MS has passed, this just reflects that real state.
 */
const MIN_VANI_LOADING_MS = 700

function useMinVaNiLoading(isPending: boolean): boolean {
  const [holding, setHolding] = useState(isPending)
  const startedAt = useRef(0)
  useEffect(() => {
    if (isPending) {
      startedAt.current = Date.now()
      setHolding(true)
      return
    }
    const remaining = Math.max(0, MIN_VANI_LOADING_MS - (Date.now() - startedAt.current))
    const t = setTimeout(() => setHolding(false), remaining)
    return () => clearTimeout(t)
  }, [isPending])
  return holding
}

function ScannerVaNiCard({
  presetId, meta, rowsForContext, allStocks, totalCount, dataDate, exchangeFilter, cohortStats, onApplyHighlights, onApplyWatchlist,
}: {
  presetId: string
  meta: ScanDefinition
  rowsForContext: ScanStock[]
  /** Full day's cohort, unfiltered — scanner.why_highlighted's facts must
   *  cover every highlighted stock today, not whatever's currently filtered
   *  into view (matches cohortStats' scope, computed the same way). */
  allStocks: ScanStock[]
  totalCount: number
  dataDate: string | null
  exchangeFilter: ExchangeFilter
  cohortStats: CohortStats
  onApplyHighlights: () => void
  onApplyWatchlist: () => void
}) {
  // One useVaNiAsk() instance per intent so switching pills never refetches
  // or loses a sibling intent's already-fetched answer.
  const readMutation = useVaNiAsk()
  const yourViewMutation = useVaNiAsk()
  const explainMutation = useVaNiAsk()
  const whyHighlightedMutation = useVaNiAsk()
  const bookmarksHelpMutation = useVaNiAsk()
  const dotHelpMutation = useVaNiAsk()
  const firedForDate = useRef<string | null>(null)
  const [activeIntent, setActiveIntent] = useState<ScannerIntentKey>('read_results')
  const { bookmarkedIds } = useBookmarkStore()

  const hideVani = meta.vani_rule === 'always_true'

  // Personalization inputs for "Your view" — computed from data the page
  // already has (bookmark store + score_5d/score_22d already on every row),
  // no new fetch. Acceleration mirrors ScanFilterBar's own `accelerating`
  // gate: 5-day score positive AND ahead of the 22-day score.
  const bookmarkedSymbols = rowsForContext
    .filter((r) => bookmarkedIds.has(r.equity_id))
    .map((r) => displaySymbol(r))
  const topAccelerators = [...rowsForContext]
    .filter((r) => (r.score_5d ?? 0) > 0 && (r.score_5d ?? 0) > (r.score_22d ?? 0))
    .map((r) => ({ symbol: displaySymbol(r), delta: (r.score_5d ?? 0) - (r.score_22d ?? 0) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)

  const cohortStatsPayload = hideVani ? undefined : {
    vani_highlight_count: cohortStats.highlightCount,
    accelerating_pct: cohortStats.acceleratingPct,
    real_volume_pct: cohortStats.realVolumePct,
    leading_industry: cohortStats.leadingIndustry?.name ?? null,
    leading_industry_count: cohortStats.leadingIndustry?.count ?? null,
  }

  useEffect(() => {
    if (!dataDate || firedForDate.current === dataDate) return
    firedForDate.current = dataDate
    const rows = toVaNiScanRows(rowsForContext, hideVani)
    readMutation.mutate({
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
      ...(cohortStatsPayload ? { cohort_stats: cohortStatsPayload } : {}),
    })
    // rowsForContext/cohortStats/etc. intentionally excluded — fires once
    // per new trading day's data, not on every filter/sort change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataDate])

  // Real bug, found live (2026-09-02): this block — and its two
  // useMinVaNiLoading() calls — used to sit AFTER the `if (!dataDate)
  // return null` below. On the render where dataDate is still null (before
  // the scan query resolves) those two hooks were never called at all; on
  // the very next render, once dataDate is set, they suddenly are — a
  // classic "rendered fewer hooks than expected" violation, since React
  // requires the exact same hooks in the exact same order on every render
  // of a component. That's not a lint nitpick: React throws when the count
  // changes, unmounting this component (and, since nothing local catches
  // it, crashing up to the app's top-level ErrorBoundary) on essentially
  // every real visit, the moment scan data arrives. Moved above the early
  // return so every hook call is unconditional regardless of dataDate.
  const mutationByIntent: Record<ScannerIntentKey, ReturnType<typeof useVaNiAsk>> = {
    read_results: readMutation,
    your_view: yourViewMutation,
    explain_preset: explainMutation,
    why_highlighted: whyHighlightedMutation,
    how_bookmarks_work: bookmarksHelpMutation,
    legend_vani_dot: dotHelpMutation,
  }
  const active = mutationByIntent[activeIntent]
  // Floors the spinner at MIN_VANI_LOADING_MS so a cache hit doesn't pop
  // content in instantly while a live LLM call visibly takes longer — see
  // useMinVaNiLoading's own comment. Content is withheld while holding so
  // it can't flash in before the floor elapses. readMutation gets its own
  // call (rather than reusing `showLoading` below) since it fires eagerly
  // on load regardless of which intent is currently selected — the action
  // pills below should wait for that same floor too, not just the card.
  const readShowLoading = useMinVaNiLoading(readMutation.isPending)
  const readDone = !readShowLoading && !!readMutation.data?.response
  const showLoading = useMinVaNiLoading(active.isPending)

  if (!dataDate) return null

  const showYourView = () => {
    setActiveIntent('your_view')
    if (!yourViewMutation.data && !yourViewMutation.isPending) {
      const rows = toVaNiScanRows(rowsForContext, hideVani)
      yourViewMutation.mutate({
        intent_id: 'scanner.your_view',
        preset_id: presetId,
        data_date: dataDate,
        timeframe: 'daily',
        exchange: exchangeFilter,
        total_count: totalCount,
        rows: rows.map((r) => ({
          symbol: r.symbol, industry: r.industry, zone: r.zone, flow: r.flow,
          rsi: r.rsi, rvol: r.rvol, pct_chng: r.pctChng, surge: r.surge, vani: r.vani,
        })),
        bookmarked_symbols: bookmarkedSymbols,
        top_accelerators: topAccelerators,
        ...(cohortStatsPayload ? { cohort_stats: cohortStatsPayload } : {}),
      })
    }
  }

  const showExplain = () => {
    setActiveIntent('explain_preset')
    if (!explainMutation.data && !explainMutation.isPending) {
      explainMutation.mutate({
        intent_id: 'scanner.explain_preset',
        preset_id: presetId,
        data_date: dataDate,
        timeframe: 'daily',
        exchange: exchangeFilter,
      })
    }
  }

  // Fired by the "Start with the N Highlights →" pill, alongside (not
  // instead of) its existing filter-apply + scroll — the button both DOES
  // something (filters the table) and now EXPLAINS something (why those N
  // stocks earned the flag), grounded in this cohort's real numbers via
  // computeHighlightExplainFacts(), never a generic "reward:risk" story
  // (that mechanism belongs to a different vani_rule, not this preset's).
  const showWhyHighlighted = () => {
    setActiveIntent('why_highlighted')
    if (!whyHighlightedMutation.data && !whyHighlightedMutation.isPending) {
      const facts = computeHighlightExplainFacts(allStocks)
      whyHighlightedMutation.mutate({
        intent_id: 'scanner.why_highlighted',
        preset_id: presetId,
        data_date: dataDate,
        timeframe: 'daily',
        exchange: exchangeFilter,
        highlight_facts: {
          count: facts.count,
          avg_rvol: facts.avgRvol,
          avg_pct_of_52w_high: facts.avgPctOf52wHigh,
          avg_magic_rs: facts.avgMagicRs,
          examples: facts.examples.map((e) => ({
            symbol: e.symbol, rvol: e.rvol, pct_of_52w_high: e.pctOf52wHigh, magic_rs: e.magicRs,
          })),
        },
      })
    }
  }

  // How-bookmarks-work / What's-the-dot are universal glossary answers,
  // pre-seeded into km_vani_cache (POST /api/vani/warm-help-intents) so
  // these calls hit cache, not the LLM — still a real intent_id/rows-through
  // request, just answered from a pre-baked row (see vani_intents.py).
  const showBookmarksHelp = () => {
    setActiveIntent('how_bookmarks_work')
    if (!bookmarksHelpMutation.data && !bookmarksHelpMutation.isPending) {
      bookmarksHelpMutation.mutate({
        intent_id: 'scanner.how_bookmarks_work',
        preset_id: presetId,
        data_date: dataDate,
        timeframe: 'daily',
        exchange: exchangeFilter,
      })
    }
  }

  const showDotHelp = () => {
    setActiveIntent('legend_vani_dot')
    if (!dotHelpMutation.data && !dotHelpMutation.isPending) {
      dotHelpMutation.mutate({
        intent_id: 'scanner.legend_vani_dot',
        preset_id: presetId,
        data_date: dataDate,
        timeframe: 'daily',
        exchange: exchangeFilter,
      })
    }
  }

  // `whiteSpace: 'nowrap'` here used to force every pill onto one line —
  // harmless on desktop, but on a narrow viewport a single long label (e.g.
  // "How do bookmarks work?") can be wider than the row itself. flex-wrap
  // only wraps BETWEEN items, so a too-wide nowrap item overflows its row —
  // and since `body { overflow-x: hidden }` is a global reset with no local
  // scroll affordance here, that overflow was invisibly clipped rather than
  // scrollable (the "Toda[y's Results]" cut-off bug). `maxWidth: '100%'`
  // caps a pill at its row's own width; normal whiteSpace lets a label that
  // doesn't fit wrap onto a second line inside the pill instead of vanishing
  // off the edge — worse-looking in the rare case, but text is never lost.
  const pillStyle: React.CSSProperties = {
    border: '1px solid var(--border-indigo)', color: 'var(--indigo)', background: 'transparent',
    borderRadius: 100, padding: '6px 13px', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-body)', maxWidth: '100%',
  }
  const activePillStyle: React.CSSProperties = { ...pillStyle, background: 'var(--indigo-bg)', fontWeight: 700 }
  // Omit `color` from the spread here (destructured out, not overridden):
  // pillStyle sets `color: var(--indigo)` inline, and an inline `style`
  // prop always wins over a class for the same CSS property no matter the
  // class — so the button's `className="text-white"` was silently losing
  // to this inherited color, rendering indigo text on an indigo background
  // (invisible label, not a missing or clipped one). Dropping the inherited
  // color lets `text-white` actually apply instead of fighting it.
  const { color: _pillTextColor, ...pillShape } = pillStyle
  const primaryPillStyle: React.CSSProperties = { ...pillShape, background: 'var(--indigo)', border: 'none', fontWeight: 600 }
  const helpPillStyle: React.CSSProperties = { ...pillStyle, fontSize: 11.5, opacity: 0.85 }
  const activeHelpPillStyle: React.CSSProperties = { ...activePillStyle, fontSize: 11.5 }

  return (
    <div style={{ marginBottom: 18 }}>
      <VaNiInsight
        insight={showLoading ? undefined : active.data?.response}
        isLoading={showLoading}
        logId={showLoading ? undefined : (active.data?.log_id ?? undefined)}
        collapsible
        collapsedHeight={110}
        className="mt-0"
      />
      {readDone && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {cohortStats.highlightCount > 0 && (
            <button onClick={() => { onApplyHighlights(); showWhyHighlighted() }} className="text-white" style={primaryPillStyle}>
              Start with the {cohortStats.highlightCount} Highlights →
            </button>
          )}
          <button onClick={() => setActiveIntent('read_results')} style={activeIntent === 'read_results' ? activePillStyle : pillStyle}>
            Today's Results
          </button>
          <button onClick={showYourView} style={activeIntent === 'your_view' ? activePillStyle : pillStyle}>
            Your View
          </button>
          <button onClick={showExplain} style={activeIntent === 'explain_preset' ? activePillStyle : pillStyle}>
            How to use this scanner
          </button>
          {/* Was filter-only (same gap the Highlights button had before
              why_highlighted) — now also fires scanner.your_view, which
              already covers exactly this: the user's own bookmarked stocks
              in today's results. No new intent needed, it already existed. */}
          <button onClick={() => { onApplyWatchlist(); showYourView() }} style={activeIntent === 'your_view' ? activePillStyle : pillStyle}>
            My Watchlist
          </button>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '2px 2px' }} />
          <button onClick={showBookmarksHelp} style={activeIntent === 'how_bookmarks_work' ? activeHelpPillStyle : helpPillStyle}>
            How do bookmarks work?
          </button>
          <button onClick={showDotHelp} style={activeIntent === 'legend_vani_dot' ? activeHelpPillStyle : helpPillStyle}>
            What's the highlight dot?
          </button>
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
