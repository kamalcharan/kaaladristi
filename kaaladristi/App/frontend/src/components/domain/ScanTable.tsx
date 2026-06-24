import { useState, useRef, useEffect } from 'react'
import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'
import { Tooltip } from '@/components/ui'
import { ALL_FIELDS, formatValue, getColor, getFieldConfig, getLabel, getTooltip } from '@/config/fieldConfig'
import { MiniTower } from '@/components/ui'
import type React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type PresetGroup = 'stage' | 'conviction' | 'breakout' | 'breakout_surge' | 'standard'

// ── Preset groups & column sets ────────────────────────────────────────────────

// Per-preset column overrides for presets whose fetcher has a limited SELECT.
const PRESET_COL_OVERRIDES: Partial<Record<string, string[]>> = {}

const PRESET_GROUP: Record<string, PresetGroup> = {
  stage_2_leaders:      'stage',
  stage_2_watch:        'stage',
  vani_opportunity:     'stage',
  stage_3_watch:        'stage',
  stage_4_leaders:      'stage',
  vani_exit_watch:      'stage',
  conviction_flow:      'conviction',
  breakout_surge:       'breakout_surge',
  power_buy:            'standard',
  power_sell:           'standard',
  smart_money:          'standard',
  fresh_breakout:       'standard',
  quiet_accumulation:   'standard',
  distribution_warning: 'standard',
}

const DEFAULT_COLS: Record<PresetGroup, string[]> = {
  stage:          ['symbol','close','pct_chng','magic_rs','rs_percentile','stage','rsi_14','rvol','pctBelow52wHigh','mcap_cr','flow_type','sniper_inst','rss_value'],
  conviction:     ['symbol','close','pct_chng','delivery_surge_x','avg_amt_5d','avg_amt_22d','delivery_pct','rsi_14','ema_20','magic_rs'],
  breakout:       ['symbol','close','pct_chng','breakout_level','pct_from_breakout','rvol','rsi_14','magic_rs','stage','supertrend_dir'],
  breakout_surge: ['symbol','close','pct_chng','breakout_level','pct_from_breakout','rvol','rsi_14','magic_rs','stage','supertrend_dir'],
  standard:       ['symbol','close','pct_chng','magic_rs','rvol','rsi_14','flow_type','sniper_inst','rss_value','accum_distrib','supertrend_dir','mcap_cr'],
}

const OPTIONAL_COLS: Record<PresetGroup, string[]> = {
  stage:          ['sma_50','sma_200','supertrend_dir','accum_distrib','sniper_hot','w52_high','ema_20'],
  conviction:     ['ret_5d','ret_22d','mcap_cr','rss_value','sniper_inst'],
  breakout:       ['sniper_inst','rss_value','mcap_cr'],
  breakout_surge: ['sniper_inst','rss_value','ret_5d','ret_22d','mcap_cr'],
  standard:       ['sniper_hot','ema_20'],
}

const DEFAULT_SORT: Record<string, { key: string; dir: 'asc' | 'desc' }> = {
  stage_2_leaders:  { key: 'magic_rs',         dir: 'desc' },
  stage_2_watch:    { key: 'rs_percentile',     dir: 'desc' },
  vani_opportunity: { key: 'rs_percentile',     dir: 'desc' },
  stage_4_leaders:  { key: 'rs_percentile',     dir: 'asc'  },
  stage_3_watch:    { key: 'rs_percentile',     dir: 'asc'  },
  vani_exit_watch:  { key: 'rs_percentile',     dir: 'asc'  },
  conviction_flow:  { key: 'delivery_surge_x',  dir: 'desc' },
  breakout_surge:   { key: 'rvol',              dir: 'desc' },
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
  const group: PresetGroup = PRESET_GROUP[presetId] ?? 'standard'
  const ds = getDefaultSort(presetId)

  const [sortKey, setSortKey]   = useState(ds.key)
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>(ds.dir)
  const [gearOpen, setGearOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)

  const storageKey = `scan_cols:${presetId}`
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return new Set<string>(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return new Set<string>()
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

  const optionalCols  = OPTIONAL_COLS[group]
  const defaultCols   = PRESET_COL_OVERRIDES[presetId] ?? DEFAULT_COLS[group]

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
        maxHeight: 'calc(100vh - 180px)',
        width: '100%',
        WebkitOverflowScrolling: 'touch',
        border: '1px solid var(--border)',
        borderRadius: 10,
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
                      fontWeight: 600, fontFamily: 'var(--font-mono)',
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
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
                        style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          background: 'inherit',
                          padding: '0 10px',
                          width: 130, minWidth: 130,
                          borderBottom: '1px solid rgba(99,102,241,0.05)',
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
                                  background: 'rgba(255,255,255,0.06)',
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
                        borderBottom: '1px solid rgba(99,102,241,0.05)',
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
