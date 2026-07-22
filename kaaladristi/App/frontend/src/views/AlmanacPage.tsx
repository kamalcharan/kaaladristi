// Mercury Almanac — the owner's Excel (Motion / Combust & Rise / Journey)
// productized as a three-lane timeline + event list. POA-astro-layer §Phase B.
// Index-only astro layer (principle #0) — this page IS the astro layer, no
// per-instrument gating needed. Reuses the exact evidence/copy/popover
// infrastructure the chart tooltip and ribbon already use — no new stats
// engine, no new honesty rules; this is a new SURFACE over the same numbers.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui'
import {
  fetchMercuryAlmanac, PAST_DAYS, FUTURE_DAYS,
  type LaneSegment, type AlmanacEvent, type MercuryAlmanac,
} from '@/services/mercuryAlmanac'
import { fetchEvidence, type RuleEvidence } from '@/pages/RuleEngine/ruleService'
import { buildRuleRead } from '@/services/ruleInterpretation'
import { useAstroHorizon } from '@/hooks/useAstroHorizon'
import { ASTRO_GROUP_OVERLAYS } from '@/constants/astroGroupOverlays'
import { fetchVixSeries, vixContextForDate, type VixPoint } from '@/services/almanacVix'
import { usePlanets, useDaysOfWeek, useDayLords, useSectors, useSectorLords } from '@/hooks/useMasterData'
import OverlayExplainPopover from '@/components/domain/VaNi/OverlayExplainPopover'
import InlineGate from '@/components/workspace/InlineGate'

const MERCURY_COLOR =
  ASTRO_GROUP_OVERLAYS.find(g => g.tag === 'Mercury')?.color ?? 'var(--accent)'

// Classical graha glyphs — same set used in Intraday's PlanetsSidebar.
const PLANET_GLYPH: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿',
  Jupiter: '♃', Venus: '♀', Saturn: '♄',
}
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// km_days_of_week.name → JS Date#getDay() index (Sunday = 0).
const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
}

const TOTAL_DAYS = PAST_DAYS + FUTURE_DAYS
const DAY_MS = 86400000

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function startIso(): string {
  return new Date(Date.now() - PAST_DAYS * DAY_MS).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS)
}

/** % position along the timeline for a given ISO date, clamped to [0,100]. */
function xPct(date: string, rangeStart: string): number {
  const d = daysBetween(rangeStart, date)
  return Math.max(0, Math.min(100, (d / TOTAL_DAYS) * 100))
}

function fmtD(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

const LANE_COLORS: Record<string, string> = {
  journey: 'var(--bull)',
  motion: 'var(--accent-violet)',
  combust: 'var(--caution)',
}

// ── Lane row ──────────────────────────────────────────────────────────────

function TimelineLane({
  title, segments, rangeStart, cutoffIso, color, onSegmentClick, onLockedClick, lordFor,
}: {
  title: string
  segments: LaneSegment[]
  rangeStart: string
  cutoffIso: string
  color: string
  onSegmentClick: (seg: LaneSegment, e: React.MouseEvent) => void
  onLockedClick: (e: React.MouseEvent) => void
  lordFor?: (iso: string) => string | null
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 40 }}>
      <div style={{
        width: 88, flexShrink: 0, display: 'flex', alignItems: 'center',
        fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div style={{ position: 'relative', flex: 1, minWidth: 900, height: 34, borderRadius: 6,
        background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)' }}>
        {segments.map(seg => {
          const left = xPct(seg.from, rangeStart)
          const right = xPct(seg.to, rangeStart)
          const width = Math.max(right - left, 0.4)
          const locked = seg.from > cutoffIso
          const lord = lordFor?.(seg.from)
          const startTitle = lord ? `${seg.label} · ${fmtD(seg.from)} → ${fmtD(seg.to)} · starts on ${lord}'s day` : `${seg.label} · ${fmtD(seg.from)} → ${fmtD(seg.to)}`
          return (
            <div
              key={`${seg.ruleCode}-${seg.from}`}
              onClick={e => locked ? onLockedClick(e) : onSegmentClick(seg, e)}
              title={locked ? 'Beyond your plan’s horizon' : startTitle}
              style={{
                position: 'absolute', left: `${left}%`, width: `${width}%`,
                top: 4, bottom: 4, borderRadius: 4, cursor: 'pointer',
                background: locked
                  ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)'
                  : `color-mix(in srgb, ${color} 22%, transparent)`,
                border: `1px solid ${locked ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : `color-mix(in srgb, ${color} 50%, transparent)`}`,
                display: 'flex', alignItems: 'center', overflow: 'hidden',
                filter: locked ? 'blur(2px)' : undefined,
                opacity: locked ? 0.6 : 1,
              }}
            >
              {width > 3 && (
                <span style={{
                  fontSize: 9, whiteSpace: 'nowrap', padding: '0 6px',
                  color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}>
                  {locked ? '🔒' : seg.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AlmanacPage() {
  const { cutoffIso, fullQuarter, days: horizonDays } = useAstroHorizon()
  const [gateOpen, setGateOpen] = useState(false)
  const [explainAt, setExplainAt] = useState<{ x: number; y: number; ruleCode: string; ruleId: number; label: string } | null>(null)

  const { data: almanac, isLoading } = useQuery({
    queryKey: ['mercury-almanac'],
    queryFn: fetchMercuryAlmanac,
    staleTime: 15 * 60_000,
    retry: 1,
  })

  const { data: evidenceRows } = useQuery({
    queryKey: ['rule-engine', 'evidence'],
    queryFn: fetchEvidence,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const evidenceByRule = useMemo(
    () => new Map((evidenceRows ?? []).map(e => [e.rule_id, e])),
    [evidenceRows],
  )

  const rangeStart = startIso()
  const today = todayIso()
  const todayLeft = xPct(today, rangeStart)
  const cutoffLeft = xPct(cutoffIso, rangeStart)

  // ── Day-lord (vara) tag — pure calendar fact, mirrors the owner's Excel
  // LORD column. Not a scored signal (see DN-*-MER-* rules, unpromoted).
  const { data: planets } = usePlanets()
  const { data: daysOfWeek } = useDaysOfWeek()
  const { data: dayLords } = useDayLords()
  const lordByWeekday = useMemo(() => {
    const map: Record<number, string> = {}
    if (!planets || !daysOfWeek || !dayLords) return map
    const planetName = new Map(planets.map(p => [p.id, p.name]))
    const dayName = new Map(daysOfWeek.map(d => [d.id, d.name]))
    for (const dl of dayLords) {
      if (!dl.is_primary) continue
      const name = dayName.get(dl.day_id)
      const idx = name ? WEEKDAY_INDEX[name] : undefined
      const planet = planetName.get(dl.planet_id)
      if (idx !== undefined && planet) map[idx] = planet
    }
    return map
  }, [planets, daysOfWeek, dayLords])
  const lordFor = (iso: string): string | null => {
    const planet = lordByWeekday[new Date(`${iso}T00:00:00`).getDay()]
    return planet ?? null
  }

  // ── Mercury-ruled sectors — static astrological reference, not a
  // performance claim (no return data attached).
  const { data: sectors } = useSectors()
  const { data: sectorLords } = useSectorLords()
  const mercurySectorNames = useMemo(() => {
    if (!sectors || !sectorLords || !planets) return []
    const mercuryId = planets.find(p => p.name === 'Mercury')?.id
    if (mercuryId === undefined) return []
    const sectorName = new Map(sectors.map(s => [s.id, s.name]))
    return sectorLords
      .filter(sl => sl.planet_id === mercuryId)
      .map(sl => sectorName.get(sl.sector_id))
      .filter((n): n is string => !!n)
      .sort()
  }, [sectors, sectorLords, planets])

  // ── India VIX — plain context per event date, not a scored input.
  const { data: vixSeries } = useQuery({
    queryKey: ['almanac-vix', rangeStart, today],
    queryFn: () => fetchVixSeries(rangeStart, today),
    staleTime: 15 * 60_000,
    retry: 1,
  })
  const vixFor = (iso: string) => vixContextForDate((vixSeries ?? []) as VixPoint[], iso)

  const handleSegmentClick = (seg: LaneSegment, e: React.MouseEvent) => {
    e.stopPropagation()
    setExplainAt({ x: e.clientX, y: e.clientY, ruleCode: seg.ruleCode, ruleId: seg.ruleId, label: `☿ ${seg.label}` })
  }
  const handleEventClick = (ev: AlmanacEvent, e: React.MouseEvent) => {
    if (ev.date > cutoffIso) { setGateOpen(true); return }
    setExplainAt({ x: e.clientX, y: e.clientY, ruleCode: ev.ruleCode, ruleId: ev.ruleId, label: `☿ ${ev.label}` })
  }
  const handleLockedClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setGateOpen(true)
  }

  const visibleEvents = (almanac?.events ?? []).filter(ev => ev.date >= rangeStart)

  return (
    <div style={{ padding: '20px 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Astro Layer"
        title="Mercury"
        titleEm="Almanac"
        lead="Motion · Combust & Rise · Journey"
      />

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading…
        </div>
      ) : !almanac ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No Mercury data available.
        </div>
      ) : (
        <>
          {/* Horizon banner */}
          {!fullQuarter && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              padding: '8px 12px', borderRadius: 8, fontSize: 12,
              background: 'color-mix(in srgb, var(--caution) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--caution) 25%, transparent)',
              color: 'var(--text-secondary)',
            }}>
              <span>🔒</span>
              <span>Your plan shows the next {horizonDays} days. History is unlimited on every plan.</span>
              <button
                onClick={() => setGateOpen(true)}
                style={{
                  marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  border: '1px solid color-mix(in srgb, var(--caution) 45%, transparent)',
                  background: 'transparent', color: 'var(--caution)', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Unlock the full quarter
              </button>
            </div>
          )}

          {/* Timeline */}
          <div
            style={{
              overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)',
              background: 'var(--card)', padding: '16px 16px 10px', marginBottom: 24,
            }}
          >
            <div style={{ position: 'relative', minWidth: 900 }}>
              {/* Today cursor + cutoff shading — spans all three lanes */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: `${todayLeft}%`, top: 0, bottom: 0,
                  width: 1, background: 'color-mix(in srgb, var(--text-primary) 30%, transparent)',
                  zIndex: 2, pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', left: `${todayLeft}%`, top: -14,
                  transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono, monospace)', zIndex: 2, pointerEvents: 'none',
                }}>
                  today
                </div>
                {!fullQuarter && (
                  <div style={{
                    position: 'absolute', left: `${cutoffLeft}%`, right: 0, top: 0, bottom: 0,
                    background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
                    borderLeft: '1px dashed color-mix(in srgb, var(--caution) 40%, transparent)',
                    zIndex: 1, pointerEvents: 'none',
                  }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <TimelineLane title="Journey" segments={almanac.journey} rangeStart={rangeStart}
                    cutoffIso={cutoffIso} color={LANE_COLORS.journey} lordFor={lordFor}
                    onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                  <TimelineLane title="Motion" segments={almanac.motion} rangeStart={rangeStart}
                    cutoffIso={cutoffIso} color={LANE_COLORS.motion} lordFor={lordFor}
                    onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                  <TimelineLane title="Combust" segments={almanac.combust} rangeStart={rangeStart}
                    cutoffIso={cutoffIso} color={LANE_COLORS.combust} lordFor={lordFor}
                    onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                </div>
              </div>
            </div>
          </div>

          {/* Event list */}
          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Events · {PAST_DAYS}d back → {horizonDays}d ahead
              </div>
              {mercurySectorNames.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 10.5, color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)' }}>
                  ☿ Mercury-ruled sectors (astrological reference, not a performance claim): {mercurySectorNames.join(' · ')}
                </div>
              )}
            </div>
            {visibleEvents.map((ev, i) => {
              const locked = ev.date > cutoffIso
              const ev2 = evidenceByRule.get(ev.ruleId)
              const read = ev2 ? buildRuleRead(ev2) : null
              const isPast = ev.date < today
              const lord = lordFor(ev.date)
              const weekday = WEEKDAY_ABBR[new Date(`${ev.date}T00:00:00`).getDay()]
              const vix = locked ? null : vixFor(ev.date)
              return (
                <div
                  key={`${ev.date}-${ev.ruleCode}-${ev.label}-${i}`}
                  onClick={e => handleEventClick(ev, e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px',
                    borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)',
                    cursor: 'pointer', opacity: isPast ? 0.55 : 1,
                    background: ev.date === today ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : undefined,
                  }}
                >
                  <span style={{ width: 72, flexShrink: 0, fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)' }}>
                    {fmtD(ev.date)}
                  </span>
                  <span style={{ width: 14, flexShrink: 0, textAlign: 'center', color: ev.watchDay ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {ev.watchDay ? '◈' : '○'}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-primary)', minWidth: 140 }}>
                    ☿ {ev.label}
                  </span>
                  {lord && (
                    <span
                      title={`${weekday}day · ${lord}'s day (vara lord)`}
                      style={{
                        flexShrink: 0, fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                        color: lord === 'Mercury' ? MERCURY_COLOR : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 3, width: 58,
                      }}
                    >
                      {PLANET_GLYPH[lord] ?? ''} {weekday}
                    </span>
                  )}
                  {locked ? (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                      🔒 unlock to see this event's history
                    </span>
                  ) : read ? (
                    <span style={{ fontSize: 10.5, color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)' }}>
                      {read.hover}
                    </span>
                  ) : null}
                  {vix && (
                    <span
                      title="India VIX as of this date — reference only, not scored"
                      style={{
                        marginLeft: 'auto', flexShrink: 0, fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                        color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', whiteSpace: 'nowrap',
                      }}
                    >
                      VIX {vix.close.toFixed(1)} {vix.trendPct >= 0 ? '▲' : '▼'}{Math.abs(vix.trendPct).toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {explainAt && (
        <OverlayExplainPopover
          tag="Mercury"
          focusRuleId={explainAt.ruleId}
          focusRuleLabel={explainAt.label}
          anchorX={explainAt.x}
          anchorY={explainAt.y}
          onClose={() => setExplainAt(null)}
        />
      )}
      <InlineGate context="astro_horizon" isOpen={gateOpen} onDismiss={() => setGateOpen(false)} />
    </div>
  )
}
