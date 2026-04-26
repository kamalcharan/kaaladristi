import type { ThemeConfig } from '../types';

// ── Kāla-Drishti (default dark theme) ──────────────────────────────────────
// Colors match the dashboard-LOCKED.html mockup :root block.

export const KaalaDrishtiTheme: ThemeConfig = {
  id: 'kaaladristi',
  name: 'DristiQ',
  colors: {
    brand: {
      primary:   '#818cf8',  // --indigo (was #6366f1)
      secondary: '#d4a84b',  // --gold   (was #fbbf24)
      tertiary:  '#8b5cf6',  // --accent-violet (unchanged)
      alternate: '#06b6d4',  // --accent-cyan   (unchanged)
    },
    utility: {
      primaryText:         '#f1f5f9',  // --text-primary  (was #f8fafc)
      secondaryText:       '#cbd5e1',  // --text-secondary (was #94a3b8)
      placeholder:         '#94a3b8',  // --text-muted    (was #64748b)
      primaryBackground:   '#0b1120',  // --bg            (was #030712)
      secondaryBackground: '#131c31',  // --card          (was #0f172a)
    },
    semantic: {
      success: '#10b981',  // --bull    (unchanged)
      warning: '#f59e0b',  // --caution (unchanged)
      error:   '#ef4444',  // --bear    (unchanged)
      info:    '#06b6d4',  // --accent-cyan (unchanged)
    },
    surface: {
      glass:       'rgba(19, 28, 49, 0.95)',    // --card
      glassStrong: '#182340',                    // --card-soft
      glassBorder: 'rgba(255, 255, 255, 0.07)', // --border
    },
  },
  // Dark-only theme — darkMode mirrors colors identically
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
        glassBorder: 'rgba(255, 255, 255, 0.07)',
      },
    },
  },
};
