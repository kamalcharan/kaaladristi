import React, { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useQuery } from '@tanstack/react-query'
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
import { executeScan } from '@/services/scanEngine'
import { from } from '@/services/postgrest'
import { ZONE_LABELS } from '@/constants/signalScale'

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
  panel_block:   { label: 'Panel Block',   color: '#c9a84c', bg: 'rgba(201,168,76,.1)'  },
  output_panel:  { label: 'Output Panel',  color: '#7c6af7', bg: 'rgba(124,106,247,.1)' },
}

// Widget component map — catalog_item_id → component
// Add new widget entries here; never inline them in BlockContent.
const WIDGET_COMPONENT_MAP: Record<string, () => React.ReactElement> = {
  magic_rs:        () => <MagicRsWidget />,
  order_flow:      () => <OrderFlowWidget />,
  smart_money:     () => <SmartMoneyWidget />,
  rsi_14:          () => <RsiWidget />,
  chart_player:    () => <WorkspaceTimelineWidget />,
  breadth_roc:     () => <BreadthRocChart />,
  six_day_outlook: () => <SixDayOutlookCompact date={TODAY} />,
}

// ── Scanner block content ─────────────────────────────────────

function ScannerBlockContent({ catalogItemId }: { catalogItemId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['scan', catalogItemId, 'combined', 'daily'],
    queryFn:  () => executeScan(catalogItemId, 'combined', 'daily'),
    staleTime: 3 * 60_000,
    retry: 1,
  })

  if (isLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: 'rgba(255,255,255,.2)', fontFamily: 'var(--font-mono,monospace)' }}>
      scanning…
    </div>
  )

  if (error || !data) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: 'rgba(248,113,113,.4)', fontFamily: 'var(--font-mono,monospace)' }}>
      error loading scan
    </div>
  )

  const top5 = data.slice(0, 5)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Count badge */}
      <div style={{ padding: '4px 12px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono,monospace)' }}>{data.length}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase',
          letterSpacing: '0.06em' }}>matches</span>
      </div>
      {/* Top 5 rows */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {top5.map(stock => {
          const zone = stock.magic_rs_zone ?? ''
          const zoneInfo = ZONE_LABELS[zone as keyof typeof ZONE_LABELS]
          const pctColor = (stock.pct_chng ?? 0) >= 0 ? '#10b981' : '#ef4444'
          return (
            <div key={stock.equity_id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px', borderRadius: 6, marginBottom: 2,
              background: 'rgba(255,255,255,.03)',
              borderBottom: '1px solid rgba(255,255,255,.04)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stock.symbol}
              </span>
              {zoneInfo && (
                <span style={{ fontSize: 9, color: zoneInfo.color,
                  fontFamily: 'var(--font-mono,monospace)', flexShrink: 0 }}>
                  {zoneInfo.label}
                </span>
              )}
              <span style={{ fontSize: 10, fontWeight: 600, color: pctColor,
                fontFamily: 'var(--font-mono,monospace)', flexShrink: 0 }}>
                {stock.pct_chng != null ? `${stock.pct_chng >= 0 ? '+' : ''}${stock.pct_chng.toFixed(1)}%` : '—'}
              </span>
            </div>
          )
        })}
        {data.length === 0 && (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11,
            color: 'rgba(255,255,255,.2)' }}>no matches today</div>
        )}
      </div>
    </div>
  )
}

// ── Astro rule panel block content ────────────────────────────

interface RuleRow {
  id: number
  display_name: string
  is_active: boolean
  probability_label: string | null
}

interface SignalRow {
  date: string
  signal: string
}

function AstroRuleBlockContent({ ruleCode }: { ruleCode: string }) {
  const { data: ruleData } = useQuery({
    queryKey: ['astro-rule-meta', ruleCode],
    queryFn: async () => {
      const { data } = await from('km_astro_rule_master')
        .select('id,display_name,is_active,probability_label')
        .eq('rule_code', ruleCode)
        .execute()
      return (data as RuleRow[] | null)?.[0] ?? null
    },
    staleTime: 10 * 60_000,
  })

  const ruleId = ruleData?.id
  const { data: nextSignal } = useQuery({
    queryKey: ['astro-rule-next', ruleId],
    enabled: ruleId != null,
    queryFn: async () => {
      const { data } = await from('km_rule_signals')
        .select('date,signal')
        .eq('rule_id', String(ruleId!))
        .gte('date', TODAY)
        .order('date', { ascending: true })
        .limit(1)
        .execute()
      return (data as SignalRow[] | null)?.[0] ?? null
    },
    staleTime: 5 * 60_000,
  })

  const isActive = ruleData?.is_active ?? false
  const probLabel = ruleData?.probability_label

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '8px 14px', gap: 8 }}>
      {/* Active / Inactive pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '2px 8px', borderRadius: 4,
          background: isActive ? 'rgba(16,185,129,.12)' : 'rgba(248,113,113,.1)',
          color: isActive ? '#10b981' : '#f87171',
          border: `1px solid ${isActive ? 'rgba(16,185,129,.25)' : 'rgba(248,113,113,.2)'}`,
        }}>
          {isActive ? '● Active' : '○ Inactive'}
        </span>
        {probLabel && (
          <span style={{ fontSize: 9, color: '#c9a84c',
            fontFamily: 'var(--font-mono,monospace)' }}>{probLabel}</span>
        )}
      </div>
      {/* Next occurrence */}
      <div>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>Next occurrence</div>
        {nextSignal
          ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono,monospace)' }}>{nextSignal.date}</span>
              <span style={{ fontSize: 9, color: nextSignal.signal === 'bullish' ? '#10b981'
                : nextSignal.signal === 'bearish' ? '#ef4444' : '#c9a84c' }}>
                {nextSignal.signal}
              </span>
            </div>
          )
          : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)',
              fontFamily: 'var(--font-mono,monospace)' }}>none found</span>
        }
      </div>
    </div>
  )
}

// ── VaNi correlation placeholder ──────────────────────────────

function VaNiPlaceholder() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 20 }}>✦</div>
      <span style={{ fontSize: 11, color: 'rgba(124,106,247,.6)', textAlign: 'center',
        fontFamily: 'var(--font-mono,monospace)', letterSpacing: '0.04em' }}>
        VaNi is watching…
      </span>
    </div>
  )
}

// ── Unimplemented / chart-only placeholder ────────────────────

function ChartOnlyPlaceholder() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 12px' }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)',
        fontFamily: 'var(--font-mono,monospace)', textAlign: 'center' }}>
        renders on chart
      </span>
    </div>
  )
}

// ── BlockContent switch ───────────────────────────────────────

function BlockContent({ block }: { block: FrameworkBlock }) {
  const { type, placement, catalog_item_id: cid } = block

  if (type === 'chart') {
    return <WorkspaceChart instrument={block.config.instrument as InstrumentRef} />
  }

  if (type === 'indicator' && placement === 'chart_overlay') return <ChartOnlyPlaceholder />
  if (type === 'astro_rule' && placement === 'chart_overlay') return <ChartOnlyPlaceholder />

  if (type === 'widget' || (type === 'indicator' && placement === 'panel_block')) {
    const WidgetComp = WIDGET_COMPONENT_MAP[cid]
    if (WidgetComp) return <WidgetComp />
  }

  if (type === 'scanner' && placement === 'output_panel') {
    return <ScannerBlockContent catalogItemId={cid} />
  }

  if (type === 'astro_rule' && placement === 'panel_block') {
    const ruleCode = cid.startsWith('astro_rule:') ? cid.slice('astro_rule:'.length) : cid
    return <AstroRuleBlockContent ruleCode={ruleCode} />
  }

  if (type === 'vani_correlation') return <VaNiPlaceholder />

  // Fallback: show description or raw id
  const description = getCatalogItem(cid)?.description
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 12px' }}>
      {description
        ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', lineHeight: 1.5,
            textAlign: 'center' }}>{description}</span>
        : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.12)',
            fontFamily: 'var(--font-mono,monospace)' }}>{cid}</span>
      }
    </div>
  )
}

export default function WorkspaceBlock({ block, editMode, isDraggable, effectivePosition, isMaximized, onRemove, onResizeStart, onMaximize }: Props) {
  const isChart      = block.type === 'chart'
  const isVaNiCorr   = block.type === 'vani_correlation'
  const isVaNi       = (block.added_by === 'vani' || isVaNiCorr) && !isChart
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
          {!isChart && (
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
          )}
        </div>

        {/* Maximize / restore */}
        <button
          onClick={() => onMaximize(isMaximized ? null : block.id)}
          title={isMaximized ? 'Restore' : 'Maximize'}
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none',
            background: isMaximized ? 'rgba(124,106,247,.2)' : 'rgba(255,255,255,.06)',
            color: isMaximized ? '#8b7af8' : 'rgba(255,255,255,.35)',
            cursor: 'pointer', fontSize: 12, flexShrink: 0, lineHeight: 1,
            transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(124,106,247,.25)'; (e.currentTarget).style.color = '#8b7af8' }}
          onMouseLeave={e => {
            (e.currentTarget).style.background = isMaximized ? 'rgba(124,106,247,.2)' : 'rgba(255,255,255,.06)'
            ;(e.currentTarget).style.color = isMaximized ? '#8b7af8' : 'rgba(255,255,255,.35)'
          }}>
          {isMaximized ? '⊟' : '⊞'}
        </button>

        {/* Chart blocks: remove always visible. Other blocks: only in edit mode. */}
        {(editMode || isChart) && (
          <button onClick={() => onRemove(block.id)}
            title="Remove"
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,106,247,0.35)' }}
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,106,247,0.35)' }}
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
