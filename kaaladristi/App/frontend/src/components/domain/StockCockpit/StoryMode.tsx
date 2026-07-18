/**
 * StoryMode — a focused, single-viewport replay of the price × signal story.
 *
 * One fixed screen, no scrolling: a compact verdict strip pinned on top, the
 * price chart filling the height with the on-candle bubble, and a bottom bar
 * with Play/Pause, a speed control, and an event scrubber. Playback HOPS event
 * → event across the chart's own bars, so every event is reachable (fixes the
 * "only frequent events show" window problem). Observational, not predictive.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import TradingChart from '@/components/charts/TradingChart'
import type { IndicatorRow } from '@/services/indicatorData'
import { buildStoryEvents, KIND_COLORS, type StoryEvent } from '@/services/storyEvents'
import { narrateVani } from '@/services/vaniNarrate'
import { buildPillars, type LatestRow, type VerdictMode } from './VerdictHero'

/** Deterministic facts for one story moment — VaNi narrates only these. */
function eventFacts(name: string, e: StoryEvent): string {
  return [
    `Instrument: ${name}`,
    `Event: ${e.title} on ${e.date}`,
    `Detail: ${e.detail}`,
    `Tone: ${e.tone}`,
    e.reactionPct != null ? `Price reaction over the next 5 bars: ${e.reactionPct >= 0 ? '+' : ''}${e.reactionPct.toFixed(1)}%` : '',
  ].filter(Boolean).join('\n')
}
import SectorThermometer from './SectorThermometer'
import type { ChartOverlay } from '@/types/framework'
import type { AstroBand } from '@/services/astroOverlayService'

interface CorrState { state: string; color: string; tagline?: string }
interface SectorPoint { percentile: number; leading: boolean }

interface Props {
  open: boolean
  onClose: () => void
  bars: IndicatorRow[]
  name: string
  latest: LatestRow | null
  snapshot?: { corrState?: CorrState } | null
  bigMoneyDates: Set<string>
  /** Equity: industry percentile over time — drives the thermometer + sector
   *  story events. */
  sectorByDate?: Map<string, SectorPoint>
  /** Index: breadth score over time — drives the thermometer only (no sector
   *  events; an index has no parent sector). */
  breadthByDate?: Map<string, SectorPoint>
  mode?: VerdictMode
  breadthPct?: number | null
  /** Framework chart overlays (SuperTrend / SMAs / Pivots / astro zones) so
   *  story mode matches the analysis chart instead of stripping them. */
  overlays?: ChartOverlay[]
  astroBands?: AstroBand[]
}

/** Breadth/sector reading at (or nearest on-or-before) a date. The breadth
 *  series only covers recent sessions, so an exact-date miss falls back to the
 *  latest available reading up to that date — else the earliest — so the
 *  thermometer always shows a real value instead of a blank "—". */
function readAtDate(map: Map<string, SectorPoint> | undefined, date: string): SectorPoint | undefined {
  if (!map || map.size === 0) return undefined
  const exact = map.get(date)
  if (exact) return exact
  let best: SectorPoint | undefined
  let bestDate = ''
  let earliest: SectorPoint | undefined
  let earliestDate = '￿'
  for (const [d, v] of map) {
    if (d <= date && d > bestDate) { bestDate = d; best = v }
    if (d < earliestDate) { earliestDate = d; earliest = v }
  }
  return best ?? earliest
}

const SPEEDS = [0.5, 1, 2] as const
const BASE_DWELL_MS = 2600

export default function StoryMode({ open, onClose, bars, name, latest, snapshot, bigMoneyDates, sectorByDate, breadthByDate, mode, breadthPct, overlays, astroBands }: Props) {
  const events = useMemo(() => buildStoryEvents(bars, bigMoneyDates, sectorByDate), [bars, bigMoneyDates, sectorByDate])
  const pillars = useMemo(() => (latest ? buildPillars(latest, { mode, breadthPct }) : []), [latest, mode, breadthPct])
  // Thermometer source: a stock reads its SECTOR percentile; an index reads its
  // own BREADTH score. Same vertical card, different feed + label.
  const thermoByDate = sectorByDate ?? breadthByDate
  const thermoLabel = sectorByDate ? 'Sector' : 'Breadth'
  const thermoLeadLabel = sectorByDate ? 'leading' : 'broad'
  const alignedCount = pillars.filter((p) => p.aligned).length
  const corr = snapshot?.corrState

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const [chartH, setChartH] = useState(420)

  // Reset to the first event whenever the overlay opens.
  useEffect(() => { if (open) { setIdx(0); setPlaying(false) } }, [open])

  // VaNi narration of the current moment (Phase 3) — reset when the event changes.
  const [vaniText, setVaniText] = useState<string | null>(null)
  const [vaniLoading, setVaniLoading] = useState(false)
  useEffect(() => { setVaniText(null); setVaniLoading(false) }, [idx])
  // Playing past events shouldn't leave a stale narration up.
  useEffect(() => { if (playing) setVaniText(null) }, [playing])

  // Esc closes; measure the chart wrapper so the chart truly fills the space.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const el = chartWrapRef.current
    let ro: ResizeObserver | null = null
    if (el) {
      const measure = () => setChartH(Math.max(280, el.clientHeight - 6))
      measure()
      ro = new ResizeObserver(measure)
      ro.observe(el)
    }
    return () => { window.removeEventListener('keydown', onKey); ro?.disconnect() }
  }, [open, onClose])

  // Playback — advance one event per dwell (speed-scaled).
  useEffect(() => {
    if (!open || !playing || events.length === 0) return
    if (idx >= events.length - 1) { setPlaying(false); return }
    const t = setTimeout(() => setIdx((i) => Math.min(i + 1, events.length - 1)), Math.round(BASE_DWELL_MS / speed))
    return () => clearTimeout(t)
  }, [open, playing, idx, speed, events.length])

  if (!open) return null

  const cur = events[idx] ?? null
  const storyBubble = cur
    ? { date: cur.date, tone: cur.tone, color: KIND_COLORS[cur.kind], title: cur.title, detail: cur.detail, reactionPct: cur.reactionPct }
    : null
  const highlightDate = cur ? bars[cur.barIndex]?.trade_date ?? null : null
  const secDate = cur?.date ?? bars[bars.length - 1]?.trade_date
  const sec = secDate ? readAtDate(thermoByDate, secDate) : undefined

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Verdict strip (pinned) ── */}
      <div
        className="flex items-center gap-4 px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-[var(--text-primary)] truncate">{name}</div>
          {corr && (
            <div className="text-[11px]" style={{ color: corr.color }}>
              ● <span className="font-semibold">{corr.state}</span>
              <span className="text-muted"> · {alignedCount} of 4 aligned{corr.tagline ? ` · ${corr.tagline}` : ''}</span>
            </div>
          )}
        </div>

        {/* Pillar chips */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          {pillars.map((p) => (
            <div
              key={p.key}
              className="px-2.5 py-1 rounded-lg"
              style={{
                background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                border: `1px solid ${p.aligned ? `color-mix(in srgb, ${p.toneColor} 35%, transparent)` : 'var(--border)'}`,
              }}
            >
              <div className="text-[8.5px] font-mono uppercase tracking-wider text-muted">{p.label}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{p.value}</span>
                <span className="text-[9px]" style={{ color: p.toneColor }}>{p.tone}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="ml-2 md:ml-0 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-[var(--text-primary)] transition-colors"
          style={{ border: '1px solid var(--border)' }}
          title="Exit story (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Chart (fills the height) ── */}
      <div ref={chartWrapRef} className="flex-1 min-h-0 px-3 pt-3 flex gap-2">
        <div className="flex-1 min-w-0">
          <TradingChart
            data={bars}
            workspaceMode
            height={chartH}
            highlightDate={highlightDate}
            storyBubble={storyBubble}
            overlays={overlays}
            astroBands={astroBands}
          />
        </div>
        {thermoByDate && thermoByDate.size > 0 && (
          <SectorThermometer
            percentile={sec?.percentile ?? null}
            leading={sec?.leading ?? false}
            label={thermoLabel}
            leadingLabel={thermoLeadLabel}
          />
        )}
      </div>

      {/* ── VaNi narrates the current moment (Phase 3) ── */}
      {cur && (
        <div
          className="flex items-center gap-3 px-5 py-2 border-t"
          style={{ borderColor: 'var(--border)', background: 'linear-gradient(90deg, color-mix(in srgb, var(--vani) 8%, transparent), transparent)' }}
        >
          <span style={{ color: 'var(--vani)', fontSize: 14 }}>✦</span>
          <span className="text-[12px] min-w-0" style={{ color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--vani)' }}>VaNi</b>{' '}
            <span className="text-muted">— {vaniText ?? `${cur.title}. ${cur.detail}.`}</span>
          </span>
          {!vaniText && (
            <button
              onClick={async () => {
                setVaniLoading(true)
                const text = await narrateVani(name, eventFacts(name, cur))
                setVaniText(text); setVaniLoading(false)
              }}
              disabled={vaniLoading}
              className="ml-auto shrink-0 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border transition-colors"
              style={{ color: 'var(--vani)', borderColor: 'color-mix(in srgb, var(--vani) 34%, transparent)',
                background: 'color-mix(in srgb, var(--vani) 10%, transparent)', opacity: vaniLoading ? 0.6 : 1 }}
            >
              {vaniLoading ? '✦ reading…' : '✦ Ask VaNi'}
            </button>
          )}
        </div>
      )}

      {/* ── Controls (pinned) ── */}
      <div
        className="flex items-center gap-4 px-5 py-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => {
            if (idx >= events.length - 1) setIdx(0)
            setPlaying((p) => !p)
          }}
          disabled={events.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors disabled:opacity-40"
        >
          {playing ? '❚❚ Pause' : '▷ Play'}
        </button>

        {/* Speed */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className="px-2 py-1 rounded-md text-[11px] font-mono transition-colors"
              style={{
                background: speed === s ? 'var(--accent-glow)' : 'transparent',
                color: speed === s ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${speed === s ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Event scrubber */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {events.map((e, i) => (
            <button
              key={`${e.barIndex}-${e.kind}`}
              onClick={() => { setIdx(i); setPlaying(false) }}
              title={`${e.title} · ${e.date}`}
              className="shrink-0 rounded-full transition-all"
              style={{
                width: i === idx ? 11 : 7,
                height: i === idx ? 11 : 7,
                background: KIND_COLORS[e.kind],
                opacity: i === idx ? 1 : 0.45,
              }}
            />
          ))}
        </div>

        {/* Current caption */}
        <div className="shrink-0 text-right min-w-[180px]">
          {cur ? (
            <>
              <div className="text-xs font-semibold" style={{ color: KIND_COLORS[cur.kind] }}>{cur.title}</div>
              <div className="text-[10px] text-muted font-mono">
                {cur.date}
                {cur.reactionPct != null && (
                  <> · price <span style={{ color: cur.reactionPct >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}>{cur.reactionPct >= 0 ? '+' : ''}{cur.reactionPct.toFixed(1)}%</span> / 5 bars</>
                )}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-muted">No signal events in range.</div>
          )}
        </div>
      </div>
    </div>
  )
}
