import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PulseBar, CorrelationState } from '@/services/visualPulseEngine';
import { fmtDate } from '@/lib/dateUtils';

/**
 * TimelineSlider — play/pause/scrub with chapter marks.
 * Keyboard: Arrow Left/Right, Space to play/pause.
 */

interface TimelineSliderProps {
  total: number;
  activeIndex: number;
  bars: PulseBar[];
  corrHistory: CorrelationState[];
  onChange: (index: number) => void;
}

// Auto-detect chapter marks from correlation state transitions
function detectChapters(corrHistory: CorrelationState[]): { idx: number; label: string; color: string }[] {
  if (corrHistory.length === 0) return [];
  const chapters: { idx: number; label: string; color: string }[] = [];
  let lastState = '';

  corrHistory.forEach((c, i) => {
    if (c.state !== lastState) {
      chapters.push({ idx: i, label: c.state, color: c.color });
      lastState = c.state;
    }
  });

  // Always include "Now" at end
  const last = corrHistory[corrHistory.length - 1];
  if (chapters.length === 0 || chapters[chapters.length - 1].idx !== corrHistory.length - 1) {
    chapters.push({ idx: corrHistory.length - 1, label: 'Now', color: last?.color ?? 'var(--accent-gold)' });
  }

  return chapters;
}

export default function TimelineSlider({ total, activeIndex, bars, corrHistory, onChange }: TimelineSliderProps) {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const max = total - 1;

  const chapters = detectChapters(corrHistory);
  const pct = max > 0 ? (activeIndex / max) * 100 : 0;

  // Play/pause logic
  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        onChange(Math.min(max, activeIndex + 1));
      }, 500);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, activeIndex, max, onChange]);

  // Auto-stop at end
  useEffect(() => {
    if (activeIndex >= max && playing) setPlaying(false);
  }, [activeIndex, max, playing]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0, activeIndex - 1)); }
      if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(max, activeIndex + 1)); }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIndex, max, onChange, togglePlay]);

  // Date display
  const activeBar = bars[activeIndex];
  const dateStr = fmtDate(activeBar?.trade_date);
  const isNow = activeIndex === max;

  const btnStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--kd-border)',
    background: 'var(--kd-surface)', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 12, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  };

  const playBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: playing ? 'var(--accent-gold)' : 'var(--kd-surface)',
    color: playing ? 'var(--kd-bg)' : 'var(--accent-gold)',
    borderColor: 'var(--accent-gold)',
  };

  return (
    <div style={{
      height: 58, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px',
      background: 'var(--kd-surface)',
      borderTop: '1px solid var(--kd-border)',
    }}>
      {/* Control buttons */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button style={btnStyle} onClick={() => onChange(0)} title="Start">{'\u23EE'}</button>
        <button style={btnStyle} onClick={() => onChange(Math.max(0, activeIndex - 1))} title="Back">{'\u25C0'}</button>
        <button style={playBtnStyle} onClick={togglePlay} title="Play/Pause">
          {playing ? '\u23F8' : '\u25B6'}
        </button>
        <button style={btnStyle} onClick={() => onChange(Math.min(max, activeIndex + 1))} title="Forward">{'\u25B6\u007C'}</button>
        <button style={btnStyle} onClick={() => onChange(max)} title="End">{'\u23ED'}</button>
      </div>

      {/* Slider track */}
      <div style={{ flex: 1, position: 'relative', height: 40 }}>
        {/* Chapter marks */}
        {/* Color ticks only — the per-transition text labels overlapped into
            an unreadable smear on long histories (VP layout pass 2026-07-06).
            State name + date live in the hover tooltip. */}
        <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 12 }}>
          {chapters.map((ch, i) => (
            <div
              key={i}
              onClick={() => onChange(ch.idx)}
              title={`${ch.label} · ${fmtDate(bars[ch.idx]?.trade_date)}`}
              style={{
                position: 'absolute',
                left: `${max > 0 ? (ch.idx / max) * 100 : 0}%`,
                transform: 'translateX(-50%)',
                cursor: 'pointer',
                width: 10, height: 12,
                display: 'flex', justifyContent: 'center',
              }}
            >
              <div style={{
                width: 2, height: 10, background: ch.color, borderRadius: 1,
              }} />
            </div>
          ))}
        </div>

        {/* Range input */}
        <input
          type="range"
          min={0}
          max={max}
          value={activeIndex}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          style={{
            position: 'absolute', bottom: 4, left: 0, width: '100%',
            height: 4, appearance: 'none', WebkitAppearance: 'none',
            background: `linear-gradient(to right, var(--accent-gold) ${pct}%, var(--kd-border) ${pct}%)`,
            borderRadius: 2, outline: 'none', cursor: 'pointer',
          }}
        />
      </div>

      {/* Meta */}
      <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)',
        }}>{dateStr}</div>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
          color: isNow ? 'var(--accent-gold)' : 'var(--text-muted)',
        }}>
          {isNow ? 'NOW' : `\u2212${max - activeIndex} bars`}
        </div>
      </div>
    </div>
  );
}
