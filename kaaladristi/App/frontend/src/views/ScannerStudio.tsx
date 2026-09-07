import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useScan, useScanMembershipHistory } from '@/hooks/useScan'
import { displaySymbol } from '@/lib/symbolUtils'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { getPresetMeta, type ExchangeFilter } from '@/services/scanEngine'
import { DownloadXlsButton, TradingViewExportButton } from '@/components/domain/ScannerExportButtons'
import { ExchangeTabs } from '@/components/domain/ExchangeTabs'
import { ScanFilterBar, applyFilters, DEFAULT_FILTERS, hasActiveFilters, type ScanFilters } from '@/components/domain/ScanFilterBar'
import {
  computeCohortStats, computeMomentumGapFacts, computeLeadingIndustryFacts,
  computeSectorLeadingFacts, buildDayOverDayContext, computeNewSinceYesterdayFacts, computeRsFlipFacts,
  computeIsUnusualFacts, isHighlight, isAccelerating, gapAhead,
  type SectorLeadingFacts, type NewSinceYesterdayFacts, type RsFlipFacts, type IsUnusualFacts,
} from '@/services/breakoutSurgeInsights'
import ScanTable from '@/components/domain/ScanTable'
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable'
import ScanVaNiPublisher from '@/components/domain/ScanVaNiPublisher'
import ScanStalenessBanner from '@/components/domain/ScanStalenessBanner'
import AtmosphericBadge from '@/components/domain/AtmosphericBadge'
import { DristiQLoader } from '@/components/ui'
import VaNiFeedback from '@/components/domain/VaNi/VaNiFeedback'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { useIndustryLeadershipMap } from '@/hooks/useIndustryRotation'
import { getStudioDescriptor, type StudioDescriptor } from '@/config/scannerStudio'
import type { ScanStock, ScanDefinition } from '@/types'

type QuickFilterKey = 'ob' | 'watch'
const DEFAULT_QUICK: Record<QuickFilterKey, boolean> = { ob: false, watch: false }

/**
 * The 7 predefined scanner-level VaNi questions from the "VaNi Two Levels"
 * design (owner, 2026-09-03) — a closed, NLP-phrased intent set replacing
 * the old ad-hoc pill row (Today's Results/Your View/How to use this
 * scanner/glossary). Shipped in 3 phases (each phase ships only the intents
 * that are REALLY wired end-to-end — no disabled/"coming soon" pills):
 *   Phase 1: momentum_gap, leading_industry, why_flagged — all computable
 *     from data this page already has, no new backend infra.
 *   Phase 2: sector_leading — a join to km_industry_eod.industry_rank
 *     (useIndustryLeadershipMap).
 *   Phase 3 (this round): new_since_yesterday, rs_flip, is_unusual — need
 *     day-over-day scan-membership history (km_scan_membership_daily,
 *     migration 198 + the scan_membership_snapshot pipeline step,
 *     useScanMembershipHistory). All 3 render only once a prior-day
 *     snapshot exists to diff against (buildDayOverDayContext returns
 *     null-guarded facts otherwise) — on a fresh deploy, or the very first
 *     day the snapshot ran, none of the 3 show at all rather than lying
 *     ("252 new stocks" on day one). is_unusual additionally needs 3+
 *     prior sessions before it says anything (a minimum-sample floor).
 */
type ScannerIntentKey =
  | 'momentum_gap' | 'leading_industry' | 'why_flagged' | 'sector_leading'
  | 'new_since_yesterday' | 'rs_flip' | 'is_unusual'

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
/**
 * Renamed from BreakoutSurgeStudio (2026-09-05) and parameterised by preset.
 * The shell was already generic — the title reads `meta.name` from the DB, and
 * ScanTable / ScanFilterBar / useScanMembershipHistory all took a presetId
 * already. What was hardcoded was the preset ID itself (eight places) and the
 * handful of strings that encode what the scan MEANS. Those now come from
 * config/scannerStudio.ts's descriptor.
 *
 * `breakout_surge` is the control for this refactor: it must render
 * identically to before, which is what makes the change verifiable.
 */
export default function ScannerStudio({ presetId }: { presetId: string }) {
  const descriptor = getStudioDescriptor(presetId)
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

  const { data: rows, isLoading, error } = useScan(presetId, exchangeFilter)
  const { bookmarkedIds, load: loadBookmarks } = useBookmarkStore()
  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const meta = getPresetMeta(presetId)
  const all = rows ?? []
  const stats = computeCohortStats(all, descriptor?.pace)
  const dataDate = all[0]?.trade_date ?? null
  // Cross-screener Sector Rotation signal (industry_rank), fetched
  // separately from the scan query itself — its own loading state, since
  // it depends on knowing today's data date first.
  const { data: leadershipMap } = useIndustryLeadershipMap(dataDate)
  const sectorLeading = leadershipMap
    ? computeSectorLeadingFacts(all, leadershipMap.rankByIndustry, leadershipMap.leadingCutoff)
    : null
  // Phase 3 — day-over-day facts from km_scan_membership_daily, fetched
  // separately for the same reason (depends on knowing dataDate first).
  // null/undefined-safe throughout: buildDayOverDayContext handles an
  // empty/still-loading history array the same as "no prior snapshot yet".
  const { data: membershipHistory } = useScanMembershipHistory(presetId, dataDate, 10)
  const dayOverDay = buildDayOverDayContext(membershipHistory ?? [])
  const newSinceYesterday = computeNewSinceYesterdayFacts(all, dayOverDay)
  const rsFlip = computeRsFlipFacts(all, dayOverDay, descriptor?.rsFlip?.into)
  const isUnusual = computeIsUnusualFacts(all.length, dayOverDay)

  let filtered = applyFilters(all, filters)
  if (scanIntent === 'why_flagged') {
    filtered = filtered.filter(isHighlight)
  } else if (scanIntent === 'momentum_gap') {
    // Same gapOf the intent's facts use — the sort and the narration must
    // agree, and on the caution side the strength expression would have put
    // the SMALLEST divergence at the top of the table.
    const gapOf = descriptor?.gapOf ?? gapAhead
    filtered = filtered
      .filter(descriptor?.pace ?? isAccelerating)
      .sort((a, b) => gapOf(b) - gapOf(a))
  } else if (scanIntent === 'leading_industry' && stats.leadingIndustry) {
    filtered = filtered.filter((r) => r.industry === stats.leadingIndustry!.name)
  } else if (scanIntent === 'sector_leading' && sectorLeading) {
    filtered = filtered.filter(sectorLeading.isSectorLeading)
  } else if (scanIntent === 'new_since_yesterday' && newSinceYesterday) {
    filtered = filtered.filter(newSinceYesterday.isNew)
  } else if (scanIntent === 'rs_flip' && rsFlip) {
    filtered = filtered.filter(rsFlip.isFlip)
  }
  // is_unusual applies no filter (mode: none, per the mockup) — the pill
  // still selects/narrates, the table below is untouched.
  if (quick.ob && descriptor) filtered = filtered.filter(descriptor.rsiQuick.test)
  if (quick.watch) filtered = filtered.filter((r) => bookmarkedIds.has(r.equity_id))

  const toggleQuick = (key: QuickFilterKey) => setQuick((p) => ({ ...p, [key]: !p[key] }))
  const quickActiveCount = Object.values(quick).filter(Boolean).length
  const anyFilterActive = hasActiveFilters(filters) || quickActiveCount > 0 || scanIntent != null
  const clearAll = () => { setFilters(DEFAULT_FILTERS); setQuick(DEFAULT_QUICK); setScanIntent(null) }
  const selectScanIntent = (key: ScannerIntentKey) => {
    setScanIntent((p) => (p === key ? null : key))
    scrollToResults()
  }

  // Every hook above runs unconditionally — the guard cannot move earlier
  // without breaking the rules of hooks. A preset with no descriptor is a
  // routing mistake (ScanView only sends STUDIO_PRESET_IDS here), so this is a
  // developer-facing message, not a user-facing empty state.
  const d = descriptor

  const onRowClick = (s: ScanStock) =>
    navigate(`/chart/equity/${s.equity_id}?name=${encodeURIComponent(displaySymbol(s))}&tab=chart&setup=${presetId}`)

  if (!d) {
    return (
      <div style={{ padding: 24, color: 'var(--bear)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        No Studio descriptor for preset “{presetId}”. Add one to
        config/scannerStudio.ts, or route this preset to ScanView's generic layout.
      </div>
    )
  }

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
            {meta?.name ?? presetId}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.55 }}>{meta?.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Same astro-day badge the generic layout shows in its VaNi section
              header (B4) — the Studio had no astro context at all. */}
          <AtmosphericBadge />
          <DownloadXlsButton stocks={filtered} scanName={d.exportName} variant={d.xlsVariant} />
          <TradingViewExportButton stocks={filtered} scanName={d.exportName} />
        </div>
      </div>

      {/* The same branded loader every other scanner layout uses; the Studio
          predated its adoption and showed a plain line of text. */}
      {isLoading && <DristiQLoader />}
      {!isLoading && !error && <ScanStalenessBanner stocks={all} />}
      {error && <p style={{ color: 'var(--bear)' }}>Failed to load: {(error as Error).message}</p>}

      {!isLoading && !error && (
        <>
          {/* ── Cohort summary strip — always reflects the FULL day's cohort (all
              252), not the filtered subset. Several tiles double as filter
              shortcuts into the shared filter state below. ── */}
          {/* 148px, not 160: the grid measures 326px on a 390px phone (panel
              padding both sides), and two 160px columns plus the 10px gap is
              330 — so six tiles stacked single-file. 148 gives two columns
              from 306px up; on desktop the tiles are far wider either way. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 10, marginBottom: 18 }}>
            <StatTile
              label={d.countLabel}
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
              label={d.paceLabel}
              value={`${stats.acceleratingPct}%`}
              sub={d.paceSub}
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
              SEE it, not have to open a drawer). One card: the question
              pills and the answer share a single VaNi-badged masthead (see
              ScannerVaNiCard's own comment — VaNiInsight isn't reused here,
              its masthead-per-answer shape doesn't fit a persistent
              question row). ── */}
          {meta && (
            <ScannerVaNiCard
              presetId={presetId}
              descriptor={d}
              meta={meta}
              allStocks={all}
              dataDate={dataDate}
              exchangeFilter={exchangeFilter}
              scanIntent={scanIntent}
              onSelectIntent={selectScanIntent}
              sectorLeadingReady={!!sectorLeading}
              sectorLeadingFacts={sectorLeading?.facts ?? null}
              newSinceYesterdayFacts={newSinceYesterday?.facts ?? null}
              rsFlipFacts={rsFlip?.facts ?? null}
              isUnusualFacts={isUnusual}
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
            }}>{d.rsiQuick.label}</button>

            <ScanFilterBar presetId={presetId} stocks={all} filters={filters} onFiltersChange={setFilters} />

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
            <ScanTable stocks={filtered} presetId={presetId} onRowClick={onRowClick} />
          ) : (
            <BreakoutSurgeCards stocks={filtered} descriptor={d} onRowClick={onRowClick} />
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

/** All 7 questions, in the mockup's own order — a pill only actually
 *  renders once its `ready` check (below) passes, so partial infra
 *  readiness (e.g. no prior-day snapshot yet) just means fewer pills, never
 *  a broken one. */
/** All 7 questions in the mockup's order. Six read the same on every scan; only
 *  `rs_flip` names a direction, so its text comes from the preset's descriptor
 *  (and a descriptor with `rsFlip: null` drops the question entirely). */
function intentsOrdered(d: StudioDescriptor): { key: ScannerIntentKey; question: string }[] {
  const all: { key: ScannerIntentKey; question: string | null }[] = [
    { key: 'new_since_yesterday', question: d.newSinceYesterday === false ? null : "Show me what's new since yesterday" },
    { key: 'sector_leading', question: "Which sectors' stocks are leading today?" },
    { key: 'momentum_gap', question: 'Stocks with a momentum gap' },
    { key: 'rs_flip', question: d.rsFlip?.question ?? null },
    { key: 'leading_industry', question: d.industryQuestion ?? 'Which industry is leading this scan?' },
    { key: 'why_flagged', question: 'Why did VaNi flag these stocks?' },
    { key: 'is_unusual', question: 'Is today unusual compared to recent sessions?' },
  ]
  return all.filter((i): i is { key: ScannerIntentKey; question: string } => i.question != null)
}

function ScannerVaNiCard({
  presetId, descriptor, meta, allStocks, dataDate, exchangeFilter, scanIntent, onSelectIntent,
  sectorLeadingReady, sectorLeadingFacts, newSinceYesterdayFacts, rsFlipFacts, isUnusualFacts,
}: {
  presetId: string
  /** Carries the preset's pace predicate and its rs_flip question text — the
   *  two places this card's behaviour depends on which scan it is showing. */
  descriptor: StudioDescriptor
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
  /** All computed once in the parent (shared with the table's own filter
   *  predicates where applicable) — passed through rather than recomputed
   *  here. The Phase 3 facts are null until a prior-day snapshot exists;
   *  their pills simply don't render until then (see intentsOrdered). */
  sectorLeadingFacts: SectorLeadingFacts | null
  newSinceYesterdayFacts: NewSinceYesterdayFacts | null
  rsFlipFacts: RsFlipFacts | null
  isUnusualFacts: IsUnusualFacts | null
}) {
  // One useVaNiAsk() instance per intent so switching pills never refetches
  // or loses a sibling intent's already-fetched answer.
  const momentumGapMutation = useVaNiAsk()
  const leadingIndustryMutation = useVaNiAsk()
  const whyFlaggedMutation = useVaNiAsk()
  const sectorLeadingMutation = useVaNiAsk()
  const newSinceYesterdayMutation = useVaNiAsk()
  const rsFlipMutation = useVaNiAsk()
  const isUnusualMutation = useVaNiAsk()
  const mutationByIntent: Record<ScannerIntentKey, ReturnType<typeof useVaNiAsk>> = {
    momentum_gap: momentumGapMutation,
    leading_industry: leadingIndustryMutation,
    why_flagged: whyFlaggedMutation,
    sector_leading: sectorLeadingMutation,
    new_since_yesterday: newSinceYesterdayMutation,
    rs_flip: rsFlipMutation,
    is_unusual: isUnusualMutation,
  }
  const readyByIntent: Record<ScannerIntentKey, boolean> = {
    momentum_gap: true,
    leading_industry: true,
    why_flagged: true,
    sector_leading: sectorLeadingReady,
    new_since_yesterday: !!newSinceYesterdayFacts && descriptor.newSinceYesterday !== false,
    rs_flip: !!rsFlipFacts && descriptor.rsFlip != null,
    is_unusual: !!isUnusualFacts,
  }

  const askIntent = (key: ScannerIntentKey) => {
    onSelectIntent(key)
    const mutation = mutationByIntent[key]
    if (!dataDate || mutation.data || mutation.isPending) return
    if (key === 'momentum_gap') {
      const facts = computeMomentumGapFacts(allStocks, descriptor.pace, descriptor.gapOf)
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
      // Which builder and which prompt both follow the preset's vani_rule,
      // paired in one descriptor field so they cannot drift apart.
      mutation.mutate({
        intent_id: descriptor.highlight.intentId, preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        ...descriptor.highlight.payload(allStocks),
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
    } else if (key === 'new_since_yesterday' && newSinceYesterdayFacts) {
      mutation.mutate({
        intent_id: 'scanner.new_since_yesterday', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        new_since_yesterday_facts: {
          count: newSinceYesterdayFacts.count,
          prior_date: newSinceYesterdayFacts.priorDate,
          examples: newSinceYesterdayFacts.examples.map((e) => ({ symbol: e.symbol })),
        },
      })
    } else if (key === 'rs_flip' && rsFlipFacts) {
      mutation.mutate({
        intent_id: 'scanner.rs_flip', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        rs_flip_facts: {
          count: rsFlipFacts.count,
          prior_date: rsFlipFacts.priorDate,
          examples: rsFlipFacts.examples.map((e) => ({ symbol: e.symbol, from_zone: e.fromZone, to_zone: e.toZone })),
        },
      })
    } else if (key === 'is_unusual' && isUnusualFacts) {
      mutation.mutate({
        intent_id: 'scanner.is_unusual', preset_id: presetId, data_date: dataDate,
        timeframe: 'daily', exchange: exchangeFilter,
        is_unusual_facts: {
          today_count: isUnusualFacts.todayCount,
          avg_count: isUnusualFacts.avgCount,
          lookback_days: isUnusualFacts.lookbackDays,
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
  const visibleIntents = intentsOrdered(descriptor).filter((it) => readyByIntent[it.key])

  // Owner (2026-09-03): "intents should be part of VaNi interaction" — the
  // mockup's own .vani-main wraps ONE badge header around BOTH the
  // question row and the answer (intent-row + vani-answer share one card
  // body); this component used to render the pills as a bare row above a
  // separate <VaNiInsight> card that only appeared once a question was
  // clicked, reading as two disconnected pieces rather than one companion
  // interaction. Rebuilt as a single card, matching VaNiInsight's own
  // masthead markup (same badge/tokens) rather than reusing the component
  // itself — VaNiInsight returns null with no insight yet and has no slot
  // for content above the answer body, and these answers are all
  // deliberately short (45-90 words, capped at build time — see each
  // intent's system_prompt in vani_intents.py) so the `collapsible`
  // truncation VaNiInsight offers isn't needed here either.
  return (
    <div
      className="rounded-lg overflow-hidden border border-accent-indigo/20 bg-[var(--kd-card)]"
      style={{ marginBottom: 18 }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-indigo/[0.13] border-b border-accent-indigo/25">
        <span className="w-[15px] h-[15px] rounded-[4px] bg-accent-indigo flex items-center justify-center shrink-0">
          <span className="text-white text-[8px] leading-none select-none">✦</span>
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-accent-indigo">VaNi</span>
        <span className="text-[8px] text-accent-indigo/60 tracking-wide">वाणी</span>
      </div>
      <div className="px-3 py-2.5">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: scanIntent ? 10 : 0 }}>
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
        {!scanIntent && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            Pick a question above — VaNi answers in a couple of lines, then the table below filters to match.
          </p>
        )}
        {scanIntent && (
          showLoading ? (
            <div className="flex items-center gap-1.5 text-muted">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">Consulting VaNi…</span>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {active?.data?.response}
              </p>
              {active?.data?.log_id && <VaNiFeedback logId={active.data.log_id} />}
            </>
          )
        )}
      </div>
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
