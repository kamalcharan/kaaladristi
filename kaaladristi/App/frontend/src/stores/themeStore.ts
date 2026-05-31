import { create } from 'zustand'
import { applyThemeById } from '@/config/theme'

const STORAGE_KEY = 'kd-theme'

const THEMES = [
  { id: 'kaaladristi', label: 'DristiQ',    dot: '#818cf8' },
  { id: 'tech-ai',     label: 'Tech AI',    dot: '#06d5cd' },
  { id: 'jade-thorn',  label: 'Jade Thorn', dot: '#0f4c3a' },
] as const

export type ThemeId = typeof THEMES[number]['id']

function resolveInitial(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
  if (stored && THEMES.some(t => t.id === stored)) return stored
  return (import.meta.env.VITE_THEME as ThemeId) ?? 'kaaladristi'
}

interface ThemeState {
  activeTheme: ThemeId
  themes: typeof THEMES
  setTheme: (id: ThemeId) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme: resolveInitial(),
  themes: THEMES,
  setTheme: (id) => {
    localStorage.setItem(STORAGE_KEY, id)
    applyThemeById(id)
    set({ activeTheme: id })
  },
}))
