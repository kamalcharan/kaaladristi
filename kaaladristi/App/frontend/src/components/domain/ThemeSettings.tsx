import { useThemeStore, THEMES, type ThemeId } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/auth'
import { useState } from 'react'

export default function ThemeSettings() {
  const { activeTheme, setTheme } = useThemeStore()
  const { profile, setProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
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
    </div>
  )
}
