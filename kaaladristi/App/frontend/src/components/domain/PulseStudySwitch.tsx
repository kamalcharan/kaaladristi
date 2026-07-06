/**
 * PulseStudySwitch — the two-layer contract made visible (POA Phase 0).
 *
 * Pulse  = Decision Layer: 4–5 second curated verdict, never configurable.
 * Study  = Study Layer: open-ended evidence — catalog overlays, zoom,
 *          timeframes live ONLY here; it gives no verdicts.
 *
 * One segmented control on every stock surface; switching navigates between
 * the two layers preserving the instrument. The vocabulary does the teaching.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

interface PulseStudySwitchProps {
  active: 'pulse' | 'study';
  type: 'index' | 'equity';
  id: number;
  /** Optional display name, forwarded to the study route's ?name= param. */
  name?: string;
}

export default function PulseStudySwitch({ active, type, id, name }: PulseStudySwitchProps) {
  const navigate = useNavigate();

  const go = (layer: 'pulse' | 'study') => {
    if (layer === active) return;
    if (layer === 'pulse') {
      navigate(type === 'equity' ? `/pulse/equity/${id}` : `/pulse/${id}`);
    } else {
      const q = name ? `?name=${encodeURIComponent(name)}` : '';
      navigate(`/chart/${type}/${id}${q}`);
    }
  };

  const btn = (layer: 'pulse' | 'study', label: string, title: string) => {
    const isActive = layer === active;
    return (
      <button
        key={layer}
        onClick={() => go(layer)}
        title={title}
        style={{
          ...MONO,
          padding: '3px 12px',
          borderRadius: 100,
          border: 'none',
          cursor: isActive ? 'default' : 'pointer',
          fontSize: 10,
          fontWeight: isActive ? 700 : 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 100,
        border: '1px solid var(--border)',
        background: 'var(--card)',
        flexShrink: 0,
      }}
    >
      {btn('pulse', 'Pulse', 'The 5-second verdict — curated, same for everyone')}
      {btn('study', 'Study', 'Verify and explore — your overlays, timeframes, zoom')}
    </span>
  );
}

// ── One-time coach mark (POA Phase 0.4) ────────────────────────────────────
// Shown on Pulse pages until dismissed — same pattern as ScanStartHereHint.

const HINT_KEY = 'kd_pulse_study_hint_dismissed';

export function PulseStudyHint() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(HINT_KEY) === 'true'; } catch { return true; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(HINT_KEY, 'true'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 8px',
        padding: '7px 12px', borderRadius: 8,
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text-primary)' }}>Pulse</strong> gives the 5-second verdict —{' '}
        <strong style={{ color: 'var(--text-primary)' }}>Study</strong> is where you verify it with
        your own overlays and timeframes. Switch anytime with the control above.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ fontSize: 13, background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}
