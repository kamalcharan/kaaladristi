import type { ThemeConfig } from '../types';

// ── Tech AI theme ───────────────────────────────────────────────────────────
// Cyan / teal palette with violet tertiary.
// Light: very subtle cyan-tinted near-white.
// Dark:  deep teal-black with bright cyan accents.

export const TechAITheme: ThemeConfig = {
  id: 'tech-ai',
  name: 'Tech AI',
  colors: {
    brand: {
      primary:   '#06d5cd',
      secondary: '#18aa99',
      tertiary:  '#984bb6',
      alternate: '#d4f6f4',
    },
    utility: {
      primaryText:         '#0e1c1c',
      secondaryText:       '#4a7070',
      primaryBackground:   '#f0f9f8',
      secondaryBackground: '#ffffff',
    },
    accent: {
      accent1: 'rgba(6,213,205,0.15)',
      accent2: 'rgba(24,170,153,0.15)',
      accent3: 'rgba(152,75,182,0.15)',
      accent4: 'rgba(6,213,205,0.08)',
    },
    semantic: {
      success: '#2d8a6a',
      error:   '#b54034',
      warning: '#c47e1a',
      info:    '#2a7abf',
    },
    surface: {
      // Fully opaque, not translucent — a card here sits directly under the
      // top-center ambient bloom (body::before's 900x500 ellipse, strongest
      // right where PageHeader lives). Any partial opacity (originally a
      // never-visible 5% cyan wash, then a 75% white pass) let that bloom
      // bleed through the blur as an uneven tint ("muddy" patches, reported
      // across all 3 themes). Light mode reads as a solid frosted card;
      // true glass/translucency is reserved for dark mode, where the
      // ambient glow is subtle enough not to look dirty underneath it.
      glass:       '#ffffff',
      glassStrong: '#ffffff',
      glassBorder: '#c2eeec',
      primaryDim:    'rgba(6,213,205,0.25)',
      primaryGlow:   'rgba(6,213,205,0.12)',
      primarySubtle: 'rgba(6,213,205,0.05)',
    },
  },
  darkMode: {
    colors: {
      brand: {
        primary:   '#10e8de',
        secondary: '#22c0aa',
        tertiary:  '#b060d0',
        alternate: '#1a3030',
      },
      utility: {
        primaryText:         '#e8fffd',
        secondaryText:       'rgba(232,255,253,0.65)',
        primaryBackground:   '#0a1818',
        secondaryBackground: '#1a3030',
      },
      accent: {
        accent1: 'rgba(16,232,222,0.20)',
        accent2: 'rgba(34,192,170,0.18)',
        accent3: 'rgba(176,96,208,0.18)',
        accent4: 'rgba(16,232,222,0.10)',
      },
      semantic: {
        success: '#4ecb8a',
        error:   '#e05555',
        warning: '#e09030',
        info:    '#10e8de',
      },
      surface: {
        glass:       'rgba(16,232,222,0.07)',
        glassStrong: 'rgba(16,232,222,0.12)',
        glassBorder: 'rgba(16,232,222,0.24)',
        primaryDim:    'rgba(6,213,205,0.38)',
        primaryGlow:   'rgba(6,213,205,0.16)',
        primarySubtle: 'rgba(6,213,205,0.07)',
      },
    },
  },
};
