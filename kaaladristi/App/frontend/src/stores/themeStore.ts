import { create } from 'zustand'
import { applyThemeById } from '@/config/theme'

const THEME_KEY = 'kd-theme'

export const THEMES = [
  { id: 'kaaladristi', label: 'Kāla-Drishti', dot: '#818cf8' },
  { id: 'tech-ai',     label: 'Tech AI',       dot: '#06d5cd' },
  { id: 'jade-thorn',  label: 'Jade Thorn',    dot: '#3aad7e' },
] as const

export type ThemeId = typeof THEMES[number]['id']

function resolveInitialTheme(): ThemeId {
  const stored = localStorage.getItem(THEME_KEY) as ThemeId | null
  if (stored && THEMES.some(t => t.id === stored)) return stored
  return (import.meta.env.VITE_THEME as ThemeId) ?? 'kaaladristi'
}

interface ThemeState {
  activeTheme: ThemeId
  themes:      typeof THEMES
  setTheme:    (id: ThemeId) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme: resolveInitialTheme(),
  themes:      THEMES,

  setTheme: (id) => {
    localStorage.setItem(THEME_KEY, id)
    applyThemeById(id)
    set({ activeTheme: id })
  },
}))
