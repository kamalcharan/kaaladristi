import type { ThemeConfig } from '../types';

// ── Jade Thorn theme ────────────────────────────────────────────────────────
// Deep jade + aged brass palette.
// Light: warm parchment (#f6f4ef) with jade and brass accents.
// Dark:  near-black jade ground (#0a0f0d) with bright jade and brass.

export const JadeThornTheme: ThemeConfig = {
  id: 'jade-thorn',
  name: 'Jade Thorn',
  colors: {
    brand: {
      primary:   '#0f4c3a',  // deep jade
      secondary: '#c7a557',  // aged brass
      tertiary:  '#5a7a6e',  // muted sage bridge
      alternate: '#ecebe4',  // deeper parchment surface
    },
    utility: {
      primaryText:         '#1a1a1a',
      secondaryText:       '#8a8884',
      // Deeper parchment canvas so the white cards clearly separate (matches
      // the "white depth" tuned into Vikuna Black light); stays warm parchment,
      // not greige — keeps Jade Thorn's identity.
      primaryBackground:   '#eeeadd',  // deeper warm parchment canvas
      secondaryBackground: '#ffffff',  // white cards — the bright, raised layer
    },
    accent: {
      accent1: '#0f4c3a',
      accent2: '#c7a557',
      accent3: '#7a4a2a',
      accent4: '#2d6a5a',
    },
    semantic: {
      success: '#2d7a4f',
      error:   '#b54034',
      warning: '#c47e1a',
      info:    '#2a5f8a',
    },
    surface: {
      glass:       'rgba(255,255,255,0.92)', // near-solid white card — crisp on parchment
      glassStrong: '#ffffff',
      glassBorder: '#ddd7c7',                // firmer warm-parchment hairline
      primaryDim:    'rgba(15,76,58,0.25)',
      primaryGlow:   'rgba(15,76,58,0.1)',
      primarySubtle: 'rgba(15,76,58,0.04)',
    },
  },
  darkMode: {
    colors: {
      brand: {
        primary:   '#3aad7e',  // bright jade — legible on near-black
        secondary: '#d4b46a',  // softened brass
        tertiary:  '#5a9a7a',
        alternate: '#1a2e22',
      },
      utility: {
        primaryText:         '#f4f1e9',              // warm cream
        secondaryText:       'rgba(244,241,233,0.68)',
        primaryBackground:   '#0a0f0d',
        secondaryBackground: '#1a2e22',
      },
      accent: {
        accent1: '#3aad7e',
        accent2: '#d4b46a',
        accent3: '#c47848',
        accent4: '#42a882',
      },
      semantic: {
        success: '#4ecb8a',
        error:   '#e05555',
        warning: '#e0a040',
        info:    '#4a8fc4',
      },
      surface: {
        glass:       'rgba(58,173,126,0.07)',
        glassStrong: 'rgba(58,173,126,0.13)',
        glassBorder: 'rgba(58,173,126,0.24)',
        primaryDim:    'rgba(58,173,126,0.36)',
        primaryGlow:   'rgba(58,173,126,0.16)',
        primarySubtle: 'rgba(58,173,126,0.07)',
      },
    },
  },
};
