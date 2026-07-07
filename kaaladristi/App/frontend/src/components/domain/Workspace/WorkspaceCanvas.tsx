import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { UserFramework, GridPosition } from '@/types/framework'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { getCatalogItem } from '@/constants/catalogItems'
import { astroGroupPillLabel } from '@/constants/astroGroupOverlays'
import { useActiveRuleToday } from '@/hooks/useRuleInsight'
import OverlayExplainPopover from '@/components/domain/VaNi/OverlayExplainPopover'
import WorkspaceBlock from './WorkspaceBlock'
import WorkspaceActionIsland from './WorkspaceActionIsland'
import CatalogDrawer from '@/components/domain/Catalog/CatalogDrawer'
import { useVisibleOverlayPairs, ConfluencePairMonitor, GroupOverlapMonitor } from '@/hooks/useConfluenceDetection'
import { effectiveDotColor } from './overlayColors'
import IndexDropdown from '@/components/domain/IndexDropdown'

const COLS            = 24
const ROWS            = 20
const CELL_HEIGHT_REM = 3

// Preset swatches for the color picker
const COLOR_PRESETS = [
  '#FFD700', '#FFA500', '#FF6347', '#ef4444',
  '#10b981', '#2dd4bf', '#6366f1', '#8b7af8',
  '#c9a84c', '#f59e0b', '#e879f9', '#ffffff',
]

// ── Grid overlay (edit mode) ──────────────────────────────────────────────────

function GridOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: `
        linear-gradient(color-mix(in srgb, var(--text-primary) 4%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 4%, transparent) 1px, transparent 1px)
      `,
      backgroundSize: `${100 / COLS}% ${CELL_HEIGHT_REM}rem`,
    }} />
  )
}

// ── Add-zone placeholder (edit mode, empty cells) ─────────────────────────────

function AddZone({ col, row, onClick }: { col: number; row: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        gridColumnStart: col, gridColumnEnd: col + 2,
        gridRowStart: row, gridRowEnd: row + 1,
        border: '1px dashed color-mix(in srgb, var(--text-primary) 7%, transparent)', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', minHeight: `${CELL_HEIGHT_REM}rem`,
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--accent-dim)'
        el.style.background = 'var(--accent-glow)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'color-mix(in srgb, var(--text-primary) 7%, transparent)'
        el.style.background = 'transparent'
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-faint)',
        fontFamily: 'var(--font-mono, monospace)' }}>+ block</span>
    </div>
  )
}

// ── Group overlay "active today" indicator ────────────────────────────────────
// On a group pill (e.g. ☿ Mercury): when the highest-confidence rule in that tag
// is active today → green dot + short rule-name suffix + rich tooltip. When none
// active but one is upcoming → gray dot + "next" tooltip. Otherwise renders nothing.
function shortRuleName(displayName: string): string {
  return displayName
    .replace('Mercury', 'Mer').replace('Venus', 'Ven').replace('Jupiter', 'Jup')
    .replace('Saturn', 'Sat').replace('Conjunction', 'Conj').replace('Retrograde', 'Rx')
    .replace('Combust', 'Cmb').replace('Manifestation', 'Mfst')
    .replace(/Same Nakshatra.*/, 'Nak')
    .replace(/\s+/g, ' ').trim().substring(0, 20)
}

const _MD_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtMD(iso: string | null | undefined): string {
  if (!iso) return ''
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${_MD_MON[+m - 1]}`
}

function GroupActiveIndicator({ tag }: { tag: string }) {
  const { data } = useActiveRuleToday(tag)
  const active   = data?.active_now?.[0]
  const upcoming = data?.upcoming?.[0]

  if (active) {
    const hist = active.confidence_score != null
      ? `\nHistorical: ${Math.round(active.confidence_score)}% ${active.base_bias ?? ''}`
        + (active.avg_return_matched != null
            ? `, avg ${active.avg_return_matched >= 0 ? '+' : ''}${active.avg_return_matched.toFixed(1)}%`
            : '')
      : ''
    const tip =
      `${active.display_name}${active.base_bias ? ` · ${active.base_bias}` : ''}\n`
      + `Started ${fmtMD(active.start_date)} · ends ${fmtMD(active.end_date)}`
      + (active.days_remaining != null ? ` (${active.days_remaining} days left)` : '')
      + hist
    return (
      <span title={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 2, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono,monospace)' }}>
          · {shortRuleName(active.display_name)}
        </span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981',
          boxShadow: '0 0 5px rgba(16,185,129,0.8)', flexShrink: 0 }} />
      </span>
    )
  }

  if (upcoming) {
    const tip =
      `Next: ${upcoming.display_name}\n`
      + `Starts ${fmtMD(upcoming.start_date)}`
      + (upcoming.days_until != null ? ` · in ${upcoming.days_until} days` : '')
      + (upcoming.confidence_score != null
          ? `\nHistorical: ${Math.round(upcoming.confidence_score)}% ${upcoming.base_bias ?? ''}`
          : '')
    return (
      <span title={tip} style={{ width: 6, height: 6, borderRadius: '50%', background: 'color-mix(in srgb, var(--text-primary) 35%, transparent)',
        marginLeft: 6, flexShrink: 0, display: 'inline-block' }} />
    )
  }

  return null
}

// ── Color picker popover ──────────────────────────────────────────────────────
// Uses position:fixed anchored to screen coords so the overflowX scroll
// container on the pill strip cannot clip it.

function ColorPicker({
  anchorX, anchorY, current, currentOpacity, onSelect, onSelectOpacity, onClose,
}: {
  anchorX: number; anchorY: number
  current: string
  currentOpacity?: number
  onSelect: (c: string) => void
  onSelectOpacity?: (o: number) => void
  onClose: () => void
}) {
  const showOpacity = onSelectOpacity != null
  return (
    <>
      {/* Click-away backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 399 }} />
      <div style={{
        position: 'fixed', left: anchorX, top: anchorY + 8,
        background: 'var(--card)', border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
        borderRadius: 10, padding: 10, zIndex: 400,
        boxShadow: '0 8px 24px rgba(0,0,0,.6)',
        width: 164,
      }}>
        {/* Swatches */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 8 }}>
          {COLOR_PRESETS.map(c => (
            <button
              key={c}
              onClick={() => { onSelect(c) }}
              title={c}
              style={{
                width: 20, height: 20, borderRadius: 4, border: 'none',
                background: c, cursor: 'pointer',
                outline: c === current ? '2px solid #fff' : '2px solid transparent',
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
        {/* Hex input */}
        <input
          type="text"
          defaultValue={current}
          maxLength={7}
          placeholder="#rrggbb"
          onBlur={e => {
            const val = e.target.value.trim()
            if (/^#[0-9a-fA-F]{6}$/.test(val)) onSelect(val)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim()
              if (/^#[0-9a-fA-F]{6}$/.test(val)) onSelect(val)
            }
          }}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '4px 6px', borderRadius: 5,
            border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
            background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
            color: 'var(--text-secondary)', fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            outline: 'none',
          }}
        />
        {/* Opacity slider — only for astro zone overlays */}
        {showOpacity && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)' }}>opacity</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono, monospace)' }}>
                {Math.round((currentOpacity ?? 0.08) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={1} max={30} step={1}
              value={Math.round((currentOpacity ?? 0.08) * 100)}
              onChange={e => onSelectOpacity(Number(e.target.value) / 100)}
              style={{ width: '100%', accentColor: current, cursor: 'pointer' }}
            />
          </div>
        )}
        {/* Done button — closes without auto-close on swatch click */}
        <button
          onClick={onClose}
          style={{
            marginTop: 8, width: '100%', padding: '3px 0',
            borderRadius: 5, border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
            background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', color: 'var(--text-secondary)',
            fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          done
        </button>
      </div>
    </>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────

interface Props {
  framework: UserFramework
  onOpenDrawer?: (pairKey: string | null) => void
  onMorningBrief?: () => void
  islandOffset?: number
}

export default function WorkspaceCanvas({ framework, onOpenDrawer, onMorningBrief, islandOffset = 0 }: Props) {
  const confluencePairs = useVisibleOverlayPairs()
  const [editMode, setEditMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerContext, setDrawerContext] = useState<'overlay' | 'block'>('block')
  const [picker, setPicker] = useState<{ id: string; x: number; y: number } | null>(null)
  const [explain, setExplain] = useState<{ tag: string; x: number; y: number } | null>(null)
  const [indexDropdown, setIndexDropdown] = useState<{ x: number; y: number } | null>(null)

  // Block resize state
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null)
  const [resizingPos, setResizingPos] = useState<GridPosition | null>(null)
  const liveResizePosRef = useRef<GridPosition | null>(null)

  // Maximize state
  const [maximizedBlockId, setMaximizedBlockId] = useState<string | null>(null)

  const {
    removeBlock, updateBlockPosition, saveFramework,
    toggleOverlayVisibility, removeOverlay, updateOverlayColor, updateOverlayOpacity, updateOverlayConfig,
  } = useFrameworkStore()

  const primarySymbol = framework.blocks.find(b => b.type === 'chart')
    ?.config.instrument ? (framework.blocks.find(b => b.type === 'chart')!.config.instrument as { symbol: string }).symbol : 'index'

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }))

  function openOverlayDrawer() {
    setDrawerContext('overlay')
    setDrawerOpen(true)
  }

  function openBlockDrawer() {
    setDrawerContext('block')
    setDrawerOpen(true)
  }

  // ── Block resize ───────────────────────────────────────────────────────────
  function handleBlockResizeStart(
    blockId: string, startX: number, startY: number, startPos: GridPosition, dir: 'h' | 'v' | 'both',
  ) {
    const canvasEl = document.getElementById('workspace-grid')
    if (!canvasEl) return
    const { width, height } = canvasEl.getBoundingClientRect()
    // Cell step = (canvas - 2×padding - (N-1)×gap) / N — more accurate than width/N
    const colStep = (width  - 32 - (COLS - 1) * 8) / COLS
    const rowStep = (height - 32 - (ROWS - 1) * 8) / ROWS

    liveResizePosRef.current = { ...startPos }
    setResizingBlockId(blockId)
    setResizingPos({ ...startPos })

    function onMove(e: MouseEvent) {
      const dCols = (dir === 'h' || dir === 'both') ? Math.round((e.clientX - startX) / colStep) : 0
      const dRows = (dir === 'v' || dir === 'both') ? Math.round((e.clientY - startY) / rowStep) : 0
      const newPos: GridPosition = {
        ...startPos,
        col_end: Math.max(startPos.col_start + 4, Math.min(COLS + 1, startPos.col_end + dCols)),
        row_end: Math.max(startPos.row_start + 2, Math.min(ROWS + 1, startPos.row_end + dRows)),
      }
      liveResizePosRef.current = newPos
      setResizingPos(newPos)
    }

    function onUp() {
      if (liveResizePosRef.current) updateBlockPosition(blockId, liveResizePosRef.current)
      liveResizePosRef.current = null
      setResizingBlockId(null)
      setResizingPos(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }


  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event
    if (!delta.x && !delta.y) return

    const block = framework.blocks.find(b => b.id === active.id)
    if (!block) return

    const canvasEl = document.getElementById('workspace-grid')
    if (!canvasEl) return
    const { width, height } = canvasEl.getBoundingClientRect()
    const colWidth  = width  / COLS
    const rowHeight = height / ROWS

    const colDelta = Math.round(delta.x / colWidth)
    const rowDelta = Math.round(delta.y / rowHeight)
    if (!colDelta && !rowDelta) return

    const pos = block.grid_position
    const newPos: GridPosition = {
      col_start: Math.max(1, Math.min(COLS - 1, pos.col_start + colDelta)),
      col_end:   Math.max(2, Math.min(COLS + 1, pos.col_end   + colDelta)),
      row_start: Math.max(1, Math.min(ROWS - 1, pos.row_start + rowDelta)),
      row_end:   Math.max(2, Math.min(ROWS + 1, pos.row_end   + rowDelta)),
    }

    if (newPos.col_end - newPos.col_start < 4) newPos.col_end = newPos.col_start + 4
    if (newPos.row_end - newPos.row_start < 2) newPos.row_end = newPos.row_start + 2

    updateBlockPosition(String(active.id), newPos)
  }

  function exitEditMode() {
    setEditMode(false)
    saveFramework()
  }

  const isEmpty = !framework.blocks.some(b => b.type !== 'chart')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* ── Canvas topbar: overlay pills (left) + Edit Canvas (right) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)',
        flexShrink: 0,
      }}>
        {/* Overlay pills — grouped by tag so all Mercury rules = 1 pill, all Panchak = 1 pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {(() => {
            // Derive a group key from an overlay's catalog_item_id
            function overlayGroupKey(catalogItemId: string): string {
              const rawCode = catalogItemId.replace('astro_rule:', '')
              if (rawCode.startsWith('PNK')) return 'Panchak'
              // For non-astro overlays (indicator lines etc.) use the id itself
              if (!catalogItemId.startsWith('astro_rule:')) return catalogItemId
              // For astro rules: use the stored label's first word, or rule_code prefix
              return rawCode.split('-')[0] || rawCode
            }

            // Group overlays by their group key, preserving insertion order
            const groups = new Map<string, typeof framework.chart_overlays>()
            for (const o of framework.chart_overlays) {
              const key = overlayGroupKey(o.catalog_item_id)
              const arr = groups.get(key) ?? []
              arr.push(o)
              groups.set(key, arr)
            }

            // Group label — human-readable name for the pill
            const GROUP_LABELS: Record<string, string> = {
              Panchak: 'Panchak',
              MER: 'Mercury', VEN: 'Venus', BAY: 'Bayer',
              CON: 'Conjunction', TRN: 'Transit', TR: 'Transit',
              DN: 'Day-Nakshatra',
            }

            return Array.from(groups.entries()).map(([groupKey, overlays]) => {
              // Non-astro single overlay (indicator line etc.) — render as before
              if (overlays.length === 1 && !overlays[0].catalog_item_id.startsWith('astro_rule:')) {
                const o = overlays[0]
                const catalog = getCatalogItem(o.catalog_item_id)
                // Group overlays (astro_group:*) render a glyph-prefixed label
                const label = astroGroupPillLabel(o.catalog_item_id) ?? o.label ?? catalog?.display_name ?? o.catalog_item_id
                const dotColor = effectiveDotColor(o.catalog_item_id, o.type, o.color)
                const isPickerOpen = picker?.id === o.catalog_item_id
                return (
                  <div key={groupKey}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 100, flexShrink: 0,
                      border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
                      background: o.visible ? 'color-mix(in srgb, var(--text-primary) 5%, transparent)' : 'transparent',
                      opacity: o.visible ? 1 : 0.4, transition: 'all .15s' }}
                    onContextMenu={e => {
                      if (!o.catalog_item_id.startsWith('astro_group:')) return
                      e.preventDefault()
                      setExplain({ tag: o.catalog_item_id.slice('astro_group:'.length), x: e.clientX, y: e.clientY })
                    }}
                  >
                    <button onClick={e => { e.stopPropagation(); if (isPickerOpen) { setPicker(null); return }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setPicker({ id: o.catalog_item_id, x: rect.left, y: rect.bottom }) }}
                      title="Change color"
                      style={{ width: 14, height: 14, marginLeft: 8, padding: 0,
                        border: isPickerOpen ? '2px solid color-mix(in srgb, var(--text-primary) 60%, transparent)' : '2px solid color-mix(in srgb, var(--text-primary) 20%, transparent)',
                        borderRadius: '50%', cursor: 'pointer', background: dotColor, flexShrink: 0, transition: 'border-color .15s' }}
                    />
                    <button onClick={() => toggleOverlayVisibility(o.catalog_item_id)}
                      style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 6px 4px 4px',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                        color: o.visible ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >{label}</button>
                    {o.catalog_item_id === 'gann_sq9' && (() => {
                      const showOrdinal = !!(o.config?.show_ordinal)
                      return (
                        <button
                          title={showOrdinal ? 'Showing all 8 angles — click to show cardinals only' : 'Showing cardinal angles only — click to show all 8'}
                          onClick={e => { e.stopPropagation(); updateOverlayConfig('gann_sq9', { show_ordinal: !showOrdinal }) }}
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '2px 6px', marginRight: 2, borderRadius: 4,
                            border: `1px solid ${showOrdinal ? 'rgba(245,166,35,0.5)' : 'color-mix(in srgb, var(--text-primary) 10%, transparent)'}`,
                            background: showOrdinal ? 'rgba(245,166,35,0.12)' : 'transparent',
                            cursor: 'pointer', fontSize: 9,
                            fontFamily: 'var(--font-mono, monospace)',
                            color: showOrdinal ? '#F5A623' : 'var(--text-muted)',
                            transition: 'all .15s',
                          }}
                        >
                          45°
                        </button>
                      )
                    })()}
                    {o.catalog_item_id.startsWith('astro_group:') && (
                      <GroupActiveIndicator tag={o.catalog_item_id.slice('astro_group:'.length)} />
                    )}
                    {o.catalog_item_id.startsWith('astro_group:') && (
                      <button
                        title={`What is ${label} active today?`}
                        onClick={e => {
                          e.stopPropagation()
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setExplain({ tag: o.catalog_item_id.slice('astro_group:'.length), x: rect.left, y: rect.bottom })
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 11, color: 'rgba(157,143,249,.7)', transition: 'color .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#9d8ff9' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(157,143,249,.7)' }}
                      >ⓘ</button>
                    )}
                    <button onClick={() => removeOverlay(o.catalog_item_id)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: '0 100px 100px 0',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: 9, color: 'var(--text-faint)', transition: 'color .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)' }}
                    >✕</button>
                  </div>
                )
              }

              // Grouped astro overlays — ONE pill for the whole group
              const allVisible = overlays.every(o => o.visible)
              const anyVisible = overlays.some(o => o.visible)
              // Use color from the first overlay in the group
              const groupColor = overlays[0].color ?? effectiveDotColor(overlays[0].catalog_item_id, overlays[0].type, overlays[0].color)
              const pillLabel = GROUP_LABELS[groupKey] ?? groupKey
              const countBadge = overlays.length > 1 ? ` ·${overlays.length}` : ''

              return (
                <div key={groupKey}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 100, flexShrink: 0,
                    border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
                    background: anyVisible ? 'color-mix(in srgb, var(--text-primary) 5%, transparent)' : 'transparent',
                    opacity: anyVisible ? 1 : 0.4, transition: 'all .15s' }}
                  onContextMenu={e => { e.preventDefault(); setExplain({ tag: pillLabel, x: e.clientX, y: e.clientY }) }}
                >
                  {/* Group color dot */}
                  <span style={{ width: 10, height: 10, marginLeft: 8, borderRadius: '50%', flexShrink: 0,
                    background: groupColor, border: '2px solid color-mix(in srgb, var(--text-primary) 20%, transparent)', display: 'inline-block' }} />

                  {/* Toggle all in group */}
                  <button
                    onClick={() => { for (const o of overlays) if (o.visible === allVisible) toggleOverlayVisibility(o.catalog_item_id) }}
                    title={allVisible ? 'Click to hide all' : 'Click to show all'}
                    style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 6px 4px 4px',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                      color: anyVisible ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {pillLabel}
                    {countBadge && (
                      <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 1 }}>{countBadge}</span>
                    )}
                  </button>

                  {/* Explain — active rule today + VaNi interpretation */}
                  <button
                    title={`What is ${pillLabel} active today?`}
                    onClick={e => {
                      e.stopPropagation()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setExplain({ tag: pillLabel, x: rect.left, y: rect.bottom })
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 11, color: 'rgba(157,143,249,.7)', transition: 'color .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#9d8ff9' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(157,143,249,.7)' }}
                  >ⓘ</button>

                  {/* Remove all in group */}
                  <button
                    onClick={() => { for (const o of overlays) removeOverlay(o.catalog_item_id) }}
                    title={`Remove all ${pillLabel} overlays`}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, borderRadius: '0 100px 100px 0',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 9, color: 'var(--text-faint)', transition: 'color .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)' }}
                  >✕</button>
                </div>
              )
            })
          })()}

          {/* + overlay — opens Catalog drawer in overlay context */}
          <button
            onClick={openOverlayDrawer}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 100, flexShrink: 0,
              border: '1px dashed color-mix(in srgb, var(--accent) 30%, transparent)', background: 'transparent',
              cursor: 'pointer', fontSize: 11,
              color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)',
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--accent)'
              el.style.color = 'var(--accent)'
              el.style.background = 'var(--accent-glow)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--accent-glow)'
              el.style.color = 'var(--accent)'
              el.style.background = 'transparent'
            }}
          >
            + overlay
          </button>
        </div>

        {/* + index */}
        <button
          onClick={e => {
            if (indexDropdown) { setIndexDropdown(null); return }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setIndexDropdown({ x: rect.left, y: rect.bottom })
          }}
          style={{
            padding: '6px 14px', borderRadius: 100, cursor: 'pointer', flexShrink: 0,
            fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
            border: '1px dashed color-mix(in srgb, var(--text-primary) 15%, transparent)',
            background: 'transparent',
            color: 'var(--text-muted)',
            transition: 'all .15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--accent)'
            el.style.color = 'var(--accent)'
            el.style.background = 'var(--accent-glow)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'color-mix(in srgb, var(--text-primary) 15%, transparent)'
            el.style.color = 'var(--text-muted)'
            el.style.background = 'transparent'
          }}
        >
          {primarySymbol} ▾
        </button>

        {/* Edit Canvas / Done Editing */}
        <button
          onClick={() => editMode ? exitEditMode() : setEditMode(true)}
          style={{
            padding: '6px 16px', borderRadius: 100, cursor: 'pointer', flexShrink: 0,
            fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            border: editMode ? 'none' : '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
            background: editMode ? 'var(--accent)' : 'transparent',
            color: editMode ? '#fff' : 'var(--text-muted)',
            transition: 'all .2s ease',
          }}
        >
          {editMode ? 'Done Editing' : 'Edit Canvas'}
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        {editMode && <GridOverlay />}

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            id="workspace-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, ${CELL_HEIGHT_REM}rem)`,
              gap: 8,
              padding: 16,
              minHeight: `${ROWS * CELL_HEIGHT_REM + (ROWS - 1) * 0.5}rem`,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {isEmpty && !editMode && (
              <div style={{
                gridColumn: '1 / -1', gridRow: '1 / 4',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 32, opacity: .3 }}>◎</div>
                <p style={{ fontSize: 13, color: 'var(--text-faint)',
                  textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Your framework is empty.{' '}
                  <span
                    onClick={openBlockDrawer}
                    style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Add blocks from the Catalog.
                  </span>
                </p>
              </div>
            )}

            {framework.blocks.map(block => {
              const isMaximized = maximizedBlockId === block.id
              const effectivePosition: GridPosition = isMaximized
                ? { col_start: 1, col_end: COLS + 1, row_start: 1, row_end: ROWS + 1 }
                : (resizingBlockId === block.id && resizingPos)
                  ? resizingPos
                  : block.grid_position
              return (
                <WorkspaceBlock
                  key={block.id}
                  block={block}
                  editMode={editMode}
                  isDraggable={editMode && !resizingBlockId && !isMaximized}
                  effectivePosition={effectivePosition}
                  isMaximized={isMaximized}
                  onRemove={removeBlock}
                  onResizeStart={handleBlockResizeStart}
                  onMaximize={setMaximizedBlockId}
                />
              )
            })}

            {editMode && isEmpty && (
              <AddZone col={9} row={1} onClick={openBlockDrawer} />
            )}
            {editMode && !isEmpty && (
              <AddZone col={9} row={ROWS} onClick={openBlockDrawer} />
            )}
          </div>
        </DndContext>
      </div>

      <CatalogDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        context={drawerContext}
      />

      {/* Color picker — rendered at root so overflow:auto on pill strip can't clip it */}
      {picker && (() => {
        const pickerOverlay = framework.chart_overlays.find(o => o.catalog_item_id === picker.id)
        const isAstroZone  = pickerOverlay?.type === 'astro_zone'
        const handleOpacity = isAstroZone
          ? (o: number) => updateOverlayOpacity(picker.id, o)
          : undefined
        return (
          <ColorPicker
            anchorX={picker.x}
            anchorY={picker.y}
            current={effectiveDotColor(
              picker.id,
              pickerOverlay?.type ?? '',
              pickerOverlay?.color,
            )}
            currentOpacity={pickerOverlay?.opacity}
            onSelect={c => updateOverlayColor(picker.id, c)}
            onSelectOpacity={handleOpacity}
            onClose={() => setPicker(null)}
          />
        )
      })()}

      {/* Overlay explain popover — active rule today + VaNi interpretation */}
      {explain && (
        <OverlayExplainPopover
          tag={explain.tag}
          anchorX={explain.x}
          anchorY={explain.y}
          onClose={() => setExplain(null)}
        />
      )}

      {/* Index dropdown */}
      {indexDropdown && (
        <IndexDropdown
          anchorX={indexDropdown.x}
          anchorY={indexDropdown.y}
          framework={framework}
          onClose={() => setIndexDropdown(null)}
        />
      )}

      <WorkspaceActionIsland onOpen={onOpenDrawer ?? (() => {})} onMorningBrief={onMorningBrief} bottomOffset={islandOffset} />

      {/* VaNi confluence monitors — one per visible overlay pair, no render output */}
      {confluencePairs.map(([a, b]) => (
        <ConfluencePairMonitor key={`${a}:${b}`} itemA={a} itemB={b} />
      ))}

      {/* Intra-group overlap monitors (Overlap Visibility Phases 3-4) — one
          per visible GROUP overlay: pairs of the group's rules active today
          surface on the island as their own confluence chips. */}
      {(framework.chart_overlays ?? [])
        .filter(o => o.visible && o.catalog_item_id.startsWith('astro_group:'))
        .map(o => {
          const tag = o.catalog_item_id.slice('astro_group:'.length)
          return <GroupOverlapMonitor key={o.catalog_item_id} tag={tag} />
        })}
    </div>
  )
}
