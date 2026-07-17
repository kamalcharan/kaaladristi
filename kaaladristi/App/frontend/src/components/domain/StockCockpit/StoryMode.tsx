/**
 * StoryMode — a focused, single-viewport replay of the price × signal story.
 *
 * One fixed screen, no scrolling: a compact verdict strip pinned on top, the
 * price chart filling the height with the on-candle bubble, and a bottom bar
 * with Play/Pause, a speed control, and an event scrubber. Playback HOPS event
 * → event across the chart's own bars, so every event is reachable (fixes the
 * "only frequent events show" window problem). Observational, not predictive.
 */

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import TradingChart from '@/components/charts/TradingChart'
import type { IndicatorRow } from '@/services/indicatorData'
import { buildStoryEvents } from '@/services/storyEvents'
import { buildPillars, type LatestRow } from './VerdictHero'

interface CorrState { state: string; color: string; tagline?: string }

interface Props {
  open: boolean
  onClose: () => void
  bars: IndicatorRow[]
  name: string
  latest: LatestRow | null
  snapshot?: { corrState?: CorrState } | null
  bigMoneyDates: Set<string>
}

const SPEEDS = [0.5, 1, 2] as const
const BASE_DWELL_MS = 2600

export default function StoryMode({ open, onClose, bars, name, latest, snapshot, bigMoneyDates }: Props) {
  const events = useMemo(() => buildStoryEvents(bars, bigMoneyDates), [bars, bigMoneyDates])
  const pillars = useMemo(() => (latest ? buildPillars(latest) : []), [latest])
  const alignedCount = pillars.filter((p) => p.aligned).length
  const corr = snapshot?.corrState

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800))

  // Reset to the first event whenever the overlay opens.
  useEffect(() => { if (open) { setIdx(0); setPlaying(false) } }, [open])

  // Viewport height (chart fills the remaining space) + Esc to close.
  useEffect(() => {
    if (!open) return
    const onResize = () => setVh(window.innerHeight)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey) }
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
  const chartH = Math.max(280, vh - 210)
  const storyBubble = cur
    ? { date: cur.date, tone: cur.tone, title: cur.title, detail: cur.detail, reactionPct: cur.reactionPct }
    : null
  const highlightDate = cur ? bars[cur.barIndex]?.trade_date ?? null : null
  const toneColor = (t: string) => (t === 'bull' ? 'var(--risk-green)' : t === 'bear' ? 'var(--risk-red)' : 'var(--text-muted)')

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
      <div className="flex-1 min-h-0 px-3 pt-3">
        <TradingChart
          data={bars}
          workspaceMode
          height={chartH}
          highlightDate={highlightDate}
          storyBubble={storyBubble}
        />
      </div>

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
                background: toneColor(e.tone),
                opacity: i === idx ? 1 : 0.45,
              }}
            />
          ))}
        </div>

        {/* Current caption */}
        <div className="shrink-0 text-right min-w-[180px]">
          {cur ? (
            <>
              <div className="text-xs font-semibold" style={{ color: toneColor(cur.tone) }}>{cur.title}</div>
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
