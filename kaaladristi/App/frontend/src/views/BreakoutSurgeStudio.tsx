import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { DownloadXlsButton, TradingViewExportButton } from '@/components/domain/ScannerExportButtons'
import { ExchangeTabs } from '@/components/domain/ExchangeTabs'
import { ScanFilterBar, applyFilters, DEFAULT_FILTERS, hasActiveFilters, type ScanFilters } from '@/components/domain/ScanFilterBar'
import {
  computeCohortStats, computeHighlightExplainFacts, computeMomentumGapFacts, computeLeadingIndustryFacts,
  computeSectorLeadingFacts, isHighlight, isAccelerating, type SectorLeadingFacts,
} from '@/services/breakoutSurgeInsights'
import ScanTable from '@/components/domain/ScanTable'
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable'
import ScanVaNiPublisher from '@/components/domain/ScanVaNiPublisher'
import VaNiInsight from '@/components/domain/VaNiInsight'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { useIndustryLeadershipMap } from '@/hooks/useIndustryRotation'
import type { ScanStock, ScanDefinition } from '@/types'

type QuickFilterKey = 'ob' | 'watch'
const DEFAULT_QUICK: Record<QuickFilterKey, boolean> = { ob: false, watch: false }

/**
 * The 7 predefined scanner-level VaNi questions from the "VaNi Two Levels"
 * design (owner, 2026-09-03) — a closed, NLP-phrased intent set replacing
 * the old ad-hoc pill row (Today's Results/Your View/How to use this
 * scanner/glossary). Shipping in phases (each phase ships only the intents
 * that are REALLY wired end-to-end — no disabled/"coming soon" pills):
 *   Phase 1 (shipped): momentum_gap, leading_industry, why_flagged — all
 *     computable from data this page already has, no new backend infra.
 *   Phase 2 (this round): sector_leading — a join to
 *     km_industry_eod.industry_rank (useIndustryLeadershipMap). Rendered
 *     only once that fetch resolves (its own loading state, separate from
 *     the scan query) — never a pill that does nothing yet.
 *   Phase 3: new_since_yesterday, rs_flip, is_unusual — need a new
 *     day-over-day scan-membership snapshot table + pipeline step, neither
 *     of which exist yet.
 */
type ScannerIntentKey = 'momentum_gap' | 'leading_industry' | 'why_flagged' | 'sector_leading'

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
  // Which VaNi-card question (if any) is currently driving the table below —
  // single source of truth shared between the stat tiles, the card's own
  // pill row, and the filter pipeline. Only one at a time, same as `quick`.
  const [scanIntent, setScanIntent] = useState<ScannerIntentKey | null>(null)
  // The results table sits well below the VaNi card (past the stat-tile
  // grid + the card itself). Selecting a VaNi question applies its filter
  // correctly, but with no visible change anywhere near the click — reads
  // as "nothing happens" unless the user scrolls down on their own. Scroll
  // the results section into view on select so the (now-filtered) table is
  // what they see next.
  const resultsRef = useRef<HTMLDivElement>(null)
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const { data: rows, isLoading, error } = useScan('breakout_surge', exchangeFilter)
  const { bookmarkedIds, load: loadBookmarks } = useBookmarkStore()
  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const meta = getPresetMeta('breakout_surge')
  const all = rows ?? []
  const stats = computeCohortStats(all)
  const dataDate = all[0]?.trade_date ?? null
  // Cross-screener Sector Rotation signal (industry_rank), fetched
  // separately from the scan query itself — its own loading state, since
  // it depends on knowing today's data date first.
  const { data: leadershipMap } = useIndustryLeadershipMap(dataDate)
  const sectorLeading = leadershipMap
    ? computeSectorLeadingFacts(all, leadershipMap.rankByIndustry, leadershipMap.leadingCutoff)
    : null

  let filtered = applyFilters(all, filters)
  if (scanIntent === 'why_flagged') {
    filtered = filtered.filter(isHighlight)
  } else if (scanIntent === 'momentum_gap') {
    filtered = filtered
      .filter(isAccelerating)
      .sort((a, b) => ((b.score_5d ?? 0) - (b.score_22d ?? 0)) - ((a.score_5d ?? 0) - (a.score_22d ?? 0)))
  } else if (scanIntent === 'leading_industry' && stats.leadingIndustry) {
    filtered = filtered.filter((r) => r.industry === stats.leadingIndustry!.name)
  } else if (scanIntent === 'sector_leading' && sectorLeading) {
    filtered = filtered.filter(sectorLeading.isSectorLeading)
  }
  if (quick.ob) filtered = filtered.filter((r) => (r.rsi_14 ?? 0) < 70)
  if (quick.watch) filtered = filtered.filter((r) => bookmarkedIds.has(r.equity_id))

  const toggleQuick = (key: QuickFilterKey) => setQuick((p) => ({ ...p, [key]: !p[key] }))
  const quickActiveCount = Object.values(quick).filter(Boolean).length
  const anyFilterActive = hasActiveFilters(filters) || quickActiveCount > 0 || scanIntent != null
  const clearAll = () => { setFilters(DEFAULT_FILTERS); setQuick(DEFAULT_QUICK); setScanIntent(null) }
  const selectScanIntent = (key: ScannerIntentKey) => {
    setScanIntent((p) => (p === key ? null : key))
    scrollToResults()
  }

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
              active={scanIntent === 'why_flagged'}
              onClick={() => selectScanIntent('why_flagged')}
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
              allStocks={all}
              dataDate={dataDate}
              exchangeFilter={exchangeFilter}
              scanIntent={scanIntent}
              onSelectIntent={selectScanIntent}
              sectorLeadingReady={!!sectorLeading}
              sectorLeadingFacts={sectorLeading?.facts ?? null}
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
 * On-page VaNi card — v18 (owner design correction, 2026-09-03, "VaNi Two
 * Levels" mockup): replaces the old ad-hoc pill set (Today's Results/Your
 * View/How to use this scanner/glossary pills) with the closed, NLP-phrased
 * 7-question set — see `ScannerIntentKey` above. No eager fire on load (the
 * old `scanner.read_results` auto-fired the moment data arrived); the card
 * now shows a plain placeholder until the user picks a question, matching
 * the mockup's own idle state exactly ("Pick a question above — I'll answer
 * in a couple of lines, then filter or highlight the table below to
 * match."). Each wired intent both fires a real LLM call AND applies its
 * own filter to the results table below (lifted into the parent's
 * `scanIntent` state so the stat tiles and the table filter pipeline share
 * one source of truth) — never a filter-only click with nothing explained,
 * the exact gap `scanner.why_highlighted` was built to close on the old
 * "Start with the N Highlights →" button.
 *
 * Only 3 of the 7 questions are wired this round (see the phase note on
 * `ScannerIntentKey` above) — the other 4 aren't rendered at all, not shown
 * disabled, until their backend/infra lands in a later round.
 */

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

/** The always-wired questions, in the same relative order the mockup's
 *  full 7 use (sector_leading is 2nd of 7, momentum_gap 3rd, leading_industry
 *  5th, why_flagged 6th) — so Phase 3 can insert new_since_yesterday/
 *  rs_flip/is_unusual into their correct slots without reordering these. */
const WIRED_INTENTS: { key: ScannerIntentKey; question: string }[] = [
  { key: 'momentum_gap', question: 'Stocks with a momentum gap' },
  { key: 'leading_industry', question: 'Which industry is leading this scan?' },
  { key: 'why_flagged', question: 'Why did VaNi flag these stocks?' },
]
const SECTOR_LEADING_INTENT: { key: ScannerIntentKey; question: string } =
  { key: 'sector_leading', question: "Which sectors' stocks are leading today?" }

function ScannerVaNiCard({
  presetId, meta, allStocks, dataDate, exchangeFilter, scanIntent, onSelectIntent,
  sectorLeadingReady, sectorLeadingFacts,
}: {
  presetId: string
  meta: ScanDefinition
  /** Full day's cohort, unfiltered — every intent's facts must cover the
   *  whole day, not whatever's currently filtered into the table below. */
  allStocks: ScanStock[]
  dataDate: string | null
  exchangeFilter: ExchangeFilter
  scanIntent: ScannerIntentKey | null
  onSelectIntent: (key: ScannerIntentKey) => void
  /** Whether useIndustryLeadershipMap has resolved — the "Which sectors'
   *  stocks are leading today?" pill only renders once true, never a click
   *  that does nothing yet. */
  sectorLeadingReady: boolean
  /** Computed once in the parent (shared with the table's own filter
   *  predicate) — passed through rather than recomputed here. */
  sectorLeadingFacts: SectorLeadingFacts | null
}) {
  // One useVaNiAsk() instance per intent so switching pills never refetches
  // or loses a sibling intent's already-fetched answer.
  const momentumGapMutation = useVaNiAsk()
  const leadingIndustryMutation = useVaNiAsk()
  const whyFlaggedMutation = useVaNiAsk()
  const sectorLeadingMutation = useVaNiAsk()
  const mutationByIntent: Record<ScannerIntentKey, ReturnType<typeof useVaNiAsk>> = {
    momentum_gap: momentumGapMutation,
    leading_industry: leadingIndustryMutation,
    why_flagged: whyFlaggedMutation,
    sector_leading: sectorLeadingMutation,
  }

  const askIntent = (key: ScannerIntentKey) => {
    onSelectIntent(key)
    const mutation = mutationByIntent[key]
    if (!dataDate || mutation.data || mutation.isPending) return
    if (key === 'momentum_gap') {
      const facts = computeMomentumGapFacts(allStocks)
      mutation.mutate({
        intent_id: 'scanner.momentum_gap', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        momentum_gap_facts: {
          count: facts.count, avg_gap: facts.avgGap,
          examples: facts.examples.map((e) => ({ symbol: e.symbol, gap: e.gap, score_5d: e.score5d, score_22d: e.score22d })),
        },
      })
    } else if (key === 'leading_industry') {
      const facts = computeLeadingIndustryFacts(allStocks)
      mutation.mutate({
        intent_id: 'scanner.leading_industry', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        leading_industry_facts: facts ? {
          name: facts.name, count: facts.count, total_count: facts.totalCount,
          runner_up: facts.runnerUp ? { name: facts.runnerUp.name, count: facts.runnerUp.count } : null,
        } : { name: '', count: 0, total_count: 0, runner_up: null },
      })
    } else if (key === 'why_flagged') {
      const facts = computeHighlightExplainFacts(allStocks)
      mutation.mutate({
        intent_id: 'scanner.why_highlighted', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        highlight_facts: {
          count: facts.count, avg_rvol: facts.avgRvol, avg_pct_of_52w_high: facts.avgPctOf52wHigh, avg_magic_rs: facts.avgMagicRs,
          examples: facts.examples.map((e) => ({ symbol: e.symbol, rvol: e.rvol, pct_of_52w_high: e.pctOf52wHigh, magic_rs: e.magicRs })),
        },
      })
    } else if (key === 'sector_leading' && sectorLeadingFacts) {
      mutation.mutate({
        intent_id: 'scanner.sector_leading', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        sector_leading_facts: {
          count: sectorLeadingFacts.count,
          industries: sectorLeadingFacts.industries.map((i) => ({ name: i.name, count: i.count })),
        },
      })
    }
  }

  const active = scanIntent ? mutationByIntent[scanIntent] : null
  // Floors the spinner at MIN_VANI_LOADING_MS so a cache hit doesn't pop
  // content in instantly while a live LLM call visibly takes longer — see
  // useMinVaNiLoading's own comment. Content is withheld while holding so
  // it can't flash in before the floor elapses. Hook must run unconditionally
  // (real bug fixed here previously: conditional hooks unmount this
  // component on the render where `active` briefly changes shape).
  const showLoading = useMinVaNiLoading(active?.isPending ?? false)

  if (!dataDate) return null

  const pillStyle: React.CSSProperties = {
    border: '1px solid var(--border-indigo)', color: 'var(--indigo)', background: 'transparent',
    borderRadius: 100, padding: '8px 14px', fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-body)', maxWidth: '100%', textAlign: 'left',
  }
  const activePillStyle: React.CSSProperties = { ...pillStyle, background: 'var(--indigo-bg)', fontWeight: 700 }
  // sector_leading slots in 2nd of 7 in the mockup's own ordering — ahead of
  // momentum_gap, not appended at the end of whatever's already wired.
  const visibleIntents = sectorLeadingReady
    ? [SECTOR_LEADING_INTENT, ...WIRED_INTENTS]
    : WIRED_INTENTS

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {visibleIntents.map((it) => (
          <button
            key={it.key}
            onClick={() => askIntent(it.key)}
            style={scanIntent === it.key ? activePillStyle : pillStyle}
          >
            {it.question}
          </button>
        ))}
      </div>
      {scanIntent ? (
        <VaNiInsight
          insight={showLoading ? undefined : active?.data?.response}
          isLoading={showLoading}
          logId={showLoading ? undefined : (active?.data?.log_id ?? undefined)}
          collapsible
          collapsedHeight={110}
          className="mt-0"
        />
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
          Pick a question above — VaNi answers in a couple of lines, then the table below filters to match.
        </p>
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
