import { create } from 'zustand'
import { applyThemeById } from '@/config/theme'

const THEME_KEY   = 'kd-theme'
const DARK_KEY    = 'kd-dark-mode'

export const THEMES = [
  { id: 'kaaladristi', label: 'Kāla-Drishti', dot: '#818cf8', forceDark: true  },
  { id: 'tech-ai',     label: 'Tech AI',       dot: '#06d5cd', forceDark: false },
  { id: 'jade-thorn',  label: 'Jade Thorn',    dot: '#3aad7e', forceDark: false },
] as const

export type ThemeId = typeof THEMES[number]['id']

function resolveInitialTheme(): ThemeId {
  const stored = localStorage.getItem(THEME_KEY) as ThemeId | null
  if (stored && THEMES.some(t => t.id === stored)) return stored
  return (import.meta.env.VITE_THEME as ThemeId) ?? 'kaaladristi'
}

function resolveInitialDark(): boolean {
  const stored = localStorage.getItem(DARK_KEY)
  if (stored !== null) return stored === 'true'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

interface ThemeState {
  activeTheme: ThemeId
  darkMode:    boolean
  themes:      typeof THEMES
  setTheme:    (id: ThemeId, darkMode?: boolean) => void
  setDarkMode: (dark: boolean) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeTheme: resolveInitialTheme(),
  darkMode:    resolveInitialDark(),
  themes:      THEMES,

  setTheme: (id, dark) => {
    const darkMode = dark ?? get().darkMode
    localStorage.setItem(THEME_KEY, id)
    applyThemeById(id, darkMode)
    set({ activeTheme: id, darkMode })
  },

  setDarkMode: (dark) => {
    localStorage.setItem(DARK_KEY, String(dark))
    applyThemeById(get().activeTheme, dark)
    set({ darkMode: dark })
  },
}))
