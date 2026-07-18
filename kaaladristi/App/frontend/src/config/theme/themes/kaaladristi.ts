import type { ThemeConfig } from '../types';

// ── Vikuna Black ────────────────────────────────────────────────────────────
// Amber-led palette on a blue-slate near-black. Colors are the owner-supplied
// "Vikuna Black" reference design (golden amber accent, deep slate ground);
// dark mode is the exact reference, light mode a warm professional variant.
//
// Kept under `id: 'kaaladristi'` + export `KaalaDrishtiTheme` so the registry
// (index.ts), VITE_THEME default, and the getTheme() fallback keep resolving.
// Only the `surface` block is derived here — the reference omits it, but this
// repo's ThemeColorSet requires it and applyTheme() reads surface.glass /
// glassStrong / glassBorder / primaryDim / primaryGlow / primarySubtle.

export const KaalaDrishtiTheme: ThemeConfig = {
  id: 'kaaladristi',
  name: 'Vikuna Black',
  colors: {
    // Light mode — a warm, professional light variant inspired by the dark palette
    brand: {
      primary:   '#D4911E',  // Warm amber (darkened for light-bg readability)
      // secondary feeds --gold / --gold-soft / --gold-bg (used ~226× across the
      // app as a warm gold accent). The reference used near-black here for
      // "contrast elements", but this repo routes it to the gold tokens, so a
      // real gold is required or every gold accent washes out. Text contrast is
      // unaffected — it comes from utility.primaryText, not brand.secondary.
      secondary: '#9A7B3C',  // Antique gold (readable on the warm-white canvas)
      tertiary:  '#5A6178',  // Muted slate
      alternate: '#F4F3F0',  // Warm off-white surface
    },
    utility: {
      // Warm charcoal ink on warm-ivory paper (owner-calibrated 2026-07-12):
      // ink temperature must match paper temperature or it reads as eye strain.
      primaryText:         '#211d16',  // warm charcoal
      secondaryText:       '#6f6354',  // warm gray-brown
      // Warm-ivory canvas + WHITE cards. The card (secondaryBackground) must be
      // BRIGHTER than the canvas so it lifts off the page; the amber reference
      // had this inverted (near-white canvas over gray cards → cards sank in),
      // which read as flat/monochrome in light. Cards are now the bright layer.
      primaryBackground:   '#eeebe3',  // warm greige canvas — deeper than the
                                       // white cards so they clearly separate
      secondaryBackground: '#ffffff',  // white cards — the bright, raised layer
    },
    accent: {
      accent1: '#D4911E',  // Amber accent
      accent2: '#211d16',  // Dark ink accent
      accent3: '#B0B5C5',  // Light slate
      accent4: '#E8E7E3',  // Warm light border
    },
    semantic: {
      success: '#2ECC71',  // Green
      error:   '#E74C3C',  // Red
      warning: '#F5A623',  // Amber warning
      info:    '#3498DB',  // Blue info
    },
    surface: {
      glass:         'rgba(255,255,255,0.92)',  // near-solid white card (--kd-card)
      glassStrong:   '#ffffff',                 // white elevated
      glassBorder:   '#ded8ca',                 // warm hairline — defined edge
      primaryDim:    'rgba(212,145,30,0.16)',   // amber primary, dim
      primaryGlow:   'rgba(212,145,30,0.28)',   // amber primary, glow
      primarySubtle: 'rgba(154,123,60,0.05)',   // warm gold atmosphere bloom
    },
  },
  darkMode: {
    colors: {
      // Dark mode — exact colors from the reference design
      brand: {
        primary:   '#F5A623',  // --amber: golden amber accent (→ --accent/--indigo)
        // secondary → --gold / --gold-soft / --gold-bg. The reference set this to
        // cream (#E8E6E0) for "contrast elements", but here it drives the gold
        // accent used ~226× app-wide, so it must be an actual gold — a calmer,
        // slightly desaturated one so it reads as secondary to the amber primary.
        secondary: '#C9A24B',  // Warm antique gold (pairs with the amber primary)
        tertiary:  '#3A3F52',  // --faint: subtle borders/dividers
        alternate: '#1C2030',  // --surface2: elevated surface
      },
      utility: {
        primaryText:         '#E8E6E0',  // --text: cream white
        secondaryText:       '#7A8099',  // --muted: muted slate blue
        primaryBackground:   '#0D0F14',  // --bg: deep dark background
        secondaryBackground: '#13161D',  // --surface: card/panel background
      },
      accent: {
        accent1: '#F5A623',  // Amber glow
        accent2: '#E8E6E0',  // Light text accent
        accent3: '#3A3F52',  // Faint/border
        accent4: '#1C2030',  // Elevated surface
      },
      semantic: {
        success: '#2ECC71',  // --green: vibrant green
        error:   '#E74C3C',  // --red: vibrant red
        warning: '#F5A623',  // Amber warning
        info:    '#3498DB',  // Blue info
      },
      surface: {
        glass:         'rgba(255,255,255,0.04)',  // translucent card overlay
        glassStrong:   'rgba(255,255,255,0.08)',  // elevated overlay
        glassBorder:   'rgba(255,255,255,0.10)',  // hairline
        primaryDim:    'rgba(245,166,35,0.22)',   // amber primary, dim
        primaryGlow:   'rgba(245,166,35,0.40)',   // amber primary, glow
        primarySubtle: 'rgba(245,166,35,0.08)',   // atmosphere bloom
      },
    },
  },
};
