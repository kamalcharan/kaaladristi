import type { ThemeConfig } from '../types';

// ── Kāla-Drishti / DristiQ (default theme) ──────────────────────────────────
// Dark colors match the dashboard-LOCKED.html mockup :root block.
// Light palette (Phase 3 of the theme audit, 2026-07-07): same navy/indigo/
// gold identity, contrast-corrected for white surfaces — the pale dark-mode
// accents (#818cf8 indigo, #d4a84b gold) fail contrast on white, so light
// mode uses their deeper counterparts.

export const KaalaDrishtiTheme: ThemeConfig = {
  id: 'kaaladristi',
  name: 'DristiQ',
  colors: {
    brand: {
      primary:   '#4f46e5',  // indigo-600 — AA on white (dark uses #818cf8)
      secondary: '#a87e2c',  // deep aged gold — readable on white
      tertiary:  '#7c3aed',  // violet-600
      alternate: '#0891b2',  // cyan-600
    },
    utility: {
      primaryText:         '#0f172a',  // slate-900 — echoes the dark bg family
      secondaryText:       '#334155',  // slate-700
      placeholder:         '#64748b',  // slate-500
      primaryBackground:   '#f4f6fb',  // cool paper with a hint of the navy family
      secondaryBackground: '#ffffff',
    },
    semantic: {
      success: '#059669',  // emerald-600
      warning: '#b45309',  // amber-700 — #f59e0b is unreadable on white
      error:   '#dc2626',  // red-600
      info:    '#0891b2',
    },
    surface: {
      glass:       'rgba(255, 255, 255, 0.92)',
      glassStrong: '#eef1f8',
      glassBorder: 'color-mix(in srgb, var(--text-primary) 10%, transparent)',
    },
  },
  darkMode: {
    colors: {
      brand: {
        primary:   '#818cf8',
        secondary: '#d4a84b',
        tertiary:  '#8b5cf6',
        alternate: '#06b6d4',
      },
      utility: {
        primaryText:         '#f1f5f9',
        secondaryText:       '#cbd5e1',
        placeholder:         '#94a3b8',
        primaryBackground:   '#0b1120',
        secondaryBackground: '#131c31',
      },
      semantic: {
        success: '#10b981',
        warning: '#f59e0b',
        error:   '#ef4444',
        info:    '#06b6d4',
      },
      surface: {
        glass:       'rgba(19, 28, 49, 0.95)',
        glassStrong: '#182340',
        glassBorder: 'color-mix(in srgb, var(--text-primary) 7%, transparent)',
      },
    },
  },
};
