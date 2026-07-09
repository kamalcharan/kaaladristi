/**
 * SignalFlipCard — one card per signal that flips between its rich Widget and a
 * plain Chart of the same data, so a signal is never shown twice. Defaults to
 * Widget (owner decision 2026-07-09). A min-height keeps the flip from jumping
 * the layout.
 */

import { useState } from 'react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

interface SignalFlipCardProps {
  title: string;
  widget: React.ReactNode;
  chart: React.ReactNode;
  defaultView?: 'widget' | 'chart';
  /** min height so switching Widget⇄Chart doesn't jump the rail */
  minHeight?: number;
}

export default function SignalFlipCard({
  title, widget, chart, defaultView = 'widget', minHeight = 150,
}: SignalFlipCardProps) {
  const [view, setView] = useState<'widget' | 'chart'>(defaultView);

  const tab = (v: 'widget' | 'chart', label: string) => {
    const active = v === view;
    return (
      <button
        onClick={() => setView(v)}
        style={{
          ...MONO,
          padding: '2px 9px',
          borderRadius: 100,
          border: 'none',
          cursor: active ? 'default' : 'pointer',
          fontSize: 9,
          fontWeight: active ? 700 : 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: active ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : 'transparent',
          color: active ? 'var(--text-primary)' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          {title}
        </span>
        <span
          className="ml-auto inline-flex gap-1 p-0.5 rounded-full border border-kd-border"
          style={{ background: 'var(--card)' }}
        >
          {tab('widget', 'Widget')}
          {tab('chart', 'Chart')}
        </span>
      </div>
      <div style={{ minHeight }}>
        {view === 'widget' ? widget : chart}
      </div>
    </div>
  );
}
