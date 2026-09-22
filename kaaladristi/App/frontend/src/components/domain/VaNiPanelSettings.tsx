import { VANI_PANEL_MODES, type VaNiPanelMode } from '@/constants/vaniPanel'
import { useVaNiPanelStore } from '@/stores/vaniPanelStore'

/**
 * "Always open / Always closed" for the VaNi companion.
 *
 * The same stored value the collapse control on the panel writes — this is
 * that choice made explicitly, not a second preference. Kept next to Theme
 * because both answer "how do I want this to look", and both are remembered.
 */
export default function VaNiPanelSettings() {
  const mode = useVaNiPanelStore(state => state.mode)
  const setMode = useVaNiPanelStore(state => state.setMode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 }}>
      <div style={{ marginBottom: 4 }}>
        <span style={{
          fontSize: 'var(--label-font-size)', fontFamily: 'var(--label-font-family)',
          fontWeight: 'var(--label-font-weight)', letterSpacing: 'var(--label-letter-spacing)',
          textTransform: 'uppercase', color: 'var(--text-faint)',
        }}>
          VaNi companion
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {VANI_PANEL_MODES.map(option => {
          const isActive = option.id === mode
          return (
            <button
              key={option.id}
              onClick={() => setMode(option.id as VaNiPanelMode)}
              aria-pressed={isActive}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                background: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'background .15s, border-color .15s',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 0', lineHeight: 1.5 }}>
        {VANI_PANEL_MODES.find(option => option.id === mode)?.hint}
      </p>
    </div>
  )
}
