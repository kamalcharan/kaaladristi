import { useState, useRef, useEffect } from 'react'
import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'
import { Tooltip } from '@/components/ui'
import { ALL_FIELDS, formatValue, getColor, getFieldConfig, getLabel, getTooltip } from '@/config/fieldConfig'
import { MiniTower } from '@/components/ui'
import type React from 'react'
import { getPresetMeta } from '@/services/scanEngine'
import { getFieldsForGroup } from '@/fieldAvailability'

// ── Preset column overrides ─────────────────────────────────────────────────────

// Per-preset column overrides for presets whose fetcher has a limited SELECT.
const PRESET_COL_OVERRIDES: Partial<Record<string, string[]>> = {
  // Flower Pot Burst has its own metric surface — the price_action group's
  // breakout/score columns are all null here. Lead with compression + burst
  // fields (setup rows leave the burst-only columns blank, which is correct).
  flower_pot_burst: [
    'symbol', 'close', 'pct_chng', 'fpb_phase',
    'fpb_compression_score', 'fpb_atr_compression', 'fpb_vol_death', 'fpb_setup_days',
    'fpb_vol_burst', 'fpb_range_exp', 'fpb_close_strength', 'fpb_quality',
    'delivery_pct', 'rvol', 'rsi_14', 'magic_rs',
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
      <div style={{
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
                          width: 130, minWidth: 130,
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

      <div style={{
        marginTop: 6, fontSize: 10, color: 'var(--text-faint)',
        fontFamily: 'var(--font-mono)', textAlign: 'right',
      }}>
        {stocks.length} stocks
      </div>
    </div>
  )
}
