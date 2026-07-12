import { create } from 'zustand'
import { applyTheme, getTheme } from '@/config/theme'

const THEME_KEY = 'kd-theme'
const MODE_KEY = 'kd-theme-mode'

export const THEMES = [
  { id: 'kaaladristi', label: 'Vikuna Black', dot: '#9b8cff' },
  { id: 'tech-ai',     label: 'Tech AI',      dot: '#06d5cd' },
  { id: 'jade-thorn',  label: 'Jade Thorn',   dot: '#3aad7e' },
] as const

export type ThemeId = typeof THEMES[number]['id']
export type ThemeMode = 'dark' | 'light' | 'system'

export const MODES: { id: ThemeMode; label: string; glyph: string }[] = [
  { id: 'dark',   label: 'Dark',   glyph: '☾' },
  { id: 'light',  label: 'Light',  glyph: '☀' },
  { id: 'system', label: 'System', glyph: '◐' },
]

// ── LAUNCH GATE ─────────────────────────────────────────────────────────────
// Light mode is fully built and owner-calibrated (warm ivory + warm charcoal
// ink — see docs/claude/glass-ux-status.md §3) but NOT cleared for release
// (owner decision 2026-07-12: "not confident with light theme, can't release
// it"). This flag hard-locks the app to dark: resolveDark() always returns
// true and the Settings mode toggle is hidden. index.html's FOUC script
// carries its own copy of this flag — keep the two in sync.
// Re-enabling light = flip both flags to true. Nothing else to change.
export const LIGHT_MODE_ENABLED = false

// Themes with no designed light palette yet (their darkMode mirrors colors).
// The mode toggle is disabled for these — honest dark-only, not a broken flip.
// 2026-07-08: Vikuna Black (formerly "DristiQ") adopted the Glass UX & Theme
// Standard reference's real light palette, so it's no longer dark-only. All
// three themes currently ship a designed light mode.
export const DARK_ONLY_THEMES: readonly ThemeId[] = []

export function isDarkOnly(id: ThemeId): boolean {
  return DARK_ONLY_THEMES.includes(id)
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

/** Resolve the effective dark/light for a theme+mode pair. Dark-only themes
 * always resolve dark regardless of the stored mode. */
export function resolveDark(themeId: ThemeId, mode: ThemeMode): boolean {
  if (!LIGHT_MODE_ENABLED) return true
  if (isDarkOnly(themeId)) return true
  if (mode === 'system') return systemPrefersDark()
  return mode === 'dark'
}

function applyResolved(themeId: ThemeId, mode: ThemeMode): void {
  const dark = resolveDark(themeId, mode)
  applyTheme(getTheme(themeId), dark)
  // data-mode lets CSS target the resolved mode (e.g. [data-mode="light"] img filters)
  document.documentElement.dataset.mode = dark ? 'dark' : 'light'
}

function resolveInitialTheme(): ThemeId {
  const stored = localStorage.getItem(THEME_KEY) as ThemeId | null
  if (stored && THEMES.some(t => t.id === stored)) return stored
  return (import.meta.env.VITE_THEME as ThemeId) ?? 'kaaladristi'
}

function resolveInitialMode(): ThemeMode {
  const stored = localStorage.getItem(MODE_KEY) as ThemeMode | null
  if (stored && MODES.some(m => m.id === stored)) return stored
  return 'dark'
}

interface ThemeState {
  activeTheme: ThemeId
  mode:        ThemeMode
  themes:      typeof THEMES
  setTheme:    (id: ThemeId) => void
  setMode:     (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeTheme: resolveInitialTheme(),
  mode:        resolveInitialMode(),
  themes:      THEMES,

  setTheme: (id) => {
    localStorage.setItem(THEME_KEY, id)
    applyResolved(id, get().mode)
    set({ activeTheme: id })
  },

  setMode: (mode) => {
    localStorage.setItem(MODE_KEY, mode)
    applyResolved(get().activeTheme, mode)
    set({ mode })
  },
}))

/** Apply the persisted theme+mode before React mounts — no flash of default. */
export function initTheme(): void {
  const { activeTheme, mode } = useThemeStore.getState()
  applyResolved(activeTheme, mode)
}

// mode === 'system': follow OS changes live
window.matchMedia?.('(prefers-color-scheme: dark)')
  .addEventListener?.('change', () => {
    const { activeTheme, mode } = useThemeStore.getState()
    if (mode === 'system') applyResolved(activeTheme, mode)
  })
