import type { ThemeConfig } from '../types';

// ── Kāla-Drishti (default dark theme) ──────────────────────────────────────
// Dark-only: no separate light-mode variant.
// Colors match the original hardcoded globals.css CSS variables exactly.

export const KaalaDrishtiTheme: ThemeConfig = {
  id: 'kaaladristi',
  name: 'Kāla-Drishti',
  colors: {
    brand: {
      primary:   '#6366f1',  // --accent-indigo
      secondary: '#fbbf24',  // --accent-gold
      tertiary:  '#8b5cf6',  // --accent-violet
      alternate: '#06b6d4',  // --accent-cyan
    },
    utility: {
      primaryText:        '#f8fafc',   // --text-primary
      secondaryText:      '#94a3b8',   // --text-secondary
      placeholder:        '#64748b',   // --text-muted
      primaryBackground:  '#030712',   // --kd-bg
      secondaryBackground: '#0f172a',  // base for card surfaces
    },
    semantic: {
      success: '#10b981',  // --risk-green
      warning: '#f59e0b',  // --risk-amber
      error:   '#ef4444',  // --risk-red
      info:    '#06b6d4',  // --accent-cyan
    },
    surface: {
      glass:       'rgba(15, 23, 42, 0.8)',    // --kd-card
      glassStrong: 'rgba(30, 41, 59, 0.5)',    // --kd-elevated
      glassBorder: 'rgba(255, 255, 255, 0.06)', // --kd-border
    },
  },
  // Dark-only theme — darkMode mirrors colors identically
  darkMode: {
    colors: {
      brand: {
        primary:   '#6366f1',
        secondary: '#fbbf24',
        tertiary:  '#8b5cf6',
        alternate: '#06b6d4',
      },
      utility: {
        primaryText:        '#f8fafc',
        secondaryText:      '#94a3b8',
        placeholder:        '#64748b',
        primaryBackground:  '#030712',
        secondaryBackground: '#0f172a',
      },
      semantic: {
        success: '#10b981',
        warning: '#f59e0b',
        error:   '#ef4444',
        info:    '#06b6d4',
      },
      surface: {
        glass:       'rgba(15, 23, 42, 0.8)',
        glassStrong: 'rgba(30, 41, 59, 0.5)',
        glassBorder: 'rgba(255, 255, 255, 0.06)',
      },
    },
  },
};
