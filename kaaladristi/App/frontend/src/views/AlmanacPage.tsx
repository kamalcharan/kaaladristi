// Almanac — two very different bodies sharing one shell (type selector,
// evidence lookup, VaNi popover, tier gate). POA-astro-layer §Phase B/D.
// Index-only astro layer (principle #0) — this page IS the astro layer, no
// per-instrument gating needed.
//
// Mercury: three-lane timeline mirroring the owner's Excel (Motion/Combust/
// Journey are complementary faces of ONE continuous story — Mercury is
// always in some sign, always direct-or-retrograde, always combust-or-not).
//
// Bayer Rules: a rule-STATUS grid, not a timeline. Bayer's 9 rules are
// independent trading claims about different planets, mostly sparse/rare
// events with no shared narrative connecting them (owner correction,
// 2026-07-23 — the original lane-per-rule build forced Mercury's continuous-
// story metaphor onto content that isn't one). Each card: active today?,
// next occurrence, the evidence read, Bayer's own 1940 claim (unverified).

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, DristiQLoader } from '@/components/ui'
import {
  fetchMercuryAlmanac, PAST_DAYS, FUTURE_DAYS, RULE_JOURNEY,
  type LaneSegment, type AlmanacEvent,
} from '@/services/mercuryAlmanac'
import { fetchBayerStatus, fetchBayerRuleWindows, BAYER_RULES } from '@/services/bayerAlmanac'
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
const VENUS_COLOR =
  ASTRO_GROUP_OVERLAYS.find(g => g.tag === 'Venus')?.color ?? 'var(--accent)'
const MARS_COLOR =
  ASTRO_GROUP_OVERLAYS.find(g => g.tag === 'Gandanta')?.color ?? 'var(--caution)'
const BAYER_COLOR =
  ASTRO_GROUP_OVERLAYS.find(g => g.tag === 'Bayer')?.color ?? 'var(--caution)'

type AlmanacType = 'mercury' | 'bayer'
/** Type-selector dropdown — Mercury and Bayer have live evidence; the rest
 * are shown disabled (principle #4: one planet/rule-set at a time, provably
 * correct before the next). */
const ALMANAC_TYPES: { id: AlmanacType | string; label: string; enabled: boolean }[] = [
  { id: 'mercury', label: 'Mercury', enabled: true },
  { id: 'bayer', label: 'Bayer Rules', enabled: true },
  { id: 'venus', label: 'Venus', enabled: false },
  { id: 'panchak', label: 'Panchak', enabled: false },
  { id: 'major-transit', label: 'Major Transits', enabled: false },
]

/** Bayer rules span several planets — color/glyph by the rule's own tag. */
function bayerRuleColor(ruleCode: string): string {
  if (ruleCode === 'BAY-R03-VEN-RET') return VENUS_COLOR
  if (ruleCode === 'BAY-R06-MAR-1635') return MARS_COLOR
  if (['TRN-MER-MAN-TRN', 'TRN-MER-RIS-W-BUL', 'TR-MER-CMB-E-BEA', 'BAY-R27-MER-SPD'].includes(ruleCode)) return MERCURY_COLOR
  return BAYER_COLOR
}
function bayerGlyph(ruleCode: string): string {
  if (ruleCode === 'BAY-R03-VEN-RET') return '♀'
  if (ruleCode === 'BAY-R06-MAR-1635' || ruleCode === 'BAY-R02-MAR-MER-SPD') return '♂'
  if (['TRN-MER-MAN-TRN', 'TRN-MER-RIS-W-BUL', 'TR-MER-CMB-E-BEA', 'BAY-R27-MER-SPD'].includes(ruleCode)) return '☿'
  return '⬡'
}

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

// Panchang-style rashi names — km_rule_transits.sign stores the English name
// (Aries, Taurus, ...); display the Sanskrit name with English in the
// tooltip. Same spellings already used in DashboardV3/PlanetRegimeStrip.tsx.
const ZODIAC_SANSKRIT: Record<string, string> = {
  Aries: 'Mesha', Taurus: 'Vrishabha', Gemini: 'Mithuna', Cancer: 'Karka',
  Leo: 'Simha', Virgo: 'Kanya', Libra: 'Tula', Scorpio: 'Vrishchika',
  Sagittarius: 'Dhanu', Capricorn: 'Makara', Aquarius: 'Kumbha', Pisces: 'Meena',
}
function sanskritSign(sign: string): string {
  return ZODIAC_SANSKRIT[sign] ?? sign
}

const DAY_MS = 86400000

type ViewMode = 'live' | 'month' | 'year'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function startIso(): string {
  return new Date(Date.now() - PAST_DAYS * DAY_MS).toISOString().slice(0, 10)
}

function endIso(): string {
  return new Date(Date.now() + FUTURE_DAYS * DAY_MS).toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** month is 0-indexed (JS Date convention). */
function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month + 1)}-01`
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const end = `${year}-${pad2(month + 1)}-${pad2(lastDay)}`
  return { start, end }
}

function yearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS)
}

/** % position along the timeline for a given ISO date, clamped to [0,100]. */
function xPct(date: string, rangeStart: string, totalDays: number): number {
  const d = daysBetween(rangeStart, date)
  return Math.max(0, Math.min(100, (d / totalDays) * 100))
}

function fmtD(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

const LANE_COLORS: Record<string, string> = {
  journey: 'var(--bull)',
  motion: 'var(--accent-violet)',
  combust: 'var(--caution)',
}

// ── Live / Month / Year range — shared by Mercury's body and the Bayer
// per-rule timeline drill-down (each rule's own history is a coherent
// single-lane story, unlike merging all 9 rules into one shared timeline).

function useAlmanacRange(horizonDays: number) {
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [cursorYear, setCursorYear] = useState(() => new Date().getFullYear())
  const [cursorMonth, setCursorMonth] = useState(() => new Date().getMonth())

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const r = monthRange(cursorYear, cursorMonth)
      return { rangeStart: r.start, rangeEnd: r.end }
    }
    if (viewMode === 'year') {
      const r = yearRange(cursorYear)
      return { rangeStart: r.start, rangeEnd: r.end }
    }
    return { rangeStart: startIso(), rangeEnd: endIso() }
  }, [viewMode, cursorYear, cursorMonth])
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd))

  const handlePrev = () => {
    if (viewMode === 'month') {
      if (cursorMonth === 0) { setCursorMonth(11); setCursorYear(y => y - 1) }
      else setCursorMonth(m => m - 1)
    } else if (viewMode === 'year') {
      setCursorYear(y => y - 1)
    }
  }
  const handleNext = () => {
    if (viewMode === 'month') {
      if (cursorMonth === 11) { setCursorMonth(0); setCursorYear(y => y + 1) }
      else setCursorMonth(m => m + 1)
    } else if (viewMode === 'year') {
      setCursorYear(y => y + 1)
    }
  }
  const handleJumpToday = () => {
    const n = new Date()
    setCursorYear(n.getFullYear())
    setCursorMonth(n.getMonth())
  }

  const today = todayIso()
  const todayInRange = today >= rangeStart && today <= rangeEnd
  const rangeLabel = viewMode === 'live'
    ? `${PAST_DAYS}d back → ${horizonDays}d ahead`
    : viewMode === 'month'
      ? new Date(`${rangeStart}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : String(cursorYear)

  return {
    viewMode, setViewMode, rangeStart, rangeEnd, totalDays, today, todayInRange, rangeLabel,
    handlePrev, handleNext, handleJumpToday,
  }
}

function AlmanacRangeNav({ viewMode, setViewMode, rangeLabel, todayInRange, onPrev, onNext, onToday }: {
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  rangeLabel: string
  todayInRange: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
      {(['live', 'month', 'year'] as ViewMode[]).map(m => (
        <button
          key={m}
          onClick={() => setViewMode(m)}
          style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 11, textTransform: 'capitalize',
            cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
            background: viewMode === m ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
            border: `1px solid ${viewMode === m ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--border)'}`,
            color: viewMode === m ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {m}
        </button>
      ))}
      {viewMode !== 'live' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <button onClick={onPrev} aria-label={`Previous ${viewMode}`} style={{
            width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
          }}>‹</button>
          <span style={{
            fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)',
            minWidth: 96, textAlign: 'center',
          }}>
            {rangeLabel}
          </span>
          <button onClick={onNext} aria-label={`Next ${viewMode}`} style={{
            width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
          }}>›</button>
          {!todayInRange && (
            <button onClick={onToday} style={{
              marginLeft: 6, padding: '3px 10px', borderRadius: 6, fontSize: 10.5, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
            }}>Today</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Day-lord (vara) lookup — shared by both bodies ─────────────────────────

function useLordByWeekday() {
  const { data: planets } = usePlanets()
  const { data: daysOfWeek } = useDaysOfWeek()
  const { data: dayLords } = useDayLords()
  return useMemo(() => {
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
}

// ── Lane row (Mercury only) ─────────────────────────────────────────────────

function TimelineLane({
  title, segments, rangeStart, totalDays, cutoffIso, color, onSegmentClick, onLockedClick, lordFor, sanskrit,
}: {
  title: string
  segments: LaneSegment[]
  rangeStart: string
  totalDays: number
  cutoffIso: string
  color: string
  onSegmentClick: (seg: LaneSegment, e: React.MouseEvent) => void
  onLockedClick: (e: React.MouseEvent) => void
  lordFor: (iso: string) => string | null
  /** Journey lane only — segment labels are zodiac signs, shown in Sanskrit (Panchang style), English kept in the tooltip. */
  sanskrit?: boolean
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
        {segments.map((seg, i) => {
          const left = xPct(seg.from, rangeStart, totalDays)
          const right = xPct(seg.to, rangeStart, totalDays)
          const width = Math.max(right - left, 0.4)
          const locked = seg.from > cutoffIso
          const lord = lordFor(seg.from)
          const displayLabel = sanskrit ? sanskritSign(seg.label) : seg.label
          const englishSuffix = sanskrit && displayLabel !== seg.label ? ` (${seg.label})` : ''
          const startTitle = lord
            ? `${displayLabel}${englishSuffix} · ${fmtD(seg.from)} → ${fmtD(seg.to)} · starts on ${lord}'s day`
            : `${displayLabel}${englishSuffix} · ${fmtD(seg.from)} → ${fmtD(seg.to)}`
          // Alternate tint by index so back-to-back same-color segments (the
          // Journey lane is always fully covered — no true gaps) stay
          // visually distinct instead of blending into one faint blob.
          const fillPct = i % 2 === 0 ? 24 : 34
          return (
            <div
              key={`${seg.ruleCode}-${seg.from}`}
              onClick={e => locked ? onLockedClick(e) : onSegmentClick(seg, e)}
              title={locked ? 'Beyond your plan’s horizon' : startTitle}
              style={{
                position: 'absolute', left: `${left}%`, width: `${width}%`,
                top: 4, bottom: 4, cursor: 'pointer',
                borderRadius: i === 0 ? '4px 0 0 4px' : i === segments.length - 1 ? '0 4px 4px 0' : 0,
                background: locked
                  ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)'
                  : `color-mix(in srgb, ${color} ${fillPct}%, transparent)`,
                borderTop: `1px solid ${locked ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : `color-mix(in srgb, ${color} 60%, transparent)`}`,
                borderBottom: `1px solid ${locked ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : `color-mix(in srgb, ${color} 60%, transparent)`}`,
                borderLeft: `1px solid ${locked ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : 'color-mix(in srgb, var(--card) 80%, transparent)'}`,
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
                  {locked ? '🔒' : displayLabel}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Mercury body ─────────────────────────────────────────────────────────────

function MercuryAlmanacBody({
  cutoffIso, fullQuarter, horizonDays, evidenceByRule, lordFor, onExplain, onGate,
}: {
  cutoffIso: string
  fullQuarter: boolean
  horizonDays: number
  evidenceByRule: Map<number, RuleEvidence>
  lordFor: (iso: string) => string | null
  onExplain: (ruleId: number, ruleCode: string, label: string, x: number, y: number) => void
  onGate: () => void
}) {
  const {
    viewMode, setViewMode, rangeStart, rangeEnd, totalDays, today, todayInRange, rangeLabel,
    handlePrev, handleNext, handleJumpToday,
  } = useAlmanacRange(horizonDays)

  const { data: almanac, isLoading } = useQuery({
    queryKey: ['mercury-almanac', rangeStart, rangeEnd],
    queryFn: () => fetchMercuryAlmanac(rangeStart, rangeEnd),
    staleTime: 15 * 60_000,
    retry: 1,
  })

  const todayLeft = xPct(today, rangeStart, totalDays)
  const cutoffLeft = xPct(cutoffIso, rangeStart, totalDays)

  const { data: sectors } = useSectors()
  const { data: sectorLords } = useSectorLords()
  const { data: planets } = usePlanets()
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

  const vixUntil = rangeEnd < today ? rangeEnd : today
  const { data: vixSeries } = useQuery({
    queryKey: ['almanac-vix', rangeStart, vixUntil],
    queryFn: () => fetchVixSeries(rangeStart, vixUntil),
    staleTime: 15 * 60_000,
    retry: 1,
    enabled: rangeStart <= vixUntil,
  })
  const vixFor = (iso: string) => vixContextForDate((vixSeries ?? []) as VixPoint[], iso)

  const handleSegmentClick = (seg: LaneSegment, e: React.MouseEvent) => {
    e.stopPropagation()
    onExplain(seg.ruleId, seg.ruleCode, `☿ ${seg.label}`, e.clientX, e.clientY)
  }
  const handleEventClick = (ev: AlmanacEvent, e: React.MouseEvent) => {
    if (ev.date > cutoffIso) { onGate(); return }
    onExplain(ev.ruleId, ev.ruleCode, `☿ ${ev.label}`, e.clientX, e.clientY)
  }
  const handleLockedClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onGate()
  }

  const visibleEvents = (almanac?.events ?? []).filter(ev => ev.date >= rangeStart && ev.date <= rangeEnd)

  return (
    <>
      <AlmanacRangeNav
        viewMode={viewMode} setViewMode={setViewMode} rangeLabel={rangeLabel} todayInRange={todayInRange}
        onPrev={handlePrev} onNext={handleNext} onToday={handleJumpToday}
      />

      {isLoading ? (
        <DristiQLoader message="Reading Mercury's transits…" />
      ) : !almanac ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No Mercury data available.
        </div>
      ) : (
        <>
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
              <button onClick={onGate} style={{
                marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--caution) 45%, transparent)',
                background: 'transparent', color: 'var(--caution)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Unlock the full quarter
              </button>
            </div>
          )}

          <div style={{
            overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--card)', padding: '16px 16px 10px', marginBottom: 24,
          }}>
            <div style={{ position: 'relative', minWidth: 900 }}>
              <div style={{ position: 'relative' }}>
                {todayInRange && (
                  <>
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
                  </>
                )}
                {!fullQuarter && cutoffIso >= rangeStart && cutoffIso <= rangeEnd && (
                  <div style={{
                    position: 'absolute', left: `${cutoffLeft}%`, right: 0, top: 0, bottom: 0,
                    background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
                    borderLeft: '1px dashed color-mix(in srgb, var(--caution) 40%, transparent)',
                    zIndex: 1, pointerEvents: 'none',
                  }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <TimelineLane title="Journey" segments={almanac.journey} rangeStart={rangeStart} totalDays={totalDays}
                    cutoffIso={cutoffIso} color={LANE_COLORS.journey} lordFor={lordFor} sanskrit
                    onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                  <TimelineLane title="Motion" segments={almanac.motion} rangeStart={rangeStart} totalDays={totalDays}
                    cutoffIso={cutoffIso} color={LANE_COLORS.motion} lordFor={lordFor}
                    onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                  <TimelineLane title="Combust" segments={almanac.combust} rangeStart={rangeStart} totalDays={totalDays}
                    cutoffIso={cutoffIso} color={LANE_COLORS.combust} lordFor={lordFor}
                    onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Events · {rangeLabel}
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
              const isJourney = ev.ruleCode === RULE_JOURNEY
              const displayEventLabel = isJourney
                ? ev.label.replace(/^(enters|exits) (.+)$/, (_m, verb, sign) => `${verb} ${sanskritSign(sign)}`)
                : ev.label
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
                  <span
                    title={isJourney && displayEventLabel !== ev.label ? `English: ${ev.label}` : undefined}
                    style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-primary)', minWidth: 140 }}
                  >
                    ☿ {displayEventLabel}
                  </span>
                  {ev.days > 0 && (
                    <span
                      title={`${ev.boundary === 'start' ? 'Start' : 'End'} of a ${ev.days}-day window (this date is the ${ev.boundary})`}
                      style={{
                        flexShrink: 0, fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                        color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)', width: 32,
                      }}
                    >
                      {ev.days}d
                    </span>
                  )}
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
                  {(locked || read || vix) && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'stretch', minHeight: 20 }}>
                      <div style={{
                        width: 260, flexShrink: 0, display: 'flex', alignItems: 'center',
                        fontSize: 10.5, color: locked ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontFamily: locked ? 'var(--font-mono, monospace)' : undefined,
                      }}>
                        {locked ? "🔒 unlock to see this event's history" : read ? read.hover : ''}
                      </div>
                      {vix && (
                        <div style={{
                          width: 1, alignSelf: 'stretch', margin: '0 14px',
                          background: 'color-mix(in srgb, var(--text-primary) 18%, transparent)',
                        }} />
                      )}
                      {vix && (() => {
                        const EPS = 0.15
                        const rising = vix.trendPct > EPS
                        const falling = vix.trendPct < -EPS
                        const vixColor = rising ? 'var(--bear)' : falling ? 'var(--bull)' : 'var(--caution)'
                        const arrow = rising ? '▲' : falling ? '▼' : '▶'
                        return (
                          <div
                            title="India VIX as of this date — reference only, not scored"
                            style={{
                              width: 90, flexShrink: 0, display: 'flex', alignItems: 'center',
                              fontSize: 10, fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap',
                              color: vixColor,
                            }}
                          >
                            VIX {vix.close.toFixed(1)} {arrow}{Math.abs(vix.trendPct).toFixed(1)}%
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ── Bayer per-rule timeline drill-down ──────────────────────────────────────
// A single rule's own history over time IS a coherent story (unlike merging
// all 9 into one shared timeline) — same Live/Month/Year browsing as
// Mercury, just scoped to the one rule the user drilled into.

function BayerRuleDetail({
  ruleCode, ruleId, cutoffIso, horizonDays, evidenceByRule, lordFor, onExplain, onGate, onBack,
}: {
  ruleCode: string
  ruleId: number
  cutoffIso: string
  horizonDays: number
  evidenceByRule: Map<number, RuleEvidence>
  lordFor: (iso: string) => string | null
  onExplain: (ruleId: number, ruleCode: string, label: string, x: number, y: number) => void
  onGate: () => void
  onBack: () => void
}) {
  const def = BAYER_RULES.find(r => r.code === ruleCode)
  const {
    viewMode, setViewMode, rangeStart, rangeEnd, totalDays, todayInRange, rangeLabel,
    handlePrev, handleNext, handleJumpToday,
  } = useAlmanacRange(horizonDays)

  const { data: segments, isLoading } = useQuery({
    queryKey: ['bayer-rule-windows', ruleCode, rangeStart, rangeEnd],
    queryFn: () => fetchBayerRuleWindows(ruleCode, rangeStart, rangeEnd),
    staleTime: 15 * 60_000,
    retry: 1,
  })

  if (!def) return null
  const color = bayerRuleColor(ruleCode)
  const glyph = bayerGlyph(ruleCode)
  const ev = evidenceByRule.get(ruleId)
  const read = ev ? buildRuleRead(ev) : null

  const handleSegmentClick = (seg: LaneSegment, e: React.MouseEvent) => {
    e.stopPropagation()
    onExplain(seg.ruleId, seg.ruleCode, `${glyph} ${seg.label}`, e.clientX, e.clientY)
  }
  const handleLockedClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onGate()
  }

  return (
    <>
      <button
        onClick={onBack}
        style={{
          marginTop: 14, fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        ← All rules
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
        <span style={{ fontSize: 18, color, lineHeight: 1 }}>{glyph}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>{def.ruleNum}</span>
        <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{def.label}</span>
      </div>
      {read && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{read.hover}</div>
      )}

      <AlmanacRangeNav
        viewMode={viewMode} setViewMode={setViewMode} rangeLabel={rangeLabel} todayInRange={todayInRange}
        onPrev={handlePrev} onNext={handleNext} onToday={handleJumpToday}
      />

      {isLoading ? (
        <DristiQLoader message={`Reading ${def.label}'s windows…`} />
      ) : !segments || segments.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No windows in this range.
        </div>
      ) : (
        <>
          <div style={{
            overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--card)', padding: '16px 16px 10px', marginBottom: 16,
          }}>
            <div style={{ minWidth: 900 }}>
              <TimelineLane title={def.ruleNum} segments={segments} rangeStart={rangeStart} totalDays={totalDays}
                cutoffIso={cutoffIso} color={color} lordFor={lordFor}
                onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
            </div>
          </div>

          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
            {segments.map((seg, i) => {
              const locked = seg.from > cutoffIso
              const days = daysBetween(seg.from, seg.to)
              return (
                <div
                  key={`${seg.from}-${i}`}
                  onClick={e => locked ? handleLockedClick(e) : handleSegmentClick(seg, e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', cursor: 'pointer',
                    borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)',
                    opacity: locked ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', minWidth: 220 }}>
                    {locked ? '🔒 ' : ''}{fmtD(seg.from)}{seg.isPoint ? '' : ` → ${fmtD(seg.to)}`}
                  </span>
                  {!seg.isPoint && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                      {days}d
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ── Bayer body ───────────────────────────────────────────────────────────────

function BayerRulesBody({
  cutoffIso, horizonDays, evidenceByRule, lordFor, onExplain, onGate,
}: {
  cutoffIso: string
  horizonDays: number
  evidenceByRule: Map<number, RuleEvidence>
  lordFor: (iso: string) => string | null
  onExplain: (ruleId: number, ruleCode: string, label: string, x: number, y: number) => void
  onGate: () => void
}) {
  const [detailRule, setDetailRule] = useState<{ code: string; ruleId: number } | null>(null)
  const today = todayIso()
  // Fixed window, not tied to any nav — a status view answers "right now",
  // not a browsable period. Forward margin generous enough that even the
  // rarest rule (R3, roughly once a year) usually has a next occurrence.
  const since = useMemo(() => addDays(today, -30), [today])
  const until = useMemo(() => addDays(today, 400), [today])

  const { data: statuses, isLoading } = useQuery({
    queryKey: ['bayer-status', since, until, today],
    queryFn: () => fetchBayerStatus(since, until, today),
    staleTime: 15 * 60_000,
    retry: 1,
    enabled: !detailRule,
  })

  const { data: vixSeries } = useQuery({
    queryKey: ['almanac-vix', addDays(today, -10), today],
    queryFn: () => fetchVixSeries(addDays(today, -10), today),
    staleTime: 15 * 60_000,
    retry: 1,
    enabled: !detailRule,
  })
  const todayVix = vixContextForDate((vixSeries ?? []) as VixPoint[], today)

  const lord = lordFor(today)
  const weekday = WEEKDAY_ABBR[new Date(`${today}T00:00:00`).getDay()]

  if (detailRule) {
    return (
      <BayerRuleDetail
        ruleCode={detailRule.code} ruleId={detailRule.ruleId}
        cutoffIso={cutoffIso} horizonDays={horizonDays} evidenceByRule={evidenceByRule} lordFor={lordFor}
        onExplain={onExplain} onGate={onGate} onBack={() => setDetailRule(null)}
      />
    )
  }

  if (isLoading) return <DristiQLoader message="Reading Bayer's rules…" />
  if (!statuses) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No Bayer data available.
      </div>
    )
  }

  return (
    <>
      {/* Today context — shared ambient facts, not scored claims */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0',
        fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)',
      }}>
        <span>Today · {fmtD(today)}</span>
        {lord && (
          <span title={`${weekday}day · ${lord}'s day (vara lord)`}>
            {PLANET_GLYPH[lord] ?? ''} {lord}'s day
          </span>
        )}
        {todayVix && (
          <span title="India VIX — reference only, not scored">
            VIX {todayVix.close.toFixed(1)} {todayVix.trendPct >= 0 ? '▲' : '▼'}{Math.abs(todayVix.trendPct).toFixed(1)}%
          </span>
        )}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12,
      }}>
        {statuses.map(s => {
          const color = bayerRuleColor(s.ruleCode)
          const glyph = bayerGlyph(s.ruleCode)
          const ev = evidenceByRule.get(s.ruleId)
          const read = ev ? buildRuleRead(ev) : null
          const nextLocked = !!s.next && s.next.from > cutoffIso
          const biasColor = s.def.baseBias === 'bullish' ? 'var(--bull)'
            : s.def.baseBias === 'bearish' ? 'var(--bear)' : 'var(--caution)'

          return (
            <div
              key={s.ruleCode}
              style={{
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                borderRadius: 10, padding: 14, background: 'var(--card)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, color, lineHeight: 1 }}>{glyph}</span>
                <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                  {s.def.ruleNum}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {s.def.label}
                </span>
              </div>

              <div>
                {s.active ? (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                    color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    ● active {s.active.isPoint ? 'today' : `until ${fmtD(s.active.to)}`}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    ○ not active
                  </span>
                )}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {s.next
                  ? nextLocked
                    ? "🔒 next window beyond your plan's horizon"
                    : `Next: ${fmtD(s.next.from)}${s.next.isPoint ? '' : ` → ${fmtD(s.next.to)}`}`
                  : 'No upcoming window in the next ~400 days'}
              </div>

              <div style={{ fontSize: 10.5, color: 'color-mix(in srgb, var(--text-primary) 55%, transparent)', minHeight: 28 }}>
                {read ? read.hover : 'No evidence yet'}
              </div>

              <div
                title="Bayer's own 1940 claim — a hypothesis to weigh against the evidence above, not a verified fact"
                style={{ fontSize: 9.5, color: biasColor, fontFamily: 'var(--font-mono, monospace)' }}
              >
                Bayer's claim: {s.def.baseBias} (unverified)
              </div>

              <div style={{ display: 'flex', gap: 14, marginTop: 2, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <button
                  onClick={e => onExplain(s.ruleId, s.ruleCode, `${glyph} ${s.def.label}`, e.clientX, e.clientY)}
                  style={{
                    fontSize: 10.5, color: 'var(--text-secondary)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                  }}
                >
                  Explain ▸
                </button>
                <button
                  onClick={() => setDetailRule({ code: s.ruleCode, ruleId: s.ruleId })}
                  style={{
                    fontSize: 10.5, color, background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                  }}
                >
                  Timeline ▸
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Page shell ───────────────────────────────────────────────────────────────

export default function AlmanacPage() {
  const { cutoffIso, fullQuarter, days: horizonDays } = useAstroHorizon()
  const [gateOpen, setGateOpen] = useState(false)
  const [explainAt, setExplainAt] = useState<{ x: number; y: number; ruleCode: string; ruleId: number; label: string } | null>(null)
  const [almanacType, setAlmanacType] = useState<AlmanacType>('mercury')

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

  const lordByWeekday = useLordByWeekday()
  const lordFor = (iso: string): string | null => lordByWeekday[new Date(`${iso}T00:00:00`).getDay()] ?? null

  const onExplain = (ruleId: number, ruleCode: string, label: string, x: number, y: number) => {
    setExplainAt({ x, y, ruleCode, ruleId, label })
  }

  return (
    <div style={{ padding: '20px 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Astro Layer"
        title={almanacType === 'mercury' ? 'Mercury' : 'Bayer'}
        titleEm={almanacType === 'mercury' ? 'Almanac' : 'Rules'}
        lead={almanacType === 'mercury'
          ? 'Motion · Combust & Rise · Journey'
          : "George Bayer's 1940 trading rules · which are active, right now"}
      />

      {/* Type selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <label style={{
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Almanac
        </label>
        <select
          value={almanacType}
          onChange={e => setAlmanacType(e.target.value as AlmanacType)}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-mono, monospace)', background: 'var(--card)',
            border: '1px solid var(--border)', color: 'var(--text-primary)',
          }}
        >
          {ALMANAC_TYPES.map(t => (
            <option key={t.id} value={t.id} disabled={!t.enabled}>
              {t.label}{!t.enabled ? ' (coming soon)' : ''}
            </option>
          ))}
        </select>
      </div>

      {almanacType === 'mercury' ? (
        <MercuryAlmanacBody
          cutoffIso={cutoffIso} fullQuarter={fullQuarter} horizonDays={horizonDays}
          evidenceByRule={evidenceByRule} lordFor={lordFor}
          onExplain={onExplain} onGate={() => setGateOpen(true)}
        />
      ) : (
        <BayerRulesBody
          cutoffIso={cutoffIso} horizonDays={horizonDays} evidenceByRule={evidenceByRule} lordFor={lordFor}
          onExplain={onExplain} onGate={() => setGateOpen(true)}
        />
      )}

      {explainAt && (
        <OverlayExplainPopover
          tag={almanacType === 'mercury' ? 'Mercury' : 'Bayer'}
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
