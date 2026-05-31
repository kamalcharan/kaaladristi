import { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { FrameworkBlock, GridPosition, InstrumentRef } from '@/types/framework'
import { getCatalogItem } from '@/constants/catalogItems'
import MagicRsWidget from '@/components/domain/Catalog/widgets/MagicRsWidget'
import OrderFlowWidget from '@/components/domain/Catalog/widgets/OrderFlowWidget'
import SmartMoneyWidget from '@/components/domain/Catalog/widgets/SmartMoneyWidget'
import RsiWidget from '@/components/domain/Catalog/widgets/RsiWidget'
import WorkspaceTimelineWidget from '@/components/domain/Catalog/widgets/WorkspaceTimelineWidget'
import BreadthRocChart from '@/components/domain/BreadthRocChart'
import SixDayOutlookCompact from '@/components/domain/DashboardV3/SixDayOutlookCompact'
import WorkspaceChart from '@/components/workspace/WorkspaceChart'

const TODAY = new Date().toISOString().slice(0, 10)

const CHART_DISPLAY: Record<string, string> = {
  NIFTY50:   'NIFTY 50',
  NIFTY:     'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT:   'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
}

interface Props {
  block:             FrameworkBlock
  editMode:          boolean
  isDraggable:       boolean
  effectivePosition: GridPosition
  isMaximized:       boolean
  onRemove:          (id: string) => void
  onResizeStart:     (blockId: string, startX: number, startY: number, startPos: GridPosition, dir: 'h' | 'v' | 'both') => void
  onMaximize:        (blockId: string | null) => void
}

const TYPE_ICON: Record<string, string> = {
  indicator:        '〰️',
  widget:           '⚡',
  scanner:          '🔍',
  astro_rule:       '🪐',
  vani_correlation: '✦',
  chart:            '📈',
}

const PLACEMENT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  chart_overlay: { label: 'Chart Overlay', color: '#2dd4bf', bg: 'rgba(45,212,191,.1)'  },
  panel_block:   { label: 'Panel Block',   color: 'var(--gold)', bg: 'var(--gold-bg)'  },
  output_panel:  { label: 'Output Panel',  color: 'var(--accent)', bg: 'var(--accent-glow)' },
}

// Catalog item IDs that render live components in the workspace
const LIVE_IDS = new Set([
  'magic_rs', 'order_flow', 'smart_money', 'rsi_14', 'breadth_roc', 'six_day_outlook', 'chart_player',
])

function BlockContent({ block }: { block: FrameworkBlock }) {
  if (block.type === 'chart') {
    const instrument = block.config.instrument as InstrumentRef
    return <WorkspaceChart instrument={instrument} />
  }

  const { catalog_item_id: catalogItemId } = block
  const description = getCatalogItem(catalogItemId)?.description

  if (LIVE_IDS.has(catalogItemId)) {
    if (catalogItemId === 'magic_rs')        return <MagicRsWidget />
    if (catalogItemId === 'order_flow')      return <OrderFlowWidget />
    if (catalogItemId === 'smart_money')     return <SmartMoneyWidget />
    if (catalogItemId === 'rsi_14')          return <RsiWidget />
    if (catalogItemId === 'chart_player')    return <WorkspaceTimelineWidget />
    if (catalogItemId === 'breadth_roc')     return <BreadthRocChart />
    if (catalogItemId === 'six_day_outlook') return <SixDayOutlookCompact date={TODAY} />
  }

  // Placeholder for unimplemented blocks
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 12px' }}>
      {description
        ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', lineHeight: 1.5,
            textAlign: 'center' }}>{description}</span>
        : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.12)',
            fontFamily: 'var(--font-mono, monospace)' }}>{catalogItemId}</span>
      }
    </div>
  )
}

export default function WorkspaceBlock({ block, editMode, isDraggable, effectivePosition, isMaximized, onRemove, onResizeStart, onMaximize }: Props) {
  const isChart = block.type === 'chart'
  const isVaNi  = block.added_by === 'vani' && !isChart
  const catalog = getCatalogItem(block.catalog_item_id)
  const icon    = TYPE_ICON[block.type] ?? '◎'

  // For chart blocks, derive display name from the instrument config
  const chartInstrument = isChart ? (block.config.instrument as InstrumentRef) : null
  const name = isChart
    ? (CHART_DISPLAY[chartInstrument?.symbol?.toUpperCase() ?? ''] ?? chartInstrument?.symbol ?? 'Chart')
    : (catalog?.display_name ?? block.catalog_item_id)

  const badge = PLACEMENT_BADGE[block.placement] ?? PLACEMENT_BADGE.panel_block

  // Drag — disabled when not isDraggable (covers edit-mode off AND resize-in-progress)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:       block.id,
    disabled: !isDraggable,
  })

  // Right-click context menu
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos,  setMenuPos]  = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setMenuOpen(true)
  }

  return (
    <div
      ref={setNodeRef}
      onContextMenu={handleContextMenu}
      style={{
        gridColumnStart: effectivePosition.col_start,
        gridColumnEnd:   effectivePosition.col_end,
        gridRowStart:    effectivePosition.row_start,
        gridRowEnd:      effectivePosition.row_end,
        transform:       CSS.Translate.toString(transform),
        opacity:         isDragging ? 0.5 : 1,
        zIndex:          isMaximized ? 50 : isDragging ? 100 : undefined,
        position:        'relative',
        border:          isVaNi
          ? '1px solid var(--accent-solid)'
          : '1px solid rgba(255,255,255,.08)',
        borderRadius: 10,
        background: 'var(--card)',
        boxShadow: editMode
          ? '0 4px 20px rgba(0,0,0,.4)'
          : isVaNi
            ? '0 0 0 1px var(--accent-glow), 0 0 20px var(--accent-glow)'
            : 'none',
        transition: isDragging ? undefined : 'box-shadow .2s, border-color .2s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* VaNi glow overlay */}
      {isVaNi && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 10,
          background: 'radial-gradient(ellipse at top left, var(--accent-glow) 0%, transparent 60%)' }} />
      )}

      {/* Block header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px',
        flexShrink: 0, position: 'relative', zIndex: 1 }}>

        {editMode && (
          <div
            {...listeners} {...attributes}
            style={{ cursor: 'grab', color: 'rgba(255,255,255,.25)', fontSize: 14,
              lineHeight: 1, userSelect: 'none', flexShrink: 0, padding: '2px 4px', borderRadius: 4,
              transition: 'color .15s', touchAction: 'none' }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'rgba(255,255,255,.6)' }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(255,255,255,.25)' }}
          >
            ⠿
          </div>
        )}

        <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          {!isChart && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                padding: '1px 6px', borderRadius: 3, background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
              {isVaNi && (
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                  padding: '1px 6px', borderRadius: 3,
                  background: 'var(--accent-glow)', color: 'var(--accent)',
                  border: '1px solid var(--accent-dim)' }}>
                  VaNi ✦
                </span>
              )}
            </div>
          )}
        </div>

        {/* Maximize / restore */}
        <button
          onClick={() => onMaximize(isMaximized ? null : block.id)}
          title={isMaximized ? 'Restore' : 'Maximize'}
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none',
            background: isMaximized ? 'var(--accent-dim)' : 'rgba(255,255,255,.06)',
            color: isMaximized ? '#8b7af8' : 'rgba(255,255,255,.35)',
            cursor: 'pointer', fontSize: 12, flexShrink: 0, lineHeight: 1,
            transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'var(--accent-dim)'; (e.currentTarget).style.color = '#8b7af8' }}
          onMouseLeave={e => {
            (e.currentTarget).style.background = isMaximized ? 'var(--accent-dim)' : 'rgba(255,255,255,.06)'
            ;(e.currentTarget).style.color = isMaximized ? '#8b7af8' : 'rgba(255,255,255,.35)'
          }}>
          {isMaximized ? '⊟' : '⊞'}
        </button>

        {editMode && (
          <button onClick={() => onRemove(block.id)}
            style={{ width: 22, height: 22, borderRadius: 5, border: 'none',
              background: 'var(--bear-bg)', color: 'var(--bear)',
              cursor: 'pointer', fontSize: 11, flexShrink: 0, lineHeight: 1,
              transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bear-bg)'; (e.currentTarget).style.color = '#f87171' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'var(--bear-bg)'; (e.currentTarget).style.color = 'var(--bear)' }}>
            ✕
          </button>
        )}
      </div>

      {/* Live content or placeholder */}
      <BlockContent block={block} />

      {/* Resize handles — edit mode only, hidden when maximized */}
      {editMode && !isMaximized && (
        <>
          {/* Right-center: width only */}
          <div
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onResizeStart(block.id, e.clientX, e.clientY, block.grid_position, 'h') }}
            title="Drag to resize width"
            style={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
              width: 8, height: 32, cursor: 'ew-resize', zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{ width: 2, height: 20, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>

          {/* Bottom-center: height only */}
          <div
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onResizeStart(block.id, e.clientX, e.clientY, block.grid_position, 'v') }}
            title="Drag to resize height"
            style={{
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: 32, height: 8, cursor: 'ns-resize', zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{ height: 2, width: 20, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>

          {/* Bottom-right corner: both */}
          <div
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onResizeStart(block.id, e.clientX, e.clientY, block.grid_position, 'both') }}
            title="Drag to resize"
            style={{
              position: 'absolute', right: 0, bottom: 0,
              width: 16, height: 16, cursor: 'se-resize', zIndex: 10,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.3 }}>
              <line x1="1" y1="8" x2="8" y2="1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="4" y1="8" x2="8" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </>
      )}

      {/* Context menu */}
      {menuOpen && (
        <div ref={menuRef}
          style={{ position: 'fixed', top: menuPos.y, left: menuPos.x, zIndex: 9999,
            background: 'var(--bg)', border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 8, padding: '4px 0', minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,.6)', backdropFilter: 'blur(20px)' }}>
          {[
            { label: 'Edit config',        action: () => setMenuOpen(false) },
            { label: 'Remove from canvas', action: () => { onRemove(block.id); setMenuOpen(false) }, danger: true },
          ].map(({ label, action, danger }) => (
            <button key={label} onClick={action}
              style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none',
                background: 'transparent', textAlign: 'left', cursor: 'pointer',
                fontSize: 12, color: danger ? '#f87171' : 'var(--text-primary)',
                transition: 'background .1s' }}
              onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,.05)' }}
              onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
