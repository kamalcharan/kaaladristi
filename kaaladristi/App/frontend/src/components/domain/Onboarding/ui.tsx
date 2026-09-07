// Small shared pieces for the setup wizard's agentic screens. Tokens only —
// the theme literal ratchet forbids new hex/rgba in src/.
import type React from 'react'

export const MONO = 'var(--font-mono, monospace)'
export const VANI_GRADIENT = 'linear-gradient(135deg, var(--accent), var(--accent-solid))'

export function VaniDot({ size = 22 }: { size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `radial-gradient(circle at 35% 35%, var(--accent), var(--accent-solid))`,
      animation: 'badge-pulse 2.5s ease-in-out infinite' }} />
  )
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
      color: 'var(--text-muted)', marginBottom: 10, ...style }}>{children}</div>
  )
}

export function Question({ n, text, sub }: { n: number; text: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--accent)' }}>0{n}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 19,
          color: 'var(--gold)', letterSpacing: '-0.01em' }}>{text}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginLeft: 30 }}>{sub}</div>}
    </div>
  )
}

export function Chip({ active, onClick, children, title, style }: {
  active: boolean; onClick: () => void; children: React.ReactNode; title?: string; style?: React.CSSProperties
}) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={active}
      style={{ padding: '9px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all .15s ease',
        background: active ? 'var(--accent-dim)' : 'var(--card)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? 'var(--accent)' : 'var(--text-primary)', ...style }}>
      {children}
    </button>
  )
}

export function PrimaryButton({ onClick, disabled, children, style }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ padding: '12px 24px', border: 'none', borderRadius: 100, fontFamily: 'inherit',
        fontSize: 14, fontWeight: 500, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
        background: VANI_GRADIENT, opacity: disabled ? .5 : 1, transition: 'all .2s ease', ...style }}>
      {children}
    </button>
  )
}

export function GhostButton({ onClick, children, style }: { onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '12px 18px', background: 'transparent', border: '1px solid var(--border)',
        borderRadius: 100, fontFamily: 'inherit', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', ...style }}>
      {children}
    </button>
  )
}

/** Bottom action island shared by the wizard's scrolling screens. */
export function ActionIsland({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    // Centered with auto margins, not translateX — the bubble-in keyframe ends
    // on `transform: none`, which would cancel a transform-based centering.
    <div style={{ position: 'fixed', bottom: 16, left: 12, right: 12, margin: '0 auto',
      background: 'var(--bg)', border: '1px solid var(--accent-dim)', borderRadius: 28,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
      backdropFilter: 'blur(20px)', zIndex: 200, width: 'min(560px, 100%)', boxSizing: 'border-box',
      boxShadow: '0 8px 32px color-mix(in srgb, var(--bg) 70%, transparent)', animation: 'bubble-in .4s ease .3s both' }}>
      <VaniDot />
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0, lineHeight: 1.4 }}>{text}</span>
      {children}
    </div>
  )
}

export const fmtInr = (v: number | null | undefined) =>
  v == null ? '—' : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: v >= 1000 ? 0 : 2 })}`
