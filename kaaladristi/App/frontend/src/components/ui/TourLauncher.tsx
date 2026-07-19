// TourLauncher — the "?" chip that replays a page's explainer walk.
// Carries its own data-tour anchor so the walk can end on itself
// ("replay anytime"). Token-only styling (components/ui hard gate).

import { HelpCircle } from 'lucide-react'

interface TourLauncherProps {
  onClick: () => void
  title?: string
}

export default function TourLauncher({ onClick, title = 'Take the tour' }: TourLauncherProps) {
  return (
    <button
      data-tour="tour-launcher"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: 0,
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--accent)'
        e.currentTarget.style.borderColor = 'var(--accent-dim)'
        e.currentTarget.style.background = 'var(--accent-glow)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <HelpCircle size={14} />
    </button>
  )
}
