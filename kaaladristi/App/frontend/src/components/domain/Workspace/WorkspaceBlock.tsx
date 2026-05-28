import { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { FrameworkBlock } from '@/types/framework'
import { getCatalogItem } from '@/constants/catalogItems'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useInstrumentResolution } from '@/hooks/useInstrumentResolution'
import MagicRsWidget from '@/components/domain/Catalog/widgets/MagicRsWidget'
import OrderFlowWidget from '@/components/domain/Catalog/widgets/OrderFlowWidget'
import SmartMoneyWidget from '@/components/domain/Catalog/widgets/SmartMoneyWidget'
import BreadthRocChart from '@/components/domain/BreadthRocChart'
import SixDayOutlookCompact from '@/components/domain/DashboardV3/SixDayOutlookCompact'

const TODAY = new Date().toISOString().slice(0, 10)

interface Props {
  block:    FrameworkBlock
  editMode: boolean
  onRemove: (id: string) => void
}

const TYPE_ICON: Record<string, string> = {
  indicator:        '〰️',
  widget:           '⚡',
  scanner:          '🔍',
  astro_rule:       '🪐',
  vani_correlation: '✦',
}

const PLACEMENT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  chart_overlay: { label: 'Chart Overlay', color: '#2dd4bf', bg: 'rgba(45,212,191,.1)'  },
  panel_block:   { label: 'Panel Block',   color: '#c9a84c', bg: 'rgba(201,168,76,.1)'  },
  output_panel:  { label: 'Output Panel',  color: '#7c6af7', bg: 'rgba(124,106,247,.1)' },
}

// Catalog item IDs that render live components in the workspace
const LIVE_IDS = new Set([
  'magic_rs', 'order_flow', 'smart_money', 'breadth_roc', 'six_day_outlook',
])

function BlockContent({
  catalogItemId,
  symbolId,
  symbolType,
  description,
}: {
  catalogItemId: string
  symbolId: number | null
  symbolType: 'index' | 'equity' | null
  description: string | undefined
}) {
  if (LIVE_IDS.has(catalogItemId) && symbolId !== null && symbolType !== null) {
    if (catalogItemId === 'magic_rs') {
      return <MagicRsWidget symbolId={symbolId} symbolType={symbolType} />
    }
    if (catalogItemId === 'order_flow') {
      return <OrderFlowWidget symbolId={symbolId} symbolType={symbolType} narrative="" />
    }
    if (catalogItemId === 'smart_money') {
      return <SmartMoneyWidget symbolId={symbolId} symbolType={symbolType} narrative="" />
    }
    if (catalogItemId === 'breadth_roc') {
      return <BreadthRocChart />
    }
    if (catalogItemId === 'six_day_outlook') {
      return <SixDayOutlookCompact date={TODAY} />
    }
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

export default function WorkspaceBlock({ block, editMode, onRemove }: Props) {
  const isVaNi  = block.added_by === 'vani'
  const catalog = getCatalogItem(block.catalog_item_id)
  const name    = catalog?.display_name ?? block.catalog_item_id
  const badge   = PLACEMENT_BADGE[block.placement] ?? PLACEMENT_BADGE.panel_block
  const icon    = TYPE_ICON[block.type] ?? '◎'

  // Resolve instruments[0] to a numeric id + type
  const symbol = useFrameworkStore(s => s.framework?.instruments?.[0] ?? null)
  const { data: instrument } = useInstrumentResolution(symbol)
  const symbolId   = instrument?.id   ?? null
  const symbolType = instrument?.type ?? null

  // Drag — disabled when not in edit mode
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:       block.id,
    disabled: !editMode,
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
        gridColumnStart: block.grid_position.col_start,
        gridColumnEnd:   block.grid_position.col_end,
        gridRowStart:    block.grid_position.row_start,
        gridRowEnd:      block.grid_position.row_end,
        transform:       CSS.Translate.toString(transform),
        opacity:         isDragging ? 0.5 : 1,
        zIndex:          isDragging ? 100 : undefined,
        position:        'relative',
        border:          isVaNi
          ? '1px solid rgba(124,106,247,.45)'
          : '1px solid rgba(255,255,255,.08)',
        borderRadius: 10,
        background: 'rgba(13,17,23,.9)',
        boxShadow: editMode
          ? '0 4px 20px rgba(0,0,0,.4)'
          : isVaNi
            ? '0 0 0 1px rgba(124,106,247,.15), 0 0 20px rgba(124,106,247,.08)'
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
          background: 'radial-gradient(ellipse at top left, rgba(124,106,247,.06) 0%, transparent 60%)' }} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
              padding: '1px 6px', borderRadius: 3, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
            {isVaNi && (
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                padding: '1px 6px', borderRadius: 3,
                background: 'rgba(124,106,247,.12)', color: '#7c6af7',
                border: '1px solid rgba(124,106,247,.2)' }}>
                VaNi ✦
              </span>
            )}
          </div>
        </div>

        {editMode && (
          <button onClick={() => onRemove(block.id)}
            style={{ width: 22, height: 22, borderRadius: 5, border: 'none',
              background: 'rgba(248,113,113,.12)', color: 'rgba(248,113,113,.6)',
              cursor: 'pointer', fontSize: 11, flexShrink: 0, lineHeight: 1,
              transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(248,113,113,.22)'; (e.currentTarget).style.color = '#f87171' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(248,113,113,.12)'; (e.currentTarget).style.color = 'rgba(248,113,113,.6)' }}>
            ✕
          </button>
        )}
      </div>

      {/* Live content or placeholder */}
      <BlockContent
        catalogItemId={block.catalog_item_id}
        symbolId={symbolId}
        symbolType={symbolType}
        description={catalog?.description}
      />

      {/* Context menu */}
      {menuOpen && (
        <div ref={menuRef}
          style={{ position: 'fixed', top: menuPos.y, left: menuPos.x, zIndex: 9999,
            background: 'rgba(9,12,16,.97)', border: '1px solid rgba(255,255,255,.1)',
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
