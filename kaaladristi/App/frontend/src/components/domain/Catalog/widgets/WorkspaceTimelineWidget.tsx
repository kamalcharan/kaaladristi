import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceEod } from '@/hooks/useWorkspaceEod'
import { useChartSyncStore } from '@/stores/chartSyncStore'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function detectMonthMarks(dates: string[]): { idx: number; label: string }[] {
  const marks: { idx: number; label: string }[] = []
  let lastMonth = ''
  dates.forEach((date, i) => {
    const ym = date.slice(0, 7) // YYYY-MM
    if (ym !== lastMonth) {
      lastMonth = ym
      const m   = parseInt(date.slice(5, 7)) - 1
      const yr  = date.slice(2, 4)
      // Show year suffix on Jan; skip very first mark if it's at idx 0 (clutters the start)
      const label = m === 0 ? `Jan'${yr}` : MONTH_NAMES[m]
      if (i > 0) marks.push({ idx: i, label })
    }
  })
  return marks
}

const BTN: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 5,
  border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
  background: 'transparent', color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)',
  cursor: 'pointer', fontSize: 11, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', flexShrink: 0,
}

import React from 'react'

export default function WorkspaceTimelineWidget() {
  const { data, isLoading } = useWorkspaceEod()
  const { activeBarIndex, setActiveBarIndex, setPlayerBarIndex } = useChartSyncStore()

  const [playing, setPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = data.length
  const max   = Math.max(0, total - 1)
  const pct   = max > 0 ? (activeBarIndex / max) * 100 : 100

  const dates      = useMemo(() => data.map(b => b.trade_date), [data])
  const monthMarks = useMemo(() => detectMonthMarks(dates), [dates])

  const firstDate = dates[0]    ?? '—'
  const lastDate  = dates[max]  ?? '—'
  const activeDate = dates[activeBarIndex] ?? lastDate
  const isNow      = activeBarIndex >= max

  // Seek: write both activeBarIndex (widgets update) and playerBarIndex (chart scrolls)
  const seek = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(max, idx))
    setActiveBarIndex(clamped)
    setPlayerBarIndex(clamped)
  }, [max, setActiveBarIndex, setPlayerBarIndex])

  // Auto-play
  const togglePlay = useCallback(() => setPlaying(p => !p), [])

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        const next = activeBarIndex + 1
        if (next >= max) {
          setPlaying(false)
          seek(max)
        } else {
          seek(next)
        }
      }, 300)
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, activeBarIndex, max, seek])

  // Keyboard: arrows + space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); seek(activeBarIndex - 1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); seek(activeBarIndex + 1) }
      if (e.key === ' ')          { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeBarIndex, seek, togglePlay])

  if (isLoading || total === 0) {
    return <div style={{ height: 58, display: 'flex', alignItems: 'center',
      padding: '0 16px', opacity: 0.3, fontSize: 11,
      color: 'color-mix(in srgb, var(--text-primary) 30%, transparent)', fontFamily: 'var(--font-mono, monospace)' }}>
      loading timeline…
    </div>
  }

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 14px',
      borderTop: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
    }}>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {[
          { icon: '⏮', title: 'Start',   action: () => seek(0) },
          { icon: '◀',  title: 'Back',    action: () => seek(activeBarIndex - 1) },
          { icon: playing ? '⏸' : '▶', title: 'Play', action: togglePlay, active: playing },
          { icon: '▶|', title: 'Forward', action: () => seek(activeBarIndex + 1) },
          { icon: '⏭', title: 'End',     action: () => seek(max) },
        ].map(({ icon, title, action, active }) => (
          <button key={title} title={title} onClick={action} style={{
            ...BTN,
            ...(active ? {
              background: 'rgba(201,168,76,0.15)',
              color: '#c9a84c',
              borderColor: 'rgba(201,168,76,0.4)',
            } : {}),
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'color-mix(in srgb, var(--text-primary) 90%, transparent)' }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = active ? '#c9a84c' : 'color-mix(in srgb, var(--text-primary) 50%, transparent)'
          }}>
            {icon}
          </button>
        ))}
      </div>

      {/* Timeline track */}
      <div style={{ flex: 1, position: 'relative', height: 40, minWidth: 0 }}>

        {/* Month marks */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, overflow: 'hidden' }}>
          {monthMarks.map(({ idx, label }) => {
            const left = `${(idx / max) * 100}%`
            return (
              <div key={idx} onClick={() => seek(idx)}
                style={{ position: 'absolute', left, transform: 'translateX(-50%)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 7, fontFamily: 'var(--font-mono, monospace)',
                  color: 'color-mix(in srgb, var(--text-primary) 25%, transparent)', whiteSpace: 'nowrap',
                  userSelect: 'none' }}>
                  {label}
                </span>
                <div style={{ width: 1, height: 4, background: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', marginTop: 1 }} />
              </div>
            )
          })}
          {/* Now mark */}
          <div style={{ position: 'absolute', right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 7, fontFamily: 'var(--font-mono, monospace)',
              color: '#c9a84c', whiteSpace: 'nowrap', userSelect: 'none' }}>
              Now
            </span>
            <div style={{ width: 1, height: 4, background: '#c9a84c', marginTop: 1 }} />
          </div>
        </div>

        {/* Scrubber */}
        <input
          type="range" min={0} max={max} value={activeBarIndex}
          onChange={e => seek(parseInt(e.target.value, 10))}
          style={{
            position: 'absolute', bottom: 4, left: 0, width: '100%',
            height: 4, appearance: 'none', WebkitAppearance: 'none',
            background: `linear-gradient(to right, #c9a84c ${pct}%, color-mix(in srgb, var(--text-primary) 8%, transparent) ${pct}%)`,
            borderRadius: 2, outline: 'none', cursor: 'pointer',
          }}
        />
      </div>

      {/* Current date + range meta */}
      <div style={{ width: 100, textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 500,
          fontFamily: 'var(--font-mono, monospace)',
          color: isNow ? '#c9a84c' : 'var(--text-primary)' }}>
          {isNow ? 'NOW' : activeDate}
        </div>
        <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)', marginTop: 1 }}>
          {total} days · {firstDate.slice(0, 7)} → {lastDate.slice(0, 7)}
        </div>
      </div>

    </div>
  )
}
