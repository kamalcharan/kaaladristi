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
import BookmarkToggle from '@/components/domain/BookmarkToggle'
import FloatingHScrollbar from '@/components/ui/FloatingHScrollbar'
import { DOT_LABELS, dotLabel, type DotSignal } from '@/constants/signalScale'

// ── Preset column overrides ─────────────────────────────────────────────────────

// Per-preset column overrides for presets whose fetcher has a limited SELECT.
const PRESET_COL_OVERRIDES: Partial<Record<string, string[]>> = {
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

  // Weekly Movers selects on pct_wtd, so the week-to-date pair leads: the
  // gain, then the reference close it is measured from (the export's
  // "Breakout" column). D% follows because it is a DIFFERENT number from
  // % WTD on every day except Monday, and showing them side by side is what
  // makes the distinction legible.
  weekly_movers: [
    'symbol', 'close', 'pct_wtd', 'prev_week_close', 'pct_chng',
    'rsi_14', 'ret_5d', 'ret_22d', 'delivery_pct', 'magic_rs',
    'pct_below_52w_high', 'mcap_cr',
  ],

  // Volume Drive selects ON the dot, so the dot leads — without it the grid
  // gives no clue why a row is present. Delivery follows because it is the
  // ranking key and the VaNi chip's threshold (dot_svd + deliv >= 50 measured
  // 23.7% next-day vs 7.1% for the dot alone), then the volume evidence.
  volume_drive: [
    'symbol', 'dot_signal', 'delivery_pct', 'close', 'pct_chng',
    'rvol', 'delivery_surge_x', 'ret_5d', 'magic_rs', 'rsi_14', 'flow_type',
  ],

  // Waking Giants v4 journey tabs — the journey dimensions lead. base_years =
  // "Slept", align_score = the 0-6 timeframe alignment, pct_from_3y_high
  // carries % vs the hibernation ceiling on these presets.
  waking_giants: [
    'symbol', 'close', 'pct_chng', 'base_years', 'journey_age_days', 'align_score',
    'gl_dist_pct', 'pct_from_3y_high', 'listing_age_years',
    'delivery_pct', 'magic_rs', 'mcap_cr',
  ],
  wg_ascent: [
    'symbol', 'close', 'pct_chng', 'align_score', 'journey_age_days', 'wg_resting',
    'base_years', 'gl_dist_pct', 'listing_age_years', 'magic_rs', 'mcap_cr',
  ],
  wg_stirring: [
    'symbol', 'close', 'pct_chng', 'gl_acc_days', 'base_years',
    'pct_from_3y_high', 'listing_age_years', 'delivery_pct', 'magic_rs', 'mcap_cr',
  ],
}

const DEFAULT_SORT: Record<string, { key: string; dir: 'asc' | 'desc' }> = {
  stage_2_leaders:  { key: 'magic_rs',         dir: 'desc' },
  stage_2_watch:    { key: 'rs_percentile',     dir: 'desc' },
  vani_opportunity: { key: 'rs_percentile',     dir: 'desc' },
  stage_4_leaders:  { key: 'rs_percentile',     dir: 'asc'  },
  stage_3_watch:    { key: 'rs_percentile',     dir: 'asc'  },
  vani_exit_watch:  { key: 'rs_percentile',     dir: 'asc'  },
  conviction_flow:  { key: 'delivery_surge_x',  dir: 'desc' },
  // Score first (owner doctrine) — matches the merged scan's engine ranking.
  breakout_surge:   { key: 'score_5d',          dir: 'desc' },
  // Tightest compression first — bursts (high quality) still sort near the top.
  flower_pot_burst: { key: 'fpb_compression_score', dir: 'desc' },
  // Delivery-first, matching fetchVolumeDrive's engine ranking. Without an
  // entry here the table falls through to magic_rs desc, which silently
  // discards that ranking — and magic_rs measured 0.85x (INVERTED) against a
  // next-day move, so it would sort the list by a feature with no predictive
  // value.
  volume_drive:     { key: 'delivery_pct',      dir: 'desc' },
  // v4 journey tabs — match each fetcher's engine ranking.
  waking_giants:    { key: 'base_years',        dir: 'desc' },
  wg_ascent:        { key: 'align_score',       dir: 'desc' },
  wg_stirring:      { key: 'gl_acc_days',       dir: 'desc' },
}

function getDefaultSort(presetId: string) {
  return DEFAULT_SORT[presetId] ?? { key: 'magic_rs', dir: 'desc' as const }
}

// ── Sort ───────────────────────────────────────────────────────────────────────

function sortStocks(stocks: ScanStock[], key: string, dir: 'asc' | 'desc'): ScanStock[] {
  const arr = [...stocks]
  arr.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[key]
    const bv = (b as unknown as Record<string, unknown>)[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const an = Number(av), bn = Number(bv)
    return dir === 'asc' ? an - bn : bn - an
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
  const defaultCols   = PRESET_COL_OVERRIDES[presetId] ?? groupDefaultCols

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
              fontSize: 11, cursor: 'pointer',
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
                padding: '4px 12px 6px', fontSize: 9, color: 'var(--text-faint)',
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
                      fontSize: 9, color: 'white', lineHeight: 1,
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
                      width: cfg.width, minWidth: cfg.width,
                      padding: '0 10px',
                      textAlign: colKey === 'symbol' ? 'left' : 'right',
                      fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
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
            {sorted.map(stock => (
              <tr
                key={stock.equity_id}
                onClick={() => onRowClick(stock)}
                style={{ cursor: 'pointer', height: 40 }}
                onMouseEnter={e => {
                  const row = e.currentTarget as HTMLElement
                  row.style.background = 'var(--accent-glow)'
                  const sticky = row.querySelector<HTMLElement>('[data-sticky]')
                  if (sticky) sticky.style.background = 'var(--accent-glow)'
                }}
                onMouseLeave={e => {
                  const row = e.currentTarget as HTMLElement
                  row.style.background = 'transparent'
                  const sticky = row.querySelector<HTMLElement>('[data-sticky]')
                  if (sticky) sticky.style.background = 'var(--card)'
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
                          background: 'var(--card)',
                          padding: '0 10px',
                          width: 158, minWidth: 158,
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
                                  fontSize: 8, padding: '1px 3px', borderRadius: 3,
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
                                fontSize: 11, color: 'var(--text-muted)',
                                fontFamily: 'var(--font-body)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: 110,
                              }}>
                                {company}
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
                            }}
                          />
                        </div>
                      </td>
                    )
                  }

                  const rawVal = (stock as unknown as Record<string, unknown>)[colKey]
                  const text   = formatValue(colKey, rawVal, stock)
                  const color  = getColor(colKey, rawVal, stock)

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
            ))}
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
        marginTop: 6, fontSize: 10, color: 'var(--text-faint)',
        fontFamily: 'var(--font-mono)', textAlign: 'right',
      }}>
        {stocks.length} stocks
      </div>
    </div>
  )
}
