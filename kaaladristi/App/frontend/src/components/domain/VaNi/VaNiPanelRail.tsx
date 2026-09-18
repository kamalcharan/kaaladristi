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
 *
 * The three ascending bars are a signal-strength/"live" indicator: closed does
 * not mean off, and a static chevron reads as a layout control rather than a
 * companion waiting to be asked. They animate in sequence on the theme accent,
 * so the rail is the one place on a collapsed page carrying the theme's colour
 * — that is what makes it read as a presence rather than a divider.
 *
 * Following `vani-consulting`: the motion lives on the bars, never on VaNi's
 * face, and `prefers-reduced-motion` stops it entirely rather than speeding it
 * up (the bars then sit at full strength, which is the honest resting state).
 */
export default function VaNiPanelRail() {
  const toggle = useVaNiPanelStore(state => state.toggle)
  return (
    <aside className="vani-rail ph-no-capture" aria-label="VaNi companion, hidden">
      <button
        type="button"
        onClick={toggle}
        className="vani-rail-button"
        aria-label="Show VaNi — live"
        title="VaNi is live — open it beside this page"
      >
        <VaNiAvatar size={26} />
        <span className="vani-rail-signal" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="vani-rail-label">VaNi</span>
        <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    </aside>
  )
}
