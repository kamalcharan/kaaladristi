import React from 'react'

/**
 * ScanStatTile — the scanner stat tile.
 *
 * Lived inside views/ScannerStudio.tsx until 2026-09-07, when Flower Pot
 * needed the same tiles on a page that deliberately is NOT a Studio (gap audit
 * §5: its three-phase layout is not to be unified). Two copies of a tile is
 * how two scanners start looking like two products, so it moved here rather
 * than being duplicated or imported across views.
 *
 * `accent` marks a tile that reads a highlight rather than a plain count;
 * `active` marks one whose filter is currently applied.
 */
export default function ScanStatTile({ label, value, sub, accent, active, onClick, title }: {
  label: string; value: string; sub?: string; accent?: 'gold' | 'green'; active?: boolean; onClick?: () => void; title?: string
}) {
  const accentColor = accent === 'gold' ? 'var(--gold)' : accent === 'green' ? 'var(--bull)' : undefined
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      title={title}
      style={{
        background: accent ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, var(--card) 60%)` : 'var(--card)',
        border: `1px solid ${active ? 'var(--accent)' : accent ? `color-mix(in srgb, ${accentColor} 35%, transparent)` : 'var(--border)'}`,
        borderLeft: accent ? `3px solid ${accentColor}` : active ? '3px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 12, padding: '13px 15px', cursor: onClick ? 'pointer' : undefined,
        boxShadow: active ? '0 0 0 1px var(--accent)' : undefined,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.07em', textTransform: 'uppercase', color: accent ? accentColor : active ? 'var(--accent)' : 'var(--text-faint)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        {label}
        {active && <span style={{ color: 'var(--accent)' }}>●</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
        {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>{sub}</span>}
      </div>
    </div>
  )
}
