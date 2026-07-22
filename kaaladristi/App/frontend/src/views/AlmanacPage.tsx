// Mercury Almanac — the owner's Excel (Motion / Combust & Rise / Journey)
// productized as a three-lane timeline + event list. POA-astro-layer §Phase B.
// Index-only astro layer (principle #0) — this page IS the astro layer, no
// per-instrument gating needed. Reuses the exact evidence/copy/popover
// infrastructure the chart tooltip and ribbon already use — no new stats
// engine, no new honesty rules; this is a new SURFACE over the same numbers.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, DristiQLoader } from '@/components/ui'
import {
  fetchMercuryAlmanac, PAST_DAYS, FUTURE_DAYS, RULE_JOURNEY,
  type LaneSegment, type AlmanacEvent,
} from '@/services/mercuryAlmanac'
import { fetchBayerAlmanac, BAYER_RULES } from '@/services/bayerAlmanac'
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

/** Bayer lanes are one-per-rule across several planets — color by the rule's own tag. */
function bayerLaneColor(ruleCode: string): string {
  if (ruleCode === 'BAY-R03-VEN-RET') return VENUS_COLOR
  if (ruleCode === 'BAY-R06-MAR-1635') return MARS_COLOR
  if (['TRN-MER-MAN-TRN', 'TRN-MER-RIS-W-BUL', 'TR-MER-CMB-E-BEA', 'BAY-R27-MER-SPD'].includes(ruleCode)) return MERCURY_COLOR
  return BAYER_COLOR
}

/** Glyph shown next to a rule's label — Mercury's own glyph in Mercury mode; per-planet in Bayer mode. */
function glyphForRule(ruleCode: string, type: AlmanacType): string {
  if (type === 'mercury') return '☿'
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

// ── Lane row ──────────────────────────────────────────────────────────────

function TimelineLane({
  title, titleTooltip, segments, rangeStart, totalDays, cutoffIso, color, onSegmentClick, onLockedClick, lordFor, sanskrit,
}: {
  title: string
  /** Full rule name shown on hover — Bayer lanes are terse ("R1") to fit the fixed-width column. */
  titleTooltip?: string
  segments: LaneSegment[]
  rangeStart: string
  totalDays: number
  cutoffIso: string
  color: string
  onSegmentClick: (seg: LaneSegment, e: React.MouseEvent) => void
  onLockedClick: (e: React.MouseEvent) => void
  lordFor?: (iso: string) => string | null
  /** Journey lane only — segment labels are zodiac signs, shown in Sanskrit (Panchang style), English kept in the tooltip. */
  sanskrit?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 40 }}>
      <div
        title={titleTooltip}
        style={{
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
          const lord = lordFor?.(seg.from)
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

// ── Page ──────────────────────────────────────────────────────────────────

export default function AlmanacPage() {
  const { cutoffIso, fullQuarter, days: horizonDays } = useAstroHorizon()
  const [gateOpen, setGateOpen] = useState(false)
  const [explainAt, setExplainAt] = useState<{ x: number; y: number; ruleCode: string; ruleId: number; label: string } | null>(null)
  const [almanacType, setAlmanacType] = useState<AlmanacType>('mercury')

  // ── Live / Month / Year nav — history is unrestricted for every tier
  // (Phase C), so Month/Year can browse any past period freely; the future
  // edge still clamps through cutoffIso same as Live.
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

  const { data: mercuryAlmanac, isLoading: mercuryLoading } = useQuery({
    queryKey: ['mercury-almanac', rangeStart, rangeEnd],
    queryFn: () => fetchMercuryAlmanac(rangeStart, rangeEnd),
    staleTime: 15 * 60_000,
    retry: 1,
    enabled: almanacType === 'mercury',
  })
  const { data: bayerAlmanac, isLoading: bayerLoading } = useQuery({
    queryKey: ['bayer-almanac', rangeStart, rangeEnd],
    queryFn: () => fetchBayerAlmanac(rangeStart, rangeEnd),
    staleTime: 15 * 60_000,
    retry: 1,
    enabled: almanacType === 'bayer',
  })
  const isLoading = almanacType === 'mercury' ? mercuryLoading : bayerLoading
  const hasData = almanacType === 'mercury' ? !!mercuryAlmanac : !!bayerAlmanac
  const events = almanacType === 'mercury' ? (mercuryAlmanac?.events ?? []) : (bayerAlmanac?.events ?? [])

  const renderLanes = useMemo(() => {
    if (almanacType === 'mercury') {
      if (!mercuryAlmanac) return []
      return [
        { title: 'Journey', titleTooltip: undefined, segments: mercuryAlmanac.journey, color: LANE_COLORS.journey, sanskrit: true },
        { title: 'Motion', titleTooltip: undefined, segments: mercuryAlmanac.motion, color: LANE_COLORS.motion, sanskrit: false },
        { title: 'Combust', titleTooltip: undefined, segments: mercuryAlmanac.combust, color: LANE_COLORS.combust, sanskrit: false },
      ]
    }
    if (!bayerAlmanac) return []
    return bayerAlmanac.lanes.map(lane => ({
      title: lane.title,
      titleTooltip: BAYER_RULES.find(r => r.code === lane.ruleCode)?.label,
      segments: lane.segments, color: bayerLaneColor(lane.ruleCode),
      sanskrit: lane.ruleCode === RULE_JOURNEY,
    }))
  }, [almanacType, mercuryAlmanac, bayerAlmanac])

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

  const today = todayIso()
  const todayInRange = today >= rangeStart && today <= rangeEnd
  const todayLeft = xPct(today, rangeStart, totalDays)
  const cutoffLeft = xPct(cutoffIso, rangeStart, totalDays)

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
  // Clamp the fetch to whichever of rangeEnd/today is earlier — no VIX data
  // exists for future dates when browsing Month/Year ahead of today.
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
    setExplainAt({ x: e.clientX, y: e.clientY, ruleCode: seg.ruleCode, ruleId: seg.ruleId, label: `${glyphForRule(seg.ruleCode, almanacType)} ${seg.label}` })
  }
  const handleEventClick = (ev: AlmanacEvent, e: React.MouseEvent) => {
    if (ev.date > cutoffIso) { setGateOpen(true); return }
    setExplainAt({ x: e.clientX, y: e.clientY, ruleCode: ev.ruleCode, ruleId: ev.ruleId, label: `${glyphForRule(ev.ruleCode, almanacType)} ${ev.label}` })
  }
  const handleLockedClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setGateOpen(true)
  }

  const visibleEvents = events.filter(ev => ev.date >= rangeStart && ev.date <= rangeEnd)

  const rangeLabel = viewMode === 'live'
    ? `${PAST_DAYS}d back → ${horizonDays}d ahead`
    : viewMode === 'month'
      ? new Date(`${rangeStart}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : String(cursorYear)

  return (
    <div style={{ padding: '20px 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Astro Layer"
        title={almanacType === 'mercury' ? 'Mercury' : 'Bayer'}
        titleEm={almanacType === 'mercury' ? 'Almanac' : 'Rules'}
        lead={almanacType === 'mercury'
          ? 'Motion · Combust & Rise · Journey'
          : "George Bayer's 1940 trading rules · one lane per rule"}
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

      {/* Live / Month / Year nav */}
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
            <button
              onClick={handlePrev}
              aria-label={`Previous ${viewMode}`}
              style={{
                width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
              }}
            >
              ‹
            </button>
            <span style={{
              fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)',
              minWidth: 96, textAlign: 'center',
            }}>
              {rangeLabel}
            </span>
            <button
              onClick={handleNext}
              aria-label={`Next ${viewMode}`}
              style={{
                width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
              }}
            >
              ›
            </button>
            {!todayInRange && (
              <button
                onClick={handleJumpToday}
                style={{
                  marginLeft: 6, padding: '3px 10px', borderRadius: 6, fontSize: 10.5, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
                }}
              >
                Today
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <DristiQLoader message={almanacType === 'mercury' ? "Reading Mercury's transits…" : "Reading Bayer's rules…"} />
      ) : !hasData ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No {almanacType === 'mercury' ? 'Mercury' : 'Bayer'} data available.
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
                  {renderLanes.map(lane => (
                    <TimelineLane key={lane.title} title={lane.title} titleTooltip={lane.titleTooltip} segments={lane.segments}
                      rangeStart={rangeStart} totalDays={totalDays} cutoffIso={cutoffIso}
                      color={lane.color} lordFor={lordFor} sanskrit={lane.sanskrit}
                      onSegmentClick={handleSegmentClick} onLockedClick={handleLockedClick} />
                  ))}
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
                Events · {rangeLabel}
              </div>
              {almanacType === 'mercury' && mercurySectorNames.length > 0 && (
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
                    {glyphForRule(ev.ruleCode, almanacType)} {displayEventLabel}
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
                      {/* Column 1 — the pattern read (or lock message) */}
                      <div style={{
                        width: 260, flexShrink: 0, display: 'flex', alignItems: 'center',
                        fontSize: 10.5, color: locked ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontFamily: locked ? 'var(--font-mono, monospace)' : undefined,
                      }}>
                        {locked ? "🔒 unlock to see this event's history" : read ? read.hover : ''}
                      </div>

                      {/* Visible divider between the two right-side columns */}
                      {vix && (
                        <div style={{
                          width: 1, alignSelf: 'stretch', margin: '0 14px',
                          background: 'color-mix(in srgb, var(--text-primary) 18%, transparent)',
                        }} />
                      )}

                      {/* Column 2 — VIX context, colored by direction */}
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
