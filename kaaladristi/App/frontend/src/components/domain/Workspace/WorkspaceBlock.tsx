import React, { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useQuery } from '@tanstack/react-query'
import type { FrameworkBlock, GridPosition, InstrumentRef } from '@/types/framework'
import { getCatalogItem } from '@/constants/catalogItems'
import RuleInsightCard from '@/components/domain/VaNi/RuleInsightCard'
import MagicRsWidget from '@/components/domain/Catalog/widgets/MagicRsWidget'
import OrderFlowWidget from '@/components/domain/Catalog/widgets/OrderFlowWidget'
import SmartMoneyWidget from '@/components/domain/Catalog/widgets/SmartMoneyWidget'
import RsiWidget from '@/components/domain/Catalog/widgets/RsiWidget'
import WorkspaceTimelineWidget from '@/components/domain/Catalog/widgets/WorkspaceTimelineWidget'
import BreadthRocChart from '@/components/domain/BreadthRocChart'
import SixDayOutlookCompact from '@/components/domain/DashboardV3/SixDayOutlookCompact'
import PlanetRegimeStrip from '@/components/domain/DashboardV3/PlanetRegimeStrip'
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
  panel_block:   { label: 'Panel Block',   color: 'var(--gold)', bg: 'rgba(201,168,76,.1)'  },
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
  planet_regime:   () => <PlanetRegimeStrip />,
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
      fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)', fontFamily: 'var(--font-mono,monospace)' }}>
      scanning…
    </div>
  )

  if (error || !data) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: 'var(--bear)', fontFamily: 'var(--font-mono,monospace)' }}>
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
        <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)', textTransform: 'uppercase',
          letterSpacing: '0.06em' }}>matches</span>
      </div>
      {/* Top 5 rows */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {top5.map(stock => {
          const zone = stock.magic_rs_zone ?? ''
          const zoneInfo = ZONE_LABELS[zone as keyof typeof ZONE_LABELS]
          const pctColor = (stock.pct_chng ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)'
          return (
            <div key={stock.equity_id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px', borderRadius: 6, marginBottom: 2,
              background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
              borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)',
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
            color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)' }}>no matches today</div>
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
          background: isActive ? 'var(--bull-bg)' : 'var(--bear-bg)',
          color: isActive ? 'var(--bull)' : 'var(--bear)',
          border: `1px solid ${isActive ? 'var(--bull-dim)' : 'var(--bear-dim)'}`,
        }}>
          {isActive ? '● Active' : '○ Inactive'}
        </span>
        {probLabel && (
          <span style={{ fontSize: 9, color: 'var(--gold)',
            fontFamily: 'var(--font-mono,monospace)' }}>{probLabel}</span>
        )}
      </div>
      {/* Next occurrence */}
      <div>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'color-mix(in srgb, var(--text-primary) 30%, transparent)', marginBottom: 3 }}>Next occurrence</div>
        {nextSignal
          ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono,monospace)' }}>{nextSignal.date}</span>
              <span style={{ fontSize: 9, color: nextSignal.signal === 'bullish' ? 'var(--bull)'
                : nextSignal.signal === 'bearish' ? 'var(--bear)' : 'var(--gold)' }}>
                {nextSignal.signal}
              </span>
            </div>
          )
          : <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)',
              fontFamily: 'var(--font-mono,monospace)' }}>none found</span>
        }
      </div>
      {/* VaNi interpretation — hidden entirely when no insight */}
      <RuleInsightCard ruleId={ruleId ?? null} />
    </div>
  )
}

// ── VaNi correlation placeholder ──────────────────────────────

// ── VaNi Correlation Block renderer ──────────────────────────

import type { CorrelationResult, CorrelationInstance } from '@/hooks/useCorrelationResult'

// Catalog display names for overlay pills
const OVERLAY_DISPLAY: Record<string, string> = {
  ema_20: 'EMA 20', ema_60: 'EMA 60',
  sma_50: 'SMA 50', sma_150: 'SMA 150', sma_200: 'SMA 200',
  rsi_14: 'RSI 14', supertrend: 'SuperTrend',
  magic_rs: 'MagicRS vs N500', order_flow: 'Order Flow', smart_money: 'Smart Money',
  breadth_roc: 'Breadth ROC',
}

function overlayName(id: string): string {
  if (id.startsWith('astro_rule:')) return id.slice('astro_rule:'.length).replace(/-/g, ' ')
  return OVERLAY_DISPLAY[id] ?? id
}

function buildVaNiNote(result: CorrelationResult, itemA: string, itemB: string): string {
  const direction = result.avg_return_5d >= 0 ? 'positive' : 'negative'
  const strength  = Math.abs(result.avg_return_5d) >= 2 ? 'meaningfully' : 'mildly'
  const a = overlayName(itemA)
  const b = overlayName(itemB)
  const posPct = result.n_instances > 0
    ? Math.round((result.bullish_count / result.n_instances) * 100) : 0

  if (result.shape === 'EVENT_OVERLAP') {
    return `When ${a} and ${b} overlap, markets have historically been ${strength} ${direction} — ${posPct}% positive across ${result.n_instances} instances (avg 5D: ${result.avg_return_5d >= 0 ? '+' : ''}${result.avg_return_5d.toFixed(2)}%).`
  }
  if (result.shape === 'THRESHOLD_CROSS') {
    return `${a} crossing its threshold during ${b} periods has produced ${strength} ${direction} outcomes — ${posPct}% of ${result.n_instances} instances resolved positively.`
  }
  if (result.shape === 'EVENT_IN_STATE') {
    return `${a} events occurring while ${b} is active have historically tilted ${direction} with ${posPct}% positive across ${result.n_instances} observations.`
  }
  return `This combination of ${a} + ${b} has co-occurred ${result.n_instances} times — ${posPct}% resolved ${direction} (avg 5D: ${result.avg_return_5d >= 0 ? '+' : ''}${result.avg_return_5d.toFixed(2)}%).`
}

function ReturnBar({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: 'color-mix(in srgb, var(--text-primary) 25%, transparent)', fontSize: 9 }}>—</span>
  const color = value >= 0 ? 'var(--bull)' : 'var(--bear)'
  const w = Math.min(Math.abs(value) * 10, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, borderRadius: 2, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', [value >= 0 ? 'left' : 'right']: 0, width: `${w}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color, fontFamily: 'var(--font-mono,monospace)', flexShrink: 0 }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </div>
  )
}

function InstanceRow({ inst }: { inst: CorrelationInstance }) {
  const outcome = (inst.return_5d ?? 0) >= 0 ? 'bull' : 'bear'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
      borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)', fontSize: 10 }}>
      <span style={{ color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)', fontFamily: 'var(--font-mono,monospace)',
        flexShrink: 0, width: 74 }}>{inst.start_date.slice(0, 10)}</span>
      <span style={{ color: 'color-mix(in srgb, var(--text-primary) 30%, transparent)', flexShrink: 0, width: 32 }}>{inst.duration_days}d</span>
      <div style={{ flex: 1 }}><ReturnBar value={inst.return_5d} /></div>
      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
        background: outcome === 'bull' ? 'var(--bull-bg)' : 'var(--bear-bg)',
        color: outcome === 'bull' ? 'var(--bull)' : 'var(--bear)' }}>
        {outcome}
      </span>
    </div>
  )
}

function VaNiCorrelationBlock({ block, onDismiss }: { block: FrameworkBlock; onDismiss: () => void }) {
  const result   = block.config.correlation_result as unknown as CorrelationResult | undefined
  const itemA    = block.config.item_a as string
  const itemB    = block.config.item_b as string
  const [showAll, setShowAll] = React.useState(false)

  if (!result) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)', fontFamily: 'var(--font-mono,monospace)' }}>
      no correlation data
    </div>
  )

  const note       = buildVaNiNote(result, itemA, itemB)
  const bullPct    = result.n_instances > 0 ? (result.bullish_count / result.n_instances) * 100 : 50
  const displayInstances = showAll ? result.instances : result.instances.slice(0, 5)
  const hiddenCount = result.instances.length - 5

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      padding: '6px 12px 10px', gap: 10 }}>

      {/* 1. Combination pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {[itemA, itemB].map((id, i) => (
          <React.Fragment key={id}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(139,92,246,.14)', color: '#a78bfa',
              border: '1px solid rgba(139,92,246,.25)', fontFamily: 'var(--font-mono,monospace)' }}>
              {overlayName(id)}
            </span>
            {i === 0 && <span style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 30%, transparent)' }}>∩</span>}
          </React.Fragment>
        ))}
      </div>

      {/* 2. Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {result.currently_active ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10,
            color: 'var(--bull)', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bull)',
              boxShadow: '0 0 6px var(--bull)', display: 'inline-block',
              animation: 'pulse 2s infinite' }} />
            Active Now
          </span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--caution)' }}>Approaching</span>
        )}
        <span style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 25%, transparent)',
          fontFamily: 'var(--font-mono,monospace)' }}>
          {result.n_instances} instances · {result.shape}
        </span>
      </div>

      {/* 3. Stats row */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: '5D avg',  val: `${result.avg_return_5d >= 0 ? '+' : ''}${result.avg_return_5d.toFixed(2)}%` },
          { label: '22D avg', val: `${result.avg_return_22d >= 0 ? '+' : ''}${result.avg_return_22d.toFixed(2)}%` },
          { label: 'Positive', val: `${result.bullish_count}/${result.n_instances}` },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', borderRadius: 6,
            padding: '4px 8px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'color-mix(in srgb, var(--text-primary) 30%, transparent)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono,monospace)' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* 4. Outcome distribution bar */}
      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden',
        background: 'var(--bear-dim)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${bullPct}%`, background: 'var(--bull)', borderRadius: '3px 0 0 3px',
          transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, color: 'var(--bull)' }}>{Math.round(bullPct)}% Bull</span>
        <span style={{ fontSize: 8, color: 'var(--bear)' }}>{Math.round(100 - bullPct)}% Bear</span>
      </div>

      {/* 5. Instance list */}
      <div>
        <div style={{ fontSize: 9, color: 'color-mix(in srgb, var(--text-primary) 30%, transparent)', marginBottom: 4,
          textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent instances</div>
        {displayInstances.map(inst => <InstanceRow key={inst.start_date} inst={inst} />)}
        {!showAll && hiddenCount > 0 && (
          <button onClick={() => setShowAll(true)}
            style={{ fontSize: 9, color: 'var(--accent)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-mono,monospace)' }}>
            Show {hiddenCount} more →
          </button>
        )}
      </div>

      {/* 6. VaNi inference note */}
      <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)', lineHeight: 1.6,
        borderLeft: '2px solid rgba(139,92,246,.35)', paddingLeft: 8,
        fontStyle: 'italic' }}>
        {note}
      </div>

      {/* 7. Action row */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)' }}>
        <button
          title="Coming in Phase 3"
          style={{ flex: 1, padding: '5px 0', fontSize: 9, borderRadius: 5,
            background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
            color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', cursor: 'not-allowed', fontFamily: 'var(--font-mono,monospace)' }}>
          Mark on chart {/* TODO: Phase 3 chart markers */}
        </button>
        <button
          title="Coming in Phase 5"
          style={{ flex: 1, padding: '5px 0', fontSize: 9, borderRadius: 5,
            background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
            color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', cursor: 'not-allowed', fontFamily: 'var(--font-mono,monospace)' }}>
          Save observation {/* TODO: Phase 5 persistence */}
        </button>
        <button onClick={onDismiss}
          style={{ padding: '5px 10px', fontSize: 9, borderRadius: 5,
            background: 'var(--bear-bg)', border: '1px solid var(--bear-dim)',
            color: 'var(--bear)', cursor: 'pointer', fontFamily: 'var(--font-mono,monospace)' }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ── Unimplemented / chart-only placeholder ────────────────────

function ChartOnlyPlaceholder() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 12px' }}>
      <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--text-primary) 15%, transparent)',
        fontFamily: 'var(--font-mono,monospace)', textAlign: 'center' }}>
        renders on chart
      </span>
    </div>
  )
}

// ── BlockContent switch ───────────────────────────────────────

function BlockContent({ block, onRemove }: { block: FrameworkBlock; onRemove: (id: string) => void }) {
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

  if (type === 'vani_correlation') {
    return <VaNiCorrelationBlock block={block} onDismiss={() => onRemove(block.id)} />
  }

  // Fallback: show description or raw id
  const description = getCatalogItem(cid)?.description
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 12px' }}>
      {description
        ? <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)', lineHeight: 1.5,
            textAlign: 'center' }}>{description}</span>
        : <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
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
    : isVaNiCorr
      ? (() => {
          const a = (block.config.item_a as string | undefined) ?? ''
          const b = (block.config.item_b as string | undefined) ?? ''
          const fmt = (id: string) => id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
          return `${fmt(a)} ∩ ${fmt(b)}`
        })()
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
          : '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
        borderRadius: 10,
        background: 'rgba(13,17,23,.9)',
        boxShadow: editMode
          ? '0 4px 20px rgba(0,0,0,.4)'
          : isVaNi
            ? '0 0 0 1px rgba(124,106,247,.15), 0 0 20px rgba(124,106,247,.08)'
            : 'none',
        transition: isDragging ? undefined : 'box-shadow .2s, border-color .2s',
        overflow: 'hidden',
        minWidth: 0,
        width: '100%',
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
            style={{ cursor: 'grab', color: 'color-mix(in srgb, var(--text-primary) 25%, transparent)', fontSize: 14,
              lineHeight: 1, userSelect: 'none', flexShrink: 0, padding: '2px 4px', borderRadius: 4,
              transition: 'color .15s', touchAction: 'none' }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'color-mix(in srgb, var(--text-primary) 60%, transparent)' }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'color-mix(in srgb, var(--text-primary) 25%, transparent)' }}
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
            background: isMaximized ? 'rgba(124,106,247,.2)' : 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
            color: isMaximized ? 'var(--accent)' : 'color-mix(in srgb, var(--text-primary) 35%, transparent)',
            cursor: 'pointer', fontSize: 12, flexShrink: 0, lineHeight: 1,
            transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(124,106,247,.25)'; (e.currentTarget).style.color = 'var(--accent)' }}
          onMouseLeave={e => {
            (e.currentTarget).style.background = isMaximized ? 'rgba(124,106,247,.2)' : 'color-mix(in srgb, var(--text-primary) 6%, transparent)'
            ;(e.currentTarget).style.color = isMaximized ? 'var(--accent)' : 'color-mix(in srgb, var(--text-primary) 35%, transparent)'
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
            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(248,113,113,.22)'; (e.currentTarget).style.color = 'var(--bear)' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(248,113,113,.12)'; (e.currentTarget).style.color = 'rgba(248,113,113,.6)' }}>
            ✕
          </button>
        )}
      </div>

      {/* Live content or placeholder */}
      <BlockContent block={block} onRemove={onRemove} />

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
            <div style={{ width: 2, height: 20, borderRadius: 2, background: 'color-mix(in srgb, var(--text-primary) 25%, transparent)' }} />
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
            <div style={{ height: 2, width: 20, borderRadius: 2, background: 'color-mix(in srgb, var(--text-primary) 25%, transparent)' }} />
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
            background: 'rgba(9,12,16,.97)', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
            borderRadius: 8, padding: '4px 0', minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,.6)', backdropFilter: 'blur(20px)' }}>
          {[
            { label: 'Edit config',        action: () => setMenuOpen(false) },
            { label: 'Remove from canvas', action: () => { onRemove(block.id); setMenuOpen(false) }, danger: true },
          ].map(({ label, action, danger }) => (
            <button key={label} onClick={action}
              style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none',
                background: 'transparent', textAlign: 'left', cursor: 'pointer',
                fontSize: 12, color: danger ? 'var(--bear)' : 'var(--text-primary)',
                transition: 'background .1s' }}
              onMouseEnter={e => { (e.currentTarget).style.background = 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }}
              onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
