import type { ThemeConfig } from '../types';

// ── Vikuna Black (formerly "DristiQ") ───────────────────────────────────────
// Vikuna house palette — deep violet primary + brass secondary. Values taken
// from the Glass UX & Theme Standard reference ('vikuna-black' theme, both
// light and dark), mapped onto ThemeColorSet and extended with tertiary/
// alternate/accent/semantic fields to match this repo's per-theme convention
// (see jadeThorn.ts / techAI.ts for the same derivation pattern).

export const KaalaDrishtiTheme: ThemeConfig = {
  id: 'kaaladristi',
  name: 'Vikuna Black',
  colors: {
    brand: {
      primary:   '#5b3fb0',  // --color-primary (light)
      secondary: '#9a7b3c',  // --color-accent  (light)
      tertiary:  '#7454b8',  // indigo-violet bridge
      alternate: '#eeecf7',  // deeper violet-white surface
    },
    utility: {
      primaryText:         '#191627',  // --color-fg
      secondaryText:       '#645f7c',  // --color-muted
      // Warm-ivory light canvas (owner pick "D", 2026-07-12): light mode
      // commits to ONE temperature — the ProKey warm-ivory feel — instead of
      // a cool violet base fighting warm gold blooms (the "muddy" clash).
      primaryBackground:   '#f7f5f0',  // --color-bg — warm ivory
      secondaryBackground: '#fdfcfa',  // --color-surface-2 — warm white
    },
    accent: {
      accent1: '#5b3fb0',
      accent2: '#9a7b3c',
      accent3: '#7454b8',
      accent4: 'rgba(91,63,176,0.08)',
    },
    semantic: {
      success: '#2d7a4f',
      warning: '#c47e1a',
      error:   '#b54034',
      info:    '#3f6bb0',
    },
    surface: {
      glass:         'rgba(255,255,255,0.75)', // --color-surface (light) — Glass UX standard's literal value
      glassStrong:   '#fdfcfa',                 // --color-surface-2 (light) — warm white
      glassBorder:   '#e7e2d8',            // --color-border (light) — warm hairline
      primaryDim:    'rgba(91,63,176,.16)', // --color-primary-dim (light)
      primaryGlow:   'rgba(91,63,176,.28)', // --color-primary-glow (light)
      // Warm gold atmosphere bloom (feeds --atmosphere-primary) — the canvas
      // wash matches the ivory temperature; violet stays interactive-only.
      primarySubtle: 'rgba(154,123,60,.05)',
    },
  },
  darkMode: {
    colors: {
      brand: {
        primary:   '#9b8cff',  // --color-primary (dark)
        secondary: '#c9b28c',  // --color-accent  (dark)
        tertiary:  '#6f5fc4',  // indigo-violet bridge
        alternate: '#191626',  // deep violet-black surface (= secondaryBackground)
      },
      utility: {
        primaryText:         '#ece9f5',  // --color-fg (dark)
        secondaryText:       '#948fb0',  // --color-muted (dark)
        primaryBackground:   '#0b0b12',  // --color-bg (dark)
        secondaryBackground: '#191626',  // solid card — violet-tinted elevation of bg
      },
      accent: {
        accent1: '#9b8cff',
        accent2: '#c9b28c',
        accent3: '#6f5fc4',
        accent4: 'rgba(155,140,255,0.10)',
      },
      semantic: {
        success: '#4ecb8a',
        warning: '#e0a040',
        error:   '#e05555',
        info:    '#5a8fd6',
      },
      surface: {
        glass:         'rgba(255,255,255,0.04)', // --color-surface (dark)
        glassStrong:   'rgba(255,255,255,0.08)', // --color-surface-2 (dark)
        glassBorder:   'rgba(255,255,255,0.1)',  // --color-border (dark)
        primaryDim:    'rgba(155,140,255,.22)',   // --color-primary-dim (dark)
        primaryGlow:   'rgba(155,140,255,.4)',    // --color-primary-glow (dark)
        primarySubtle: 'rgba(155,140,255,.08)',   // --color-primary-subtle (dark)
      },
    },
  },
};
