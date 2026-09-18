import { PanelLeftClose } from 'lucide-react'
import { useVaNiPanelStore } from '@/stores/vaniPanelStore'

/**
 * Collapse the companion.
 *
 * One implementation, six panels: `VaNiBrand` renders this in every companion
 * header (Market Structure, both Sector Rotation modes, the sector detail
 * companion, the scanner Studios and Flower Pot), and the docked Workspace
 * pane renders it where its close button used to be suppressed. No page
 * carries its own copy — the scanners already paid for two implementations of
 * one rule once.
 */
export default function VaNiPanelToggle({ className = '' }: { className?: string }) {
  const toggle = useVaNiPanelStore(state => state.toggle)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Hide VaNi"
      title="Hide VaNi — this page takes the full width"
      className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)] ${className}`}
    >
      <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
