import { useThemeStore, THEMES, MODES, isDarkOnly, type ThemeId, type ThemeMode } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/auth'
import { useState } from 'react'

export default function ThemeSettings() {
  const { activeTheme, mode, setTheme, setMode } = useThemeStore()
  const { profile, setProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const darkOnly = isDarkOnly(activeTheme)
  const activeLabel = THEMES.find(t => t.id === activeTheme)?.label ?? 'This theme'

  async function handleThemeChange(id: ThemeId) {
    setTheme(id)
    if (!profile) return
    setSaving(true)
    try {
      const updated = await updateProfile({ theme: id })
      setProfile({ ...profile, theme: id, ...updated })
    } catch { /* local state already applied */ }
    finally { setSaving(false) }
  }

  async function handleModeChange(id: ThemeMode) {
    setMode(id)
    if (!profile) return
    setSaving(true)
    try {
      const updated = await updateProfile({ mode: id })
      setProfile({ ...profile, mode: id, ...updated })
    } catch { /* local state already applied */ }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 'var(--label-font-size)', fontFamily: 'var(--label-font-family)',
          fontWeight: 'var(--label-font-weight)', letterSpacing: 'var(--label-letter-spacing)',
          textTransform: 'uppercase', color: 'var(--text-faint)',
        }}>
          Theme
        </span>
        {saving && (
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            saving…
          </span>
        )}
      </div>

      {THEMES.map(t => {
        const isActive = t.id === activeTheme
        return (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8,
              background: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
              border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'background .15s, border-color .15s',
            }}
            onClick={() => handleThemeChange(t.id as ThemeId)}
          >
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: t.dot, flexShrink: 0, display: 'inline-block',
              boxShadow: isActive ? `0 0 6px ${t.dot}90` : 'none',
            }} />
            <span style={{
              fontSize: 12, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: isActive ? 500 : 400,
            }}>
              {t.label}
            </span>
          </div>
        )
      })}

      {/* ── Mode (Phase 1 of the theme audit, 2026-07-07) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 10, marginBottom: 4,
      }}>
        <span style={{
          fontSize: 'var(--label-font-size)', fontFamily: 'var(--label-font-family)',
          fontWeight: 'var(--label-font-weight)', letterSpacing: 'var(--label-letter-spacing)',
          textTransform: 'uppercase', color: 'var(--text-faint)',
        }}>
          Mode
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {MODES.map(m => {
          const isActive = !darkOnly ? m.id === mode : m.id === 'dark'
          const disabled = darkOnly && m.id !== 'dark'
          return (
            <button
              key={m.id}
              disabled={disabled}
              onClick={() => !disabled && handleModeChange(m.id)}
              title={disabled ? `${activeLabel} is dark-only for now — light palette coming` : undefined}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 11, fontFamily: 'inherit',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.35 : 1,
                background: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <span style={{ fontSize: 12 }}>{m.glyph}</span>
              {m.label}
            </button>
          )
        })}
      </div>
      {darkOnly && (
        <p style={{ fontSize: 10, color: 'var(--text-faint)', margin: '2px 0 0', lineHeight: 1.5 }}>
          {activeLabel} is dark-only for now — switch to another theme to use light mode.
        </p>
      )}
    </div>
  )
}
