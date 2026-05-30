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
import WorkspaceBlock from './WorkspaceBlock'
import CatalogDrawer from '@/components/domain/Catalog/CatalogDrawer'
import { useVisibleOverlayPairs, ConfluencePairMonitor } from '@/hooks/useConfluenceDetection'
import { effectiveDotColor } from './overlayColors'
import { fetchActiveIndices, type IndexOption } from '@/services/indexPickerService'

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
        linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)
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
        border: '1px dashed rgba(255,255,255,.07)', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', minHeight: `${CELL_HEIGHT_REM}rem`,
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(124,106,247,0.35)'
        el.style.background = 'rgba(124,106,247,0.04)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,.07)'
        el.style.background = 'transparent'
      }}
    >
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.18)',
        fontFamily: 'var(--font-mono, monospace)' }}>+ block</span>
    </div>
  )
}

// ── Color picker popover ──────────────────────────────────────────────────────
// Uses position:fixed anchored to screen coords so the overflowX scroll
// container on the pill strip cannot clip it.

function ColorPicker({
  anchorX, anchorY, current, onSelect, onClose,
}: {
  anchorX: number; anchorY: number
  current: string; onSelect: (c: string) => void; onClose: () => void
}) {
  return (
    <>
      {/* Click-away backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 399 }} />
      <div style={{
        position: 'fixed', left: anchorX, top: anchorY + 8,
        background: '#1a1f2e', border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 10, padding: 10, zIndex: 400,
        boxShadow: '0 8px 24px rgba(0,0,0,.6)',
        width: 164,
      }}>
        {/* Swatches */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 8 }}>
          {COLOR_PRESETS.map(c => (
            <button
              key={c}
              onClick={() => { onSelect(c); onClose() }}
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
            if (/^#[0-9a-fA-F]{6}$/.test(val)) { onSelect(val); onClose() }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim()
              if (/^#[0-9a-fA-F]{6}$/.test(val)) { onSelect(val); onClose() }
            }
          }}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '4px 6px', borderRadius: 5,
            border: '1px solid rgba(255,255,255,.12)',
            background: 'rgba(255,255,255,.05)',
            color: 'rgba(255,255,255,.8)', fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            outline: 'none',
          }}
        />
      </div>
    </>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────

// ── Index dropdown (attached to the + index button) ───────────────────────────

function IndexDropdown({
  anchorX, anchorY, framework: fw, onClose,
}: {
  anchorX: number; anchorY: number
  framework: UserFramework
  onClose: () => void
}) {
  const [indices, setIndices] = useState<IndexOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const { addChartBlock } = useFrameworkStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchActiveIndices().then(data => { setIndices(data); setLoading(false) })
  }, [])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const activeIds = new Set(
    fw.blocks.filter(b => b.type === 'chart').map(b => b.catalog_item_id)
  )

  const filtered = indices.filter(idx =>
    idx.display_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top: anchorY + 6, left: anchorX,
        width: 280, maxHeight: 340, zIndex: 600,
        background: 'rgba(9,12,16,.98)',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
        <input
          autoFocus
          type="text"
          placeholder="Search indices…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '6px 10px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.04)',
            color: 'rgba(255,255,255,.8)', fontSize: 12,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center',
            fontSize: 11, color: 'rgba(255,255,255,.25)',
            fontFamily: 'var(--font-mono, monospace)' }}>
            loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center',
            fontSize: 12, color: 'rgba(255,255,255,.2)' }}>
            No results
          </div>
        ) : filtered.map(idx => {
          const added = activeIds.has(`chart:${idx.id}`)
          return (
            <button
              key={idx.id}
              onClick={() => { if (!added) { addChartBlock({ symbol: idx.symbol, id: idx.id, type: 'index' }); onClose() } }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '7px 12px', border: 'none',
                background: 'transparent', textAlign: 'left', cursor: added ? 'default' : 'pointer',
                opacity: added ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!added) (e.currentTarget as HTMLElement).style.background = 'rgba(124,106,247,.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{idx.display_name}</span>
              {added
                ? <span style={{ fontSize: 10, color: '#7c6af7', fontFamily: 'var(--font-mono,monospace)' }}>✓</span>
                : <span style={{ fontSize: 16, color: 'rgba(124,106,247,.5)' }}>+</span>
              }
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  framework: UserFramework
}

export default function WorkspaceCanvas({ framework }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerContext, setDrawerContext] = useState<'overlay' | 'block'>('block')
  const [picker, setPicker] = useState<{ id: string; x: number; y: number } | null>(null)
  const [indexDropdown, setIndexDropdown] = useState<{ x: number; y: number } | null>(null)

  // Block resize state
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null)
  const [resizingPos, setResizingPos] = useState<GridPosition | null>(null)
  const liveResizePosRef = useRef<GridPosition | null>(null)

  // Maximize state
  const [maximizedBlockId, setMaximizedBlockId] = useState<string | null>(null)

  // VaNi confluence detection — suppressed pairs (in-memory, Phase 5 adds DB)
  const [suppressedPairs, setSuppressedPairs] = useState<Set<string>>(new Set())
  const confluencePairs = useVisibleOverlayPairs()
  const handleSuppress = (key: string) =>
    setSuppressedPairs(prev => new Set([...prev, key]))

  const {
    removeBlock, updateBlockPosition, saveFramework,
    toggleOverlayVisibility, removeOverlay, updateOverlayColor,
  } = useFrameworkStore()

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Canvas topbar: overlay pills (left) + Edit Canvas (right) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,.07)',
        flexShrink: 0,
      }}>
        {/* Overlay pills */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {framework.chart_overlays.map(o => {
            const catalog  = getCatalogItem(o.catalog_item_id)
            const label    = catalog?.display_name ?? o.catalog_item_id.replace('astro_rule:', '')
            const dotColor = effectiveDotColor(o.catalog_item_id, o.type, o.color)
            const isPickerOpen = picker?.id === o.catalog_item_id

            return (
              <div
                key={o.catalog_item_id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 0,
                  borderRadius: 100, flexShrink: 0,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: o.visible ? 'rgba(255,255,255,.05)' : 'transparent',
                  opacity: o.visible ? 1 : 0.4,
                  transition: 'all .15s',
                }}
              >
                {/* Color dot — click to open picker */}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (isPickerOpen) { setPicker(null); return }
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setPicker({ id: o.catalog_item_id, x: rect.left, y: rect.bottom })
                  }}
                  title="Change color"
                  style={{
                    width: 14, height: 14, marginLeft: 8, padding: 0,
                    border: isPickerOpen ? '2px solid rgba(255,255,255,.6)' : '2px solid rgba(255,255,255,.2)',
                    borderRadius: '50%', cursor: 'pointer',
                    background: dotColor, flexShrink: 0,
                    transition: 'border-color .15s',
                  }}
                />

                {/* Toggle visibility */}
                <button
                  onClick={() => toggleOverlayVisibility(o.catalog_item_id)}
                  title={o.visible ? 'Click to hide' : 'Click to show'}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '4px 6px 4px 4px',
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                    color: o.visible ? 'var(--text-primary)' : 'rgba(255,255,255,.3)',
                  }}
                >
                  {label}
                </button>

                {/* Remove overlay */}
                <button
                  onClick={() => removeOverlay(o.catalog_item_id)}
                  title="Remove overlay"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: '0 100px 100px 0',
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', fontSize: 9,
                    color: 'rgba(255,255,255,.25)',
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.25)' }}
                >
                  ✕
                </button>
              </div>
            )
          })}

          {/* + overlay — opens Catalog drawer in overlay context */}
          <button
            onClick={openOverlayDrawer}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 100, flexShrink: 0,
              border: '1px dashed rgba(124,106,247,.3)', background: 'transparent',
              cursor: 'pointer', fontSize: 11,
              color: 'rgba(124,106,247,.7)', fontFamily: 'var(--font-mono, monospace)',
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'rgba(124,106,247,.6)'
              el.style.color = '#8b7af8'
              el.style.background = 'rgba(124,106,247,.06)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'rgba(124,106,247,.3)'
              el.style.color = 'rgba(124,106,247,.7)'
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
            border: '1px dashed rgba(255,255,255,.15)',
            background: 'transparent',
            color: 'rgba(255,255,255,.4)',
            transition: 'all .15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'rgba(124,106,247,.5)'
            el.style.color = '#8b7af8'
            el.style.background = 'rgba(124,106,247,.06)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'rgba(255,255,255,.15)'
            el.style.color = 'rgba(255,255,255,.4)'
            el.style.background = 'transparent'
          }}
        >
          + index
        </button>

        {/* Edit Canvas / Done Editing */}
        <button
          onClick={() => editMode ? exitEditMode() : setEditMode(true)}
          style={{
            padding: '6px 16px', borderRadius: 100, cursor: 'pointer', flexShrink: 0,
            fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            border: editMode ? 'none' : '1px solid rgba(255,255,255,.1)',
            background: editMode ? '#7c6af7' : 'transparent',
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
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)',
                  textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Your framework is empty.{' '}
                  <span
                    onClick={openBlockDrawer}
                    style={{ color: '#7c6af7', cursor: 'pointer', textDecoration: 'underline' }}
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
                  onRemove={(id) => {
                    const b = framework.blocks.find(bl => bl.id === id)
                    if (b?.catalog_item_id.startsWith('vani_corr:')) {
                      const parts = b.catalog_item_id.split(':').slice(1)
                      handleSuppress(`${parts[0]}:${parts.slice(1).join(':')}`)
                    }
                    removeBlock(id)
                  }}
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
      {picker && (
        <ColorPicker
          anchorX={picker.x}
          anchorY={picker.y}
          current={effectiveDotColor(
            picker.id,
            framework.chart_overlays.find(o => o.catalog_item_id === picker.id)?.type ?? '',
            framework.chart_overlays.find(o => o.catalog_item_id === picker.id)?.color,
          )}
          onSelect={c => updateOverlayColor(picker.id, c)}
          onClose={() => setPicker(null)}
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

      {/* VaNi confluence monitors — one per visible overlay pair, no render output */}
      {confluencePairs.map(([a, b]) => (
        <ConfluencePairMonitor
          key={`${a}:${b}`}
          itemA={a}
          itemB={b}
          suppressed={suppressedPairs}
          onSuppress={handleSuppress}
        />
      ))}
    </div>
  )
}
