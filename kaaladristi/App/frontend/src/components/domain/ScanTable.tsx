import { useState, useRef, useEffect } from 'react'
import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'
import { Tooltip } from '@/components/ui'
import { ALL_FIELDS, formatValue, getColor, getFieldConfig, getLabel, getTooltip } from '@/config/fieldConfig'
import { MiniTower } from '@/components/ui'
import type React from 'react'
import { getPresetMeta } from '@/services/scanEngine'
import { getFieldsForGroup } from '@/fieldAvailability'
import VaNiTrigger from '@/components/domain/VaNiTrigger'
import { useStockAskStore } from '@/stores/stockAskStore'
import BookmarkToggle from '@/components/domain/BookmarkToggle'
import FloatingHScrollbar from '@/components/ui/FloatingHScrollbar'
import { DOT_LABELS, dotLabel, type DotSignal } from '@/constants/signalScale'
import { getStudioDescriptor } from '@/config/scannerStudio'

// ── Preset column overrides ─────────────────────────────────────────────────────

// Per-preset column overrides for presets whose fetcher has a limited SELECT.
// Scanner Studio presets are NOT here: their columns live on the descriptor
// (`tableColumns`, config/scannerStudio.ts) and are read first below, so a
// Studio cannot be missing its column set (gap audit §7).
const PRESET_COL_OVERRIDES: Partial<Record<string, string[]>> = {
  // Post-Result Drift selects on the RESULT, so the result columns lead —
  // without them the grid gives no clue why a row is present. Reaction is the
  // membership criterion, Drift is what has happened since, and Sessions says
  // how much of the 20-session window is left. Reaction and Drift are never
  // merged into one number: measuring drift from Day -1 would fold the
  // announcement jump into it, which is how a PEAD study reports an effect it
  // never measured.
  // Owner's field order, and it is the SAME vocabulary the Sector Rotation
  // constituents table uses (Flow 5D / Flow 22D / RSI / Magic RS / 1D %), so a
  // user arriving from an index detail page reads identical column names
  // meaning identical things.
  //
  // The evidence — which baskets hold the stock, which scanners flag it — is
  // NOT here. Both are lists of names, and a list of names in a dense grid is
  // 380px of width that pushes every number off screen (measured against the
  // live page). They render as chips under the symbol instead.
  //
  // magic_rs_chg_22d is deliberately absent: the owner's set is these seven and
  // anything beyond is bonus. It is also the field a user cannot read raw —
  // "+42" is the 98th percentile, but 8 of the 55 stocks at or above it are
  // still BELOW their own mean, so the number alone misdescribes ~15% of the
  // rows it would appear on. If it returns it needs a word, not a figure.
  standouts: [
    'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng', 'rvol', 'rsi_14', 'magic_rs',
  ],
  standouts_caution: [
    'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng', 'rvol', 'rsi_14', 'magic_rs',
  ],

  pead_drift: [
    'symbol', 'close', 'result_reaction_pct', 'result_drift_pct',
    'result_day_0', 'result_sessions_elapsed',
    'pct_chng', 'magic_rs', 'rvol', 'delivery_pct', 'stage',
  ],

  // Flower Pot Burst has its own metric surface — the price_action group's
  // breakout/score columns are all null here. Lead with the always-populated
  // compression fields; burst-only metrics (Vol Burst / Range Exp / Close Str /
  // Quality) are NOT default columns because on the common no-burst day every
  // row would blank them — the card view shows them when a burst fires, and the
  // Phase column marks bursts inline.
  flower_pot_burst: [
    'symbol', 'close', 'pct_chng', 'fpb_phase',
    'fpb_compression_score', 'fpb_atr_compression', 'fpb_vol_death', 'fpb_setup_days',
    'delivery_pct', 'rvol', 'magic_rs',
  ],

  // Volume Drive selects ON the dot, so the dot leads — without it the grid
  // gives no clue why a row is present. Delivery follows because it is the
  // ranking key and the VaNi chip's threshold (dot_svd + deliv >= 50 measured
  // 23.7% next-day vs 7.1% for the dot alone), then the volume evidence.
  // The Score pair and Avg Amt 5D were missing here while every other Flow
  // preset shows them, so Volume Drive read as a different product inside its
  // own menu. fetchVolumeDrive already SELECTs all three -- the values were
  // fetched and then dropped at the column list, which is why the DB looked
  // healthy. Scores go directly after the dot so the delivery evidence the
  // preset selects on stays adjacent to it.
  volume_drive: [
    'symbol', 'dot_signal', 'score_5d', 'score_22d', 'delivery_pct', 'close', 'pct_chng',
    'rvol', 'delivery_surge_x', 'avg_amt_5d', 'avg_amt_22d',
    'ret_5d', 'magic_rs', 'rsi_14', 'flow_type',
  ],

  // Waking Giants v4 journey tabs — the journey dimensions lead. base_years =
  // "Slept", align_score = the 0-6 timeframe alignment, pct_from_3y_high
  // carries % vs the hibernation ceiling on these presets.
  // The wake trio sits next to journey_age_days: it said WHEN the journey
  // started and nothing said from where, so a breakout that had been fully
  // given back read the same as one still working. SPARC on 2026-08-27
  // showed "2mo · 5/6 · -22.4%" while trading a quarter below its own wake.
  waking_giants: [
    'symbol', 'close', 'pct_chng', 'base_years',
    'turn_date', 'turn_close', 'pct_from_turn',
    'wake_date', 'wake_close', 'pct_from_wake', 'journey_age_days',
    'clocks', 'align_score', 'gl_dist_pct', 'gl_event', 'gl_event_date',
    'pct_from_3y_high', 'listing_age_years',
    'delivery_pct', 'magic_rs', 'mcap_cr',
  ],
  wg_ascent: [
    'symbol', 'close', 'pct_chng', 'clocks', 'align_score',
    'turn_date', 'turn_close', 'pct_from_turn',
    'wake_date', 'wake_close', 'pct_from_wake', 'journey_age_days',
    'wg_resting', 'base_years', 'gl_dist_pct', 'gl_event', 'gl_event_date', 'listing_age_years',
    'magic_rs', 'mcap_cr',
  ],
  // Stirring has no wake yet, so the TURN is the whole story here — a stock
  // that has crossed the Golden Line with the weekly clock green but has not
  // cleared its ceiling is exactly what this tab is for.
  wg_stirring: [
    'symbol', 'close', 'pct_chng', 'gl_acc_days', 'base_years',
    'turn_date', 'turn_close', 'pct_from_turn',
    'clocks', 'gl_dist_pct', 'gl_event', 'gl_event_date',
    'pct_from_3y_high', 'listing_age_years', 'delivery_pct', 'magic_rs', 'mcap_cr',
  ],
}

// Keys are `keyof ScanStock`, not `string`: the Studio descriptors already
// type their `sort.key` that way, and this map did not, so a typo here
// compiled and then silently fell through sortStocks as an undefined
// property -- every row null, nulls-last, i.e. fetch order, which looks
// like a working table in an order nobody chose.
const DEFAULT_SORT: Record<string, { key: keyof ScanStock; dir: 'asc' | 'desc' }> = {
  // ── Stage family: newest entrant to the stage first (owner, 2026-09-25).
  // `stage_since` is the classifier's own record of when the label last
  // changed, so it answers "what just arrived here", which is why these lists
  // are opened. It is a default column on the stage_analysis group, so the
  // sorted header shows its arrow. It is also a DATE string: compareValues
  // falls through to localeCompare for it, which is correct for ISO dates, and
  // sortStocks puts nulls last in BOTH directions, so a row with no recorded
  // entry never masquerades as the freshest one.
  //
  // ⚠ The direction is the same (desc = most recent) on the watch lists and
  // the leader lists. It is not a strength ranking, so it does not flip sign
  // with the side of the list the way rs_percentile did.
  stage_2_leaders:  { key: 'stage_since',       dir: 'desc' },
  stage_2_watch:    { key: 'stage_since',       dir: 'desc' },
  stage_3_watch:    { key: 'stage_since',       dir: 'desc' },
  stage_4_leaders:  { key: 'stage_since',       dir: 'desc' },
  vani_opportunity: { key: 'rs_percentile',     dir: 'desc' },
  // Delivery-led, and deliberately the SURGE rather than raw delivery_pct:
  // this list is about delivery that has stepped up against the stock's own
  // baseline (avg_amt_5d / avg_amt_22d), and raw delivery_pct floats illiquid
  // names that always settle high. Matches fetchConvictionFlow's own ranking.
  conviction_flow:  { key: 'delivery_surge_x',  dir: 'desc' },
  // Tightest compression first — bursts (high quality) still sort near the top.
  flower_pot_burst: { key: 'fpb_compression_score', dir: 'desc' },
  // RVOL-first (owner, 2026-09-25) — this preset selects on the volume dot, so
  // the volume reading is what ranks it.
  // ⚠ The previous key was delivery_pct, which matched fetchVolumeDrive's
  // engine ranking; that ranking is now only the fetcher's cut, not the
  // display order. Do NOT fall back to magic_rs here: it measured 0.85x
  // (INVERTED) against a next-day move, so it would sort the list by a feature
  // with no predictive value — which is what happened before this map existed.
  // ⚠ `rvol` divides by a 50-bar mean that INCLUDES today, so it understates a
  // genuine spurt (19.2x on OPTIEMUS 2026-09-22 against ~52x measured against
  // prior bars only). Fine as an ordering, wrong as a quoted figure.
  volume_drive:     { key: 'rvol',              dir: 'desc' },
  // Score-first (owner doctrine), matching breakout_surge's Studio ranking.
  // Without an entry here it fell through to the magic_rs default.
  power_buy:        { key: 'score_5d',          dir: 'desc' },
  // Standouts: the strength list leads on the 5-day flow, the caution list on
  // the 22-day, weakest first. Note the FETCHER still orders by agreement
  // count (how many same-side scanners flag the stock) because that is what
  // the result_limit cuts on; this map only decides the displayed order.
  standouts:         { key: 'score_5d',         dir: 'desc' },
  standouts_caution: { key: 'score_22d',        dir: 'asc'  },
  // v4 journey tabs. Waking Giants and Ascent lead on the WAKE DATE, newest
  // first (owner, 2026-09-25) — `wake_date` is already a rendered column on
  // both. Stirring keeps gl_acc_days: it has no wake yet, which is the whole
  // point of that tab.
  waking_giants:    { key: 'wake_date',         dir: 'desc' },
  wg_ascent:        { key: 'wake_date',         dir: 'desc' },
  wg_stirring:      { key: 'gl_acc_days',       dir: 'desc' },
}

function getDefaultSort(presetId: string): { key: string; dir: 'asc' | 'desc' } {
  // Studio presets carry their ranking on the descriptor; the map above is
  // for everything else. The magic_rs fallback is what silently discarded
  // seven fetchers' rankings before A1 (gap audit §2a).
  return getStudioDescriptor(presetId)?.sort ?? DEFAULT_SORT[presetId] ?? { key: 'magic_rs', dir: 'desc' as const }
}

// ── Sort ───────────────────────────────────────────────────────────────────────

/** Numeric when BOTH sides parse as finite numbers, text otherwise.
 *
 *  The old test was `typeof av === 'string'` -> localeCompare, which sorted
 *  any numeric column that arrived as text LEXICOGRAPHICALLY. That is
 *  sign-blind and magnitude-blind: '8.8' outranks '17.5', and every negative
 *  clumps at one end regardless of size, because '-' sorts before every digit.
 *  Nine of the twelve fetchers pass numerics straight through from the API
 *  without Number(), so whether a column sorted correctly depended on which
 *  fetcher served it -- MagicRS sorted right on the matview-backed and journey
 *  tabs and wrongly everywhere else. Deciding on the VALUE rather than on the
 *  JavaScript type fixes every numeric column at once: MagicRS, 1D%, the
 *  returns, % Since Wake, % Since Entry.
 */
function compareValues(av: unknown, bv: unknown, dir: 'asc' | 'desc'): number {
  const an = typeof av === 'number' ? av : Number(av)
  const bn = typeof bv === 'number' ? bv : Number(bv)
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    return dir === 'asc' ? an - bn : bn - an
  }
  const as = String(av), bs = String(bv)
  return dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
}

/** Table-only MagicRS color: sign of the displayed/sorted number, not zone. See comment at call site. */
function magicRsSignColor(rawVal: unknown): string {
  if (rawVal == null) return 'var(--text-faint)'
  const n = Number(rawVal)
  if (!Number.isFinite(n)) return 'var(--text-faint)'
  if (n > 0) return 'var(--bull)'
  if (n < 0) return 'var(--bear)'
  return 'var(--text-secondary)'
}

function sortStocks(stocks: ScanStock[], key: string, dir: 'asc' | 'desc'): ScanStock[] {
  const arr = [...stocks]
  arr.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[key]
    const bv = (b as unknown as Record<string, unknown>)[key]
    // Nulls last in BOTH directions — an empty cell is absence of data, not a
    // value at one end of the range.
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return compareValues(av, bv, dir)
  })
  return arr
}

// ── Component ──────────────────────────────────────────────────────────────────

interface ScanTableProps {
  stocks: ScanStock[]
  presetId: string
  onRowClick: (stock: ScanStock) => void
}

export default function ScanTable({ stocks, presetId, onRowClick }: ScanTableProps) {
  const preset = getPresetMeta(presetId)
  const { defaultCols: groupDefaultCols, optionalCols: groupOptionalCols } = getFieldsForGroup(preset?.category ?? '')
  const ds = getDefaultSort(presetId)

  const [sortKey, setSortKey]   = useState(ds.key)
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>(ds.dir)
  const [gearOpen, setGearOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)
  const scrollBoxRef = useRef<HTMLDivElement>(null)
  // Which row (if any) has its "Ask VaNi" popover open right now — used to
  // highlight that row so it stays identifiable even if the popover has
  // drifted along with scroll away from being directly over it.
  const activeStockAskEntity = useStockAskStore((s) => s.entity)
  const activeEquityId = activeStockAskEntity?.type === 'equity' ? activeStockAskEntity.id : null

  const storageKey = `dristiq_cols_${presetId}`
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return new Set<string>(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return new Set<string>(groupOptionalCols)  // hide all optional cols by default
  })

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...hiddenCols])) }
    catch { /* ignore */ }
  }, [hiddenCols, storageKey])

  useEffect(() => {
    if (!gearOpen) return
    function handle(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [gearOpen])

  const optionalCols  = groupOptionalCols
  const defaultCols   = getStudioDescriptor(presetId)?.tableColumns ?? PRESET_COL_OVERRIDES[presetId] ?? groupDefaultCols

  // The symbol column carries the evidence chips on Standouts, so it needs the
  // room — but only there. Header and cell read ONE value: they were already
  // drifting (header took cfg.width, the cell hardcoded 158), which is how a
  // sticky column ends up misaligned with its own heading.
  const showsEvidence = presetId === 'standouts' || presetId === 'standouts_caution'
  const symbolWidth   = showsEvidence ? 230 : (ALL_FIELDS.symbol?.width ?? 158)

  // visible = default cols + optional cols not hidden, deduped
  const activeCols = [...defaultCols, ...optionalCols.filter(c => !hiddenCols.has(c))]
    .filter((c, i, arr) => arr.indexOf(c) === i)

  const sorted = sortStocks(stocks, sortKey, sortDir)

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function toggleCol(colKey: string) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      if (next.has(colKey)) next.delete(colKey)
      else next.add(colKey)
      return next
    })
  }


  return (
    <div style={{ position: 'relative' }}>
      {/* Toolbar: gear */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <div ref={gearRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setGearOpen(o => !o)}
            title="Choose columns"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: gearOpen ? 'var(--accent-glow)' : 'transparent',
              color: gearOpen ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}
          >
            ⚙ Columns
          </button>

          {gearOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 0', zIndex: 100,
              minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              <div style={{
                padding: '4px 12px 6px', fontSize: 11, color: 'var(--text-faint)',
                letterSpacing: '.08em', textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
              }}>
                Optional Columns
              </div>
              {optionalCols.map(colKey => {
                const cfg = ALL_FIELDS[colKey]
                if (!cfg) return null
                const enabled = !hiddenCols.has(colKey)
                return (
                  <button
                    key={colKey}
                    onClick={() => toggleCol(colKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '7px 12px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                      textAlign: 'left', fontFamily: 'var(--font-body)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
                      background: enabled ? 'var(--accent)' : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'white', lineHeight: 1,
                    }}>
                      {enabled ? '✓' : ''}
                    </span>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div ref={scrollBoxRef} style={{
        overflowX: 'auto',
        overflowY: 'auto',
        // Grows to fit the data up to this cap, then scrolls (sticky header/first
        // column anchor to this box). Cap raised 2026-07-12 (was 100vh-310px, which
        // stopped at ~19 rows) so more rows show before the inner scroll kicks in;
        // the outer panel scrolls for any remainder. Tunable — just this number.
        maxHeight: 'calc(100vh - 160px)',
        width: '100%',
        WebkitOverflowScrolling: 'touch',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
      }}>
        <table style={{
          width: 'max-content',
          minWidth: '100%',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr style={{ height: 32 }}>
              {activeCols.map(colKey => {
                const cfg = ALL_FIELDS[colKey]
                if (!cfg) return null
                const isActive  = sortKey === colKey
                const isSticky  = !!cfg.sticky
                const tooltip   = getTooltip(colKey)
                return (
                  <th
                    key={colKey}
                    onClick={() => toggleSort(colKey)}
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: isSticky ? 0 : undefined,
                      zIndex: isSticky ? 13 : 10,
                      background: 'var(--card)',
                      width: colKey === 'symbol' ? symbolWidth : cfg.width,
                      minWidth: colKey === 'symbol' ? symbolWidth : cfg.width,
                      padding: '0 10px',
                      textAlign: colKey === 'symbol' ? 'left' : 'right',
                      fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                      fontWeight: 600, fontFamily: 'var(--font-body)',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      userSelect: 'none',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {tooltip
                      ? <Tooltip content={tooltip} position="bottom" maxWidth={240}>{getLabel(colKey)}</Tooltip>
                      : getLabel(colKey)
                    }
                    {isActive && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(stock => {
              // Row whose "Ask VaNi" popover is currently open gets a
              // stronger indigo tint (matches the popover's own accent
              // color) — takes priority over the vaniOpportunity gold tint,
              // so the row stays identifiable while the popover is open,
              // including after scrolling moves it away from directly
              // beneath the popover. Same gold tint BreakoutSurgeCards
              // already uses for its VaNi tier otherwise — mixed with
              // --card (not transparent) so the sticky symbol column stays
              // opaque over horizontally-scrolled cells.
              const isVaniAskActive = stock.equity_id === activeEquityId
              const rowBg = isVaniAskActive
                ? 'color-mix(in srgb, var(--indigo) 12%, var(--card))'
                : stock.vaniOpportunity
                  ? 'color-mix(in srgb, var(--gold) 7%, var(--card))'
                  : 'transparent'
              return (
              <tr
                key={stock.equity_id}
                onClick={() => onRowClick(stock)}
                style={{
                  cursor: 'pointer', height: 40, background: rowBg,
                  boxShadow: isVaniAskActive ? 'inset 3px 0 0 var(--indigo)' : undefined,
                }}
                onMouseEnter={e => {
                  const row = e.currentTarget as HTMLElement
                  row.style.background = 'var(--accent-glow)'
                  const sticky = row.querySelector<HTMLElement>('[data-sticky]')
                  if (sticky) sticky.style.background = 'var(--accent-glow)'
                }}
                onMouseLeave={e => {
                  const row = e.currentTarget as HTMLElement
                  row.style.background = rowBg
                  const sticky = row.querySelector<HTMLElement>('[data-sticky]')
                  if (sticky) sticky.style.background = rowBg
                }}
              >
                {activeCols.map(colKey => {
                  if (colKey === 'symbol') {
                    const sym = displaySymbol(stock)
                    const company = stock.company_name
                      ? stock.company_name
                          .replace(/ (LIMITED|LTD\.?|INDUSTRIES|ENTERPRISES|INTERNATIONAL|INDIA)\.?\s*$/i, '')
                          .trim()
                      : null
                    return (
                      <td
                        key="symbol"
                        data-sticky
                        style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          background: rowBg === 'transparent' ? 'var(--card)' : rowBg,
                          padding: '0 10px',
                          width: symbolWidth, minWidth: symbolWidth,
                          borderBottom: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {stock.vaniOpportunity && (
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: 'var(--accent)', flexShrink: 0,
                            }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{
                                fontSize: 13, fontFamily: 'var(--font-mono)',
                                color: 'var(--text-primary)', fontWeight: 600,
                              }}>
                                {sym}
                              </span>
                              {stock.exchange && (
                                <span style={{
                                  fontSize: 10, padding: '1px 3px', borderRadius: 3,
                                  background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
                                  color: 'var(--text-faint)',
                                  fontFamily: 'var(--font-mono)',
                                }}>
                                  {stock.exchange}
                                </span>
                              )}
                            </div>
                            {company && (
                              <div style={{
                                fontSize: 12, color: 'var(--text-muted)',
                                fontFamily: 'var(--font-body)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: showsEvidence ? 180 : 110,
                              }}>
                                {company}
                              </div>
                            )}
                            {/* Standouts evidence. Chips, not columns: these are
                                lists of names, and as grid cells they cost 380px
                                and push every number off screen. The BASKET says
                                why the stock is eligible, the SCANNERS say who is
                                flagging it — and the chip count IS the agreement
                                count, so no bare number is rendered (a figure
                                there reads as a strength score, which nothing
                                measures). */}
                            {showsEvidence && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                                {(stock.standout_baskets ?? []).slice(0, 2).map((b) => (
                                  <span key={`b-${b}`} title={(stock.standout_baskets ?? []).join(' · ')} style={{
                                    fontSize: 10, padding: '1px 4px', borderRadius: 3, maxWidth: 100,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                                    color: 'var(--accent)', fontFamily: 'var(--font-body)',
                                  }}>{b}</span>
                                ))}
                                {(stock.standout_baskets?.length ?? 0) > 2 && (
                                  <span title={(stock.standout_baskets ?? []).join(' · ')} style={{
                                    fontSize: 10, padding: '1px 4px', borderRadius: 3,
                                    color: 'var(--text-faint)', fontFamily: 'var(--font-mono)',
                                  }}>+{(stock.standout_baskets?.length ?? 0) - 2}</span>
                                )}
                                {(stock.standout_presets ?? []).map((n) => (
                                  <span key={`p-${n}`} title={(stock.standout_presets ?? []).join(' · ')} style={{
                                    fontSize: 10, padding: '1px 4px', borderRadius: 3, maxWidth: 100,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)',
                                    color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
                                  }}>{n}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <BookmarkToggle equityId={stock.equity_id} size={12} className="ml-auto" />
                          <VaNiTrigger
                            entity={{
                              type: 'equity',
                              id: stock.equity_id,
                              symbol: sym,
                              pageContext: `Scanner / ${preset?.name ?? presetId}`,
                              currentPresetId: presetId,
                              ...(presetId==='breakout_surge'?{asOfDate:stock.trade_date}:{}),
                              signals: {
                                close: stock.close,
                                pctChng: stock.pct_chng,
                                rvol: stock.rvol,
                                flowType: stock.flow_type,
                                magicRsZone: stock.magic_rs_zone,
                                deliveryPct: stock.delivery_pct,
                              },
                            }}
                          />
                        </div>
                      </td>
                    )
                  }

                  const rawVal = (stock as unknown as Record<string, unknown>)[colKey]
                  const text   = formatValue(colKey, rawVal, stock)
                  // MagicRS is a special case here: fieldConfig's getColor() colors it
                  // by magic_rs_zone (magic_rs - magic_ma — trend vs. the stock's OWN
                  // average, a real and deliberately different signal used correctly
                  // by the card/chart views). In a table, sitting right next to the
                  // sorted magic_rs NUMBER itself, that produced a red dot between two
                  // greens of similar magnitude, and a 3rd "gray, unclassified" state
                  // (real magic_rs, zone not yet warmed up — self-resolving, ~40 bars
                  // after magic_rs itself starts, not a bug) that read as broken and
                  // was hard to tell apart from green at a glance. Table-only: color
                  // the dot/text by the SIGN of the number actually shown and sorted
                  // on, so it can never disagree with what's on screen, and there's no
                  // third "unclassified" state — only bull/bear/no-data.
                  const color  = colKey === 'magic_rs' ? magicRsSignColor(rawVal) : getColor(colKey, rawVal, stock)

                  // fontWeight emphasis for signal extremes — not expressible via FieldConfig thresholds
                  let fontWeight: number | undefined
                  if (rawVal != null) {
                    const n = Number(rawVal)
                    if (!isNaN(n)) {
                      if (colKey === 'rsi_14'   && (n > 70 || n < 30)) fontWeight = 600
                      if (colKey === 'rss_value' && (n > 80 || n < 20)) fontWeight = 600
                    }
                  }

                  const cfg = getFieldConfig(colKey)
                  const isScore = cfg?.type === 'score50' || cfg?.type === 'score100'
                  const scoreMax = cfg?.type === 'score50' ? 50 : 100

                  return (
                    <td
                      key={colKey}
                      style={{
                        padding: '0 10px', textAlign: 'right',
                        fontSize: 12, fontFamily: 'var(--font-mono)',
                        color,
                        fontWeight: fontWeight ?? undefined,
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
                      }}
                    >
                      {isScore ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <MiniTower value={rawVal != null ? Number(rawVal) : null} max={scoreMax} color={color} />
                          <span>{text}</span>
                        </span>
                      ) : colKey === 'magic_rs' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span style={{
                            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                            background: color, marginRight: 5, flexShrink: 0,
                          }} />
                          {text}
                        </span>
                      ) : colKey === 'dot_signal' ? (
                        // Colour comes from DOT_LABELS (signalScale.ts) so the grid,
                        // the chart markers and the card tags cannot drift apart again.
                        rawVal ? (
                          <Tooltip content={DOT_LABELS[rawVal as DotSignal]?.description ?? ''}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                              <span style={{
                                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                background: dotLabel(rawVal as string).color, flexShrink: 0,
                              }} />
                              <span style={{ color: dotLabel(rawVal as string).color }}>{String(rawVal)}</span>
                            </span>
                          </Tooltip>
                        ) : <span style={{ color: 'var(--text-faint)' }}>—</span>
                      ) : text}
                    </td>
                  )
                })}
              </tr>
              )
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div style={{
            padding: '40px 24px', textAlign: 'center',
            color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-body)',
          }}>
            No results
          </div>
        )}
      </div>

      {/* Always-reachable horizontal scrollbar pinned to the viewport bottom —
          the table's own bar sits below the fold on tall result sets. */}
      <FloatingHScrollbar targetRef={scrollBoxRef} />

      <div style={{
        marginTop: 6, fontSize: 12, color: 'var(--text-faint)',
        fontFamily: 'var(--font-mono)', textAlign: 'right',
      }}>
        {stocks.length} stocks
      </div>
    </div>
  )
}
