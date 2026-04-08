// ── Theme system types ──────────────────────────────────────────────────────
//
// ThemeConfig is the canonical definition of a product theme.
// Each theme provides a light-mode `colors` set and an optional `darkMode.colors`
// override.  The active set is chosen at runtime based on prefers-color-scheme.
//
// CSS variable mapping (applyTheme in index.ts):
//   brand.primary     → --accent-indigo  (primary interactive accent)
//   brand.secondary   → --accent-gold    (secondary / highlight accent)
//   brand.tertiary    → --accent-violet  (tertiary accent)
//   brand.alternate   → --accent-cyan    (info / alternate accent, fallback)
//   utility.primaryBackground   → --kd-bg
//   utility.secondaryBackground → (used to derive --kd-card with alpha)
//   utility.primaryText         → --text-primary
//   utility.secondaryText       → --text-secondary
//   utility.placeholder         → --text-muted  (derived if absent)
//   surface.glass       → --kd-card
//   surface.glassStrong → --kd-elevated
//   surface.glassBorder → --kd-border
//   semantic.success    → --risk-green
//   semantic.warning    → --risk-amber
//   semantic.error      → --risk-red
//   semantic.info       → --accent-cyan  (preferred over brand.alternate)

export interface ThemeColorSet {
  brand: {
    primary: string;
    secondary: string;
    tertiary: string;
    alternate: string;
  };
  utility: {
    primaryText: string;
    secondaryText: string;
    /** Muted/placeholder text (--text-muted). Derived from secondaryText if absent. */
    placeholder?: string;
    primaryBackground: string;
    secondaryBackground: string;
    tertiaryBackground?: string;
  };
  accent?: {
    accent1?: string;
    accent2?: string;
    accent3?: string;
    accent4?: string;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info?: string;
  };
  surface: {
    glass: string;
    glassStrong: string;
    glassBorder: string;
    primaryDim?: string;
    primaryGlow?: string;
    primarySubtle?: string;
  };
}

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ThemeColorSet;
  /** If provided, used when prefers-color-scheme: dark */
  darkMode?: {
    colors: ThemeColorSet;
  };
}
