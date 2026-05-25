import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { UserFramework, GridPosition } from '@/types/framework'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceBlock from './WorkspaceBlock'

const COLS = 12
const ROWS = 10
const CELL_HEIGHT_REM = 6

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

function AddZone({ col, row }: { col: number; row: number }) {
  return (
    <div style={{
      gridColumnStart: col, gridColumnEnd: col + 2,
      gridRowStart: row, gridRowEnd: row + 1,
      border: '1px dashed rgba(255,255,255,.07)', borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'default', minHeight: `${CELL_HEIGHT_REM}rem`,
    }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.12)',
        fontFamily: 'var(--font-mono, monospace)' }}>+ block</span>
    </div>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────

interface Props {
  framework: UserFramework
}

export default function WorkspaceCanvas({ framework }: Props) {
  const [editMode, setEditMode] = useState(false)
  const { removeBlock, updateBlockPosition, saveFramework } = useFrameworkStore()

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }))

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

    if (newPos.col_end - newPos.col_start < 2) newPos.col_end = newPos.col_start + 2
    if (newPos.row_end - newPos.row_start < 1) newPos.row_end = newPos.row_start + 1

    updateBlockPosition(String(active.id), newPos)
  }

  function exitEditMode() {
    setEditMode(false)
    saveFramework()
  }

  const isEmpty = framework.blocks.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Canvas topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.07)',
        flexShrink: 0, gap: 10 }}>
        <button
          onClick={() => editMode ? exitEditMode() : setEditMode(true)}
          style={{
            padding: '6px 16px', borderRadius: 100, cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            border: editMode ? 'none' : '1px solid rgba(255,255,255,.1)',
            background: editMode ? '#7c6af7' : 'transparent',
            color: editMode ? '#fff' : 'var(--text-muted)',
            transition: 'all .2s ease',
          }}>
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
                  <span style={{ color: '#7c6af7' }}>Add blocks from the Catalog.</span>
                </p>
              </div>
            )}

            {framework.blocks.map(block => (
              <WorkspaceBlock
                key={block.id}
                block={block}
                editMode={editMode}
                onRemove={removeBlock}
              />
            ))}

            {editMode && isEmpty && [1, 3, 5, 7, 9, 11].map(col => (
              <AddZone key={col} col={col} row={2} />
            ))}
            {editMode && !isEmpty && (
              <AddZone col={1} row={ROWS} />
            )}
          </div>
        </DndContext>
      </div>
    </div>
  )
}
