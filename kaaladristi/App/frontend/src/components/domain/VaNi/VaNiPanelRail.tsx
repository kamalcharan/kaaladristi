import { PanelLeftOpen } from 'lucide-react'
import { VaNiAvatar } from './VaNiBrand'
import { useVaNiPanelStore } from '@/stores/vaniPanelStore'
import '@/styles/sectorResearch.css'

/**
 * The closed state — a rail, never nothing.
 *
 * Removing the panel outright reclaims the width but leaves no way back except
 * Account → Appearance, which is a setting the user would have to already know
 * exists. 52px is the same width the nav rail collapses to, so the page still
 * reads as having two columns.
 */
export default function VaNiPanelRail() {
  const toggle = useVaNiPanelStore(state => state.toggle)
  return (
    <aside className="vani-rail ph-no-capture" aria-label="VaNi companion, hidden">
      <button
        type="button"
        onClick={toggle}
        className="vani-rail-button"
        aria-label="Show VaNi"
        title="Show VaNi beside this page"
      >
        <VaNiAvatar size={26} />
        <span className="vani-rail-label">VaNi</span>
        <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    </aside>
  )
}
