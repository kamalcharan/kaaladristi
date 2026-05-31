import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'
import type { CorrelationInstance } from '@/hooks/useCorrelationResult'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

function pairLabel(c: VaNiCorrelation): string {
  return `${fmtId(c.item_a)} ∩ ${fmtId(c.item_b)}`
}

function fmtRet(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function retColor(v: number | null): string {
  if (v === null) return 'rgba(255,255,255,.25)'
  return v >= 0 ? '#10b981' : '#ef4444'
}

function vaNiNote(c: VaNiCorrelation): string {
  const total    = c.n_instances
  const resolved = c.instances.filter(i => i.return_5d !== null)
  const nRes     = resolved.length
  const bearish  = resolved.filter(i => i.return_5d! < 0).length
  const bullish  = resolved.filter(i => i.return_5d! >= 0).length

  // Direction: whichever side wins
  const bearishWins = bearish > bullish
  const winCount    = bearishWins ? bearish : bullish
  const direction   = bearishWins ? 'lower' : 'higher'
  const edgeWord    = bearishWins ? 'bearish' : 'bullish'

  // Certainty qualifier — < 65% moderate, 65–75% clear, > 75% strong
  const hitRate   = nRes > 0 ? winCount / nRes : 0
  const certainty = hitRate > 0.75 ? 'strong' : hitRate >= 0.65 ? 'clear' : 'moderate, not conclusive'

  // Year of first instance
  const firstYear = c.instances.length > 0
    ? c.instances.slice().sort((a, b) => a.start_date.localeCompare(b.start_date))[0].start_date.slice(0, 4)
    : ''

  const pair      = pairLabel(c)
  const sinceStr  = firstYear ? ` since ${firstYear}` : ''

  // Status: active with day count OR approaching (unresolved latest) OR nothing
  const latestInst = c.instances.length > 0
    ? c.instances.slice().sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    : null
  const statusStr = c.currently_active
    ? (latestInst?.return_5d === null && latestInst?.duration_days > 0
        ? `Currently active — Day ${latestInst.duration_days}.`
        : 'One instance is currently active.')
    : (nRes < total ? 'One instance is currently approaching.' : '')

  return `${pair} has co-occurred ${total} times${sinceStr}. In ${winCount} of ${nRes} resolved instances the market moved ${direction} — avg 5D: ${fmtRet(c.avg_return_5d)}, avg 22D: ${fmtRet(c.avg_return_22d)}. The ${edgeWord} edge is ${certainty}.${statusStr ? ' ' + statusStr : ''}`
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontFamily: 'var(--font-mono,monospace)' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color ?? 'var(--text-primary)',
        fontFamily: 'var(--font-mono,monospace)' }}>
        {value}
      </span>
    </div>
  )
}

function OutcomeBar({ bullish, bearish, total }: { bullish: number; bearish: number; total: number }) {
  const bullPct = total > 0 ? (bullish / total) * 100 : 50
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10,
        color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font-mono,monospace)' }}>
        <span style={{ color: '#10b981' }}>▲ {bullish} bullish</span>
        <span style={{ color: '#ef4444' }}>{bearish} bearish ▼</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(239,68,68,.25)',
        display: 'flex' }}>
        <div style={{ width: `${bullPct}%`, background: '#10b981', borderRadius: '3px 0 0 3px',
          transition: 'width .4s' }} />
      </div>
    </div>
  )
}

// ── InstanceList — shared across shapes ───────────────────────────────────────

function InstanceRow({ inst }: { inst: CorrelationInstance }) {
  const ret5  = inst.return_5d
  const isPos = ret5 !== null && ret5 >= 0
  const isNeg = ret5 !== null && ret5 < 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
      borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11 }}>
      <span style={{ color: 'rgba(255,255,255,.45)', fontFamily: 'var(--font-mono,monospace)',
        minWidth: 72 }}>
        {inst.start_date}
      </span>
      <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 10, minWidth: 40 }}>
        {inst.duration_days}d
      </span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)',
        overflow: 'hidden' }}>
        {ret5 !== null && (
          <div style={{
            width: `${Math.min(Math.abs(ret5) * 15, 100)}%`,
            height: '100%',
            background: isPos ? '#10b981' : '#ef4444',
            borderRadius: 2,
          }} />
        )}
      </div>
      <span style={{ minWidth: 52, textAlign: 'right', fontFamily: 'var(--font-mono,monospace)',
        color: isPos ? '#10b981' : isNeg ? '#ef4444' : 'rgba(255,255,255,.25)', fontSize: 11 }}>
        {fmtRet(ret5)}
      </span>
    </div>
  )
}

function InstanceList({ instances, label = 'HISTORICAL INSTANCES' }: {
  instances: CorrelationInstance[]
  label?: string
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 6,
        fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.05em' }}>
        {label}
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {instances.map((inst, i) => <InstanceRow key={i} inst={inst} />)}
      </div>
    </div>
  )
}

// ── ZONE_CONFLUENCE ───────────────────────────────────────────────────────────

function ZoneConfluenceViz({ corr }: { corr: VaNiCorrelation }) {
  const sorted  = [...corr.instances].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const maxDur  = Math.max(...sorted.map(i => i.duration_days), 1)

  // Current-state callout — find any instance with no end_date or latest
  const activeInst = corr.currently_active
    ? sorted[sorted.length - 1]
    : null

  // Return distribution histogram
  const buckets = [
    { label: '<-2%',  min: -Infinity, max: -2 },
    { label: '-2–-1', min: -2,        max: -1 },
    { label: '-1–0',  min: -1,        max: 0  },
    { label: '0–+1',  min: 0,         max: 1  },
    { label: '+1–+2', min: 1,         max: 2  },
    { label: '>+2%',  min: 2,         max: Infinity },
  ]
  const histData = buckets.map(b => ({
    label: b.label,
    count: sorted.filter(i => i.return_5d !== null && i.return_5d >= b.min && i.return_5d < b.max).length,
    positive: b.min >= 0,
  }))

  // Gantt data for recharts horizontal bar
  const ganttData = sorted.map((inst, idx) => ({
    name: inst.start_date.slice(0, 7),   // YYYY-MM label
    value: inst.duration_days,
    ret: inst.return_5d,
    idx,
    isCurrent: corr.currently_active && idx === sorted.length - 1,
    tooltip: `${inst.start_date} · ${inst.duration_days}d · 5D: ${fmtRet(inst.return_5d)} · 22D: ${fmtRet(inst.return_22d)}`,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Active callout */}
      {activeInst && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(245,158,11,.06)',
          borderLeft: '3px solid #f59e0b',
          animation: 'pulse 2s infinite',
        }}>
          <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, marginBottom: 4 }}>
            Currently in confluence · Day {activeInst.duration_days}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font-mono,monospace)' }}>
            {fmtId(corr.item_a)} active · {fmtId(corr.item_b)} active
          </div>
        </div>
      )}

      {/* Gantt */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 8,
          fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.05em' }}>
          CONFLUENCE PERIODS (width = duration)
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {ganttData.map((d, i) => {
            const barColor = d.isCurrent ? '#a78bfa'
              : d.ret === null ? 'rgba(255,255,255,.15)'
              : d.ret >= 0 ? '#10b981' : '#ef4444'
            const widthPct = (d.value / maxDur) * 100
            return (
              <div key={i} title={d.tooltip} style={{ display: 'flex', alignItems: 'center',
                gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', minWidth: 50,
                  fontFamily: 'var(--font-mono,monospace)' }}>
                  {d.name}
                </span>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,.04)',
                  borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${widthPct}%`, height: '100%', borderRadius: 3,
                    background: barColor,
                    boxShadow: d.isCurrent ? '0 0 8px #a78bfa' : undefined,
                    animation: d.isCurrent ? 'pulse 2s infinite' : undefined,
                  }} />
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,.25)',
                  fontFamily: 'var(--font-mono,monospace)', minWidth: 24, textAlign: 'right' }}>
                  {d.value}d
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Return histogram */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 6,
          fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.05em' }}>
          5D RETURN DISTRIBUTION
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={histData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,.3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,.3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,.04)' }}
              contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 6, fontSize: 11 }}
              formatter={(v: unknown) => [v as number, 'instances']}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {histData.map((d, i) => (
                <Cell key={i} fill={d.positive ? '#10b981' : '#ef4444'} opacity={d.count === 0 ? 0.2 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── EVENT_OVERLAP ─────────────────────────────────────────────────────────────

function EventOverlapViz({ corr }: { corr: VaNiCorrelation }) {
  const sorted = [...corr.instances].sort((a, b) => a.start_date.localeCompare(b.start_date))

  // Compute a simple timeline using SVG — each instance as a horizontal strip
  // Track A (item_a): teal, Track B (item_b): orange, Overlap: purple
  const W = 340
  const TRACK_H = 14
  const GAP = 6
  const ROW_H = TRACK_H * 2 + GAP + 10
  const allDates = sorted.flatMap(i => [i.start_date, i.end_date]).sort()
  const minDate  = allDates[0] ?? '2020-01-01'
  const maxDate  = allDates[allDates.length - 1] ?? '2026-12-31'
  const totalMs  = Math.max(new Date(maxDate).getTime() - new Date(minDate).getTime(), 1)

  function xPct(dateStr: string): number {
    const ms = new Date(dateStr).getTime() - new Date(minDate).getTime()
    return (ms / totalMs) * W
  }

  const svgH = sorted.length * ROW_H + 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'rgba(255,255,255,.4)',
        fontFamily: 'var(--font-mono,monospace)' }}>
        <span><span style={{ color: '#2dd4bf' }}>■</span> {fmtId(corr.item_a)}</span>
        <span><span style={{ color: '#fb923c' }}>■</span> {fmtId(corr.item_b)}</span>
        <span><span style={{ color: '#a78bfa' }}>■</span> OVERLAP</span>
      </div>

      {/* SVG timeline */}
      <div style={{ overflowY: 'auto', maxHeight: 200 }}>
        <svg width={W} height={svgH} style={{ display: 'block' }}>
          {sorted.map((inst, i) => {
            const x1   = xPct(inst.start_date)
            const x2   = xPct(inst.end_date)
            const barW  = Math.max(x2 - x1, 3)
            const yBase = i * ROW_H + 10
            const isCur = corr.currently_active && i === sorted.length - 1
            const dotColor = inst.return_5d === null ? '#f59e0b'
              : inst.return_5d >= 0 ? '#10b981' : '#ef4444'

            return (
              <g key={i}>
                {/* Track A */}
                <rect x={x1} y={yBase} width={barW} height={TRACK_H} rx={3}
                  fill="#2dd4bf" opacity={0.6} />
                {/* Track B offset half-height */}
                <rect x={x1} y={yBase + TRACK_H + GAP} width={barW} height={TRACK_H} rx={3}
                  fill="#fb923c" opacity={0.6} />
                {/* Overlap stripe — middle */}
                <rect x={x1} y={yBase + TRACK_H / 2} width={barW} height={TRACK_H + GAP} rx={2}
                  fill={isCur ? '#a78bfa' : '#7c3aed'} opacity={isCur ? 0.7 : 0.4} />
                {/* Outcome dot */}
                <circle cx={x2} cy={yBase + TRACK_H} r={4} fill={dotColor}
                  opacity={isCur ? 0 : 1} />
                {/* Year label */}
                <text x={x1} y={yBase - 2} fontSize={8} fill="rgba(255,255,255,.3)"
                  fontFamily="monospace">
                  {inst.start_date.slice(0, 4)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <InstanceList instances={sorted} />
    </div>
  )
}

// ── EVENT_IN_STATE ────────────────────────────────────────────────────────────

function EventInStateViz({ corr }: { corr: VaNiCorrelation }) {
  const instances = corr.instances

  // Group by a proxy "state" — we don't have a state field in CorrelationInstance
  // so bucket by return quartile as proxy until backend adds state field
  type State = 'Strong' | 'Moderate' | 'Weak' | 'Unresolved'
  function toState(inst: CorrelationInstance): State {
    if (inst.return_5d === null) return 'Unresolved'
    const v = inst.return_5d
    if (Math.abs(v) > 2) return 'Strong'
    if (Math.abs(v) > 0.5) return 'Moderate'
    return 'Weak'
  }

  const states: State[] = ['Strong', 'Moderate', 'Weak', 'Unresolved']

  const grouped = states.map(s => {
    const rows = instances.filter(i => toState(i) === s)
    const resolved = rows.filter(i => i.return_5d !== null)
    const avg5 = resolved.length > 0
      ? resolved.reduce((a, i) => a + i.return_5d!, 0) / resolved.length
      : null
    const avg22 = resolved.length > 0
      ? resolved.reduce((a, i) => a + i.return_22d!, 0) / resolved.length
      : null
    return { state: s, count: rows.length, avg5, avg22 }
  }).filter(g => g.count > 0)

  const bestIdx = grouped
    .filter(g => g.avg5 !== null)
    .reduce((best, g, _, arr) =>
      g.avg5! > (arr[best]?.avg5 ?? -Infinity) ? grouped.indexOf(g) : best
    , 0)

  const activeStateIdx = corr.currently_active
    ? grouped.findIndex(g => g.state === toState(instances[instances.length - 1]))
    : -1

  const COLS = 8
  const sorted = [...instances].sort((a, b) => a.start_date.localeCompare(b.start_date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Conditional return table */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 6,
          fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.05em' }}>
          RETURN BY STATE
        </div>
        <div style={{ borderRadius: 8, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.06)' }}>
          {/* header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 50px',
            padding: '6px 12px', background: 'rgba(255,255,255,.03)',
            fontSize: 9, color: 'rgba(255,255,255,.3)', fontFamily: 'var(--font-mono,monospace)',
            letterSpacing: '.05em' }}>
            <span>STATE</span><span style={{ textAlign: 'right' }}>5D AVG</span>
            <span style={{ textAlign: 'right' }}>22D AVG</span>
            <span style={{ textAlign: 'right' }}>N</span>
          </div>
          {grouped.map((g, i) => {
            const isActive = i === activeStateIdx
            const isBest   = i === bestIdx
            return (
              <div key={g.state} style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 60px 50px',
                padding: '8px 12px', fontSize: 11,
                borderTop: '1px solid rgba(255,255,255,.04)',
                background: isActive ? 'rgba(245,158,11,.06)' : isBest ? 'rgba(16,185,129,.04)' : 'transparent',
                borderLeft: isActive ? '3px solid #f59e0b' : isBest ? '3px solid rgba(16,185,129,.3)' : '3px solid transparent',
              }}>
                <span style={{ color: isActive ? '#fbbf24' : 'rgba(255,255,255,.6)',
                  fontFamily: 'var(--font-mono,monospace)', fontSize: 10 }}>
                  {g.state}
                </span>
                <span style={{ textAlign: 'right', color: retColor(g.avg5),
                  fontFamily: 'var(--font-mono,monospace)' }}>
                  {fmtRet(g.avg5)}
                </span>
                <span style={{ textAlign: 'right', color: retColor(g.avg22),
                  fontFamily: 'var(--font-mono,monospace)' }}>
                  {fmtRet(g.avg22)}
                </span>
                <span style={{ textAlign: 'right', color: 'rgba(255,255,255,.35)',
                  fontFamily: 'var(--font-mono,monospace)' }}>
                  {g.count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Event grid */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 6,
          fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.05em' }}>
          EVENT INSTANCES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
          {sorted.map((inst, i) => {
            const state    = toState(inst)
            const isCur    = corr.currently_active && i === sorted.length - 1
            const cellColor = isCur ? 'rgba(167,139,250,.15)'
              : inst.return_5d === null ? 'rgba(255,255,255,.06)'
              : inst.return_5d >= 0 ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'
            const borderColor = isCur ? '#a78bfa' : 'transparent'
            const tooltip = `${inst.start_date} · ${state} · 5D: ${fmtRet(inst.return_5d)}`
            return (
              <div key={i} title={tooltip} style={{
                height: 20, borderRadius: 3, background: cellColor,
                border: `1px solid ${borderColor}`,
                boxShadow: isCur ? '0 0 8px #a78bfa' : undefined,
                animation: isCur ? 'pulse 2s infinite' : undefined,
                cursor: 'default',
              }} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Shape router ──────────────────────────────────────────────────────────────

function renderShapeVisualization(corr: VaNiCorrelation): React.ReactNode {
  switch (corr.shape) {
    case 'ZONE_CONFLUENCE':  return <ZoneConfluenceViz corr={corr} />
    case 'EVENT_OVERLAP':    return <EventOverlapViz corr={corr} />
    case 'EVENT_IN_STATE':   return <EventInStateViz corr={corr} />
    case 'THRESHOLD_CROSS':  return <InstanceList instances={corr.instances} />   // Phase 5
    default:                 return <InstanceList instances={corr.instances} />
  }
}

// ── PairDetail ────────────────────────────────────────────────────────────────

function PairDetail({ corr, onDismiss }: { corr: VaNiCorrelation; onDismiss: () => void }) {
  const total = corr.bullish_count + corr.bearish_count
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 20px 24px' }}>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {corr.currently_active ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 8px #10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Active Now</span>
          </>
        ) : (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b',
              display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#f59e0b' }}>Approaching</span>
          </>
        )}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontFamily: 'var(--font-mono,monospace)',
          marginLeft: 4 }}>
          {corr.shape}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        padding: 14, background: 'rgba(255,255,255,.03)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,.06)' }}>
        <StatBox label="Instances" value={String(corr.n_instances)} />
        <StatBox label="Bull / Bear" value={`${corr.bullish_count} / ${corr.bearish_count}`} />
        <StatBox label="5D avg"
          value={fmtRet(corr.avg_return_5d)}
          color={retColor(corr.avg_return_5d)} />
        <StatBox label="22D avg"
          value={fmtRet(corr.avg_return_22d)}
          color={retColor(corr.avg_return_22d)} />
      </div>

      {/* Outcome bar */}
      <OutcomeBar bullish={corr.bullish_count} bearish={corr.bearish_count} total={total} />

      {/* Shape-specific visualization */}
      {renderShapeVisualization(corr)}

      {/* VaNi inference note */}
      <div style={{ padding: 12, background: 'rgba(139,92,246,.06)', borderRadius: 8,
        border: '1px solid rgba(139,92,246,.2)', fontSize: 12,
        color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
        <span style={{ color: '#a78bfa', marginRight: 6, fontSize: 10 }}>✦ VaNi</span>
        {vaNiNote(corr)}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
          color: 'rgba(255,255,255,.4)', cursor: 'not-allowed' }}>
          Mark on chart
        </button>
        <button style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
          color: 'rgba(255,255,255,.4)', cursor: 'not-allowed' }}>
          Save observation
        </button>
        <button
          onClick={onDismiss}
          style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
            color: '#f87171', cursor: 'pointer' }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

interface Props {
  isOpen:        boolean
  activePairKey: string | null   // "item_a:item_b"
  onClose:       () => void
  onSelectPair:  (key: string) => void
}

export default function CorrelationDrawer({ isOpen, activePairKey, onClose, onSelectPair }: Props) {
  const correlations       = useFrameworkStore(s => s.vaniCorrelations)
  const dismissCorrelation = useFrameworkStore(s => s.dismissVaNiCorrelation)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const activeCorr = correlations.find(
    c => `${c.item_a}:${c.item_b}` === activePairKey
  ) ?? correlations[0] ?? null

  if (!isOpen || correlations.length === 0) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(0,0,0,.25)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        zIndex: 200, display: 'flex', flexDirection: 'column',
        background: 'rgba(13,17,23,.97)', backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(139,92,246,.2)',
        boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Drawer header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#a78bfa' }}>✦</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              VaNi Confluence
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)',
            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Pair tabs */}
        {correlations.length > 1 && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)',
            overflowX: 'auto', flexShrink: 0 }}>
            {correlations.map(c => {
              const key      = `${c.item_a}:${c.item_b}`
              const isActive = key === (activePairKey ?? `${correlations[0].item_a}:${correlations[0].item_b}`)
              return (
                <button
                  key={key}
                  onClick={() => onSelectPair(key)}
                  style={{
                    padding: '10px 14px', fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer',
                    background: 'none', border: 'none',
                    borderBottom: isActive ? '2px solid #a78bfa' : '2px solid transparent',
                    color: isActive ? '#c4b5fd' : 'rgba(255,255,255,.35)',
                    fontFamily: 'var(--font-mono,monospace)',
                  }}>
                  {fmtId(c.item_a)} ∩ {fmtId(c.item_b)} · {c.n_instances}×
                </button>
              )
            })}
          </div>
        )}

        {/* Active pair label (single pair) */}
        {correlations.length === 1 && activeCorr && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.06)',
            flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: '#c4b5fd', fontFamily: 'var(--font-mono,monospace)' }}>
              {pairLabel(activeCorr)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>
              {activeCorr.n_instances} instances detected
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16 }}>
          {activeCorr && (
            <PairDetail
              corr={activeCorr}
              onDismiss={() => {
                dismissCorrelation(activeCorr.item_a, activeCorr.item_b)
                if (correlations.length <= 1) onClose()
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
