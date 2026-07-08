// ── Theme registry & application ───────────────────────────────────────────
//
// Usage (main.tsx):
//   import { applyThemeById } from '@/config/theme';
//   applyThemeById(import.meta.env.VITE_THEME ?? 'kaaladristi');
//
// VITE_THEME values: 'kaaladristi' | 'tech-ai' | 'jade-thorn'

import type { ThemeConfig, ThemeColorSet } from './types';
import { KaalaDrishtiTheme } from './themes/kaaladristi';
import { TechAITheme }       from './themes/techAI';
import { JadeThornTheme }    from './themes/jadeThorn';

export type { ThemeConfig, ThemeColorSet };
export { KaalaDrishtiTheme, TechAITheme, JadeThornTheme };

// ── Registry ────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, ThemeConfig> = {
  [KaalaDrishtiTheme.id]: KaalaDrishtiTheme,
  [TechAITheme.id]:       TechAITheme,
  [JadeThornTheme.id]:    JadeThornTheme,
};

export function getTheme(id: string): ThemeConfig {
  return REGISTRY[id] ?? KaalaDrishtiTheme;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a 6-digit hex string to `rgba(r, g, b, alpha)`. */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Derive --text-muted from secondaryText when no explicit placeholder is given.
 * - rgba(…, a)  → reduce alpha by ~40 %
 * - hex          → convert to rgba at 0.60 opacity
 */
function deriveTextMuted(secondaryText: string): string {
  const rgbaRe = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/;
  const m = secondaryText.match(rgbaRe);
  if (m) {
    const a = Math.max(0, parseFloat(m[4]) - 0.25).toFixed(2);
    return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
  }
  if (secondaryText.startsWith('#')) {
    return hexToRgba(secondaryText, 0.60);
  }
  return secondaryText;
}

// ── Core application logic ───────────────────────────────────────────────────

/**
 * Write all theme CSS custom properties onto <html>.
 * Called once at startup before the React tree mounts.
 */
export function applyTheme(config: ThemeConfig, prefersDark: boolean): void {
  const c: ThemeColorSet =
    prefersDark && config.darkMode ? config.darkMode.colors : config.colors;

  const el = document.documentElement;
  const set = (prop: string, val: string | undefined) => {
    if (val !== undefined && val !== '') el.style.setProperty(prop, val);
  };

  // ── Backgrounds ──
  set('--bg',               c.utility.primaryBackground);
  set('--card',             c.utility.secondaryBackground ?? c.utility.primaryBackground);
  set('--card-soft',        c.surface.glassStrong);
  set('--border',           c.surface.glassBorder);
  set('--kd-bg',            c.utility.primaryBackground);
  set('--kd-surface',       c.utility.secondaryBackground ?? c.utility.primaryBackground);
  set('--kd-card',          c.surface.glass);
  set('--kd-elevated',      c.surface.glassStrong);
  set('--kd-border',        c.surface.glassBorder);
  set('--kd-border-active', hexToRgba(
    c.brand.primary.startsWith('#') ? c.brand.primary : '#818cf8', 0.28
  ));

  // ── Text ──
  set('--text-primary',   c.utility.primaryText);
  set('--text-secondary', c.utility.secondaryText);
  set('--text-muted', c.utility.placeholder ?? deriveTextMuted(c.utility.secondaryText));

  // ── Accents — new semantic vars ──
  set('--indigo',        c.brand.primary);
  set('--gold',          c.brand.secondary);
  set('--gold-soft',     c.brand.secondary);   // themes can override with a lighter shade
  set('--bull',          c.semantic.success);
  set('--bear',          c.semantic.error);
  set('--caution',       c.semantic.warning);

  // ── Accents — legacy vars (kept for backward compat) ──
  set('--accent',        c.brand.primary);
  set('--accent-indigo', c.brand.primary);
  set('--accent-violet', c.brand.tertiary);
  set('--accent-gold',   c.brand.secondary);
  set('--accent-cyan', c.semantic.info ?? c.brand.alternate);

  // ── Semantic / risk ──
  set('--risk-green', c.semantic.success);
  set('--risk-amber', c.semantic.warning);
  set('--risk-red',   c.semantic.error);

  // ── Opacity variants — computed from base tokens, never static ──
  set('--bull-bg',    hexToRgba(c.semantic.success, 0.1));
  set('--bear-bg',    hexToRgba(c.semantic.error,   0.1));
  set('--caution-bg', hexToRgba(c.semantic.warning,  0.1));
  set('--gold-bg',    hexToRgba(c.brand.secondary,   0.1));
  set('--bull-dim',   hexToRgba(c.semantic.success, 0.3));
  set('--bear-dim',   hexToRgba(c.semantic.error,   0.3));
  set('--caution-dim',hexToRgba(c.semantic.warning,  0.3));

  // ── Accent opacity variants ──
  set('--accent-dim',   hexToRgba(c.brand.primary, 0.35));
  set('--accent-glow',  hexToRgba(c.brand.primary, 0.15));
  set('--accent-solid', hexToRgba(c.brand.primary, 0.9));

  // ── Ambient decorative layer (Glass UX & Theme Standard §5.5 UxAtmosphere)
  // — reads each theme's own calibrated surface.primarySubtle, not a fresh
  // 10-15% cut off the raw brand hex (that's what --accent-glow/--gold-bg
  // above are for, and other components already depend on those values).
  set('--atmosphere-primary', c.surface.primarySubtle);
  set('--atmosphere-accent',  `color-mix(in srgb, ${c.brand.secondary} 10%, transparent)`);

  // ── Surface aliases ──
  set('--surface-1', c.utility.primaryBackground);
  set('--surface-2', c.utility.secondaryBackground ?? c.utility.primaryBackground);

  // ── Text faint ──
  // A flat 25% of primaryText reads fine in dark mode (light text dimmed
  // over a near-black page still has presence) but is nearly invisible in
  // light mode: 25% of a near-black hex over a white/near-white background
  // blends to ~1.8:1 contrast, well under WCAG's 3:1 floor for any text —
  // this is the systemic "washed out" complaint across the ~64 components
  // that use --text-faint (sidebar footer, PageHeader meta lines, table
  // captions, etc.), not a per-page bug. Light mode uses a much higher
  // alpha (~3:1 for small decorative text) to actually be legible.
  set('--text-faint', hexToRgba(c.utility.primaryText, prefersDark ? 0.25 : 0.45));
}

/**
 * Convenience wrapper: resolve theme by id and apply it.
 * `prefersDark` defaults to true; mode resolution (dark/light/system +
 * dark-only themes) lives in stores/themeStore.ts — prefer initTheme()/
 * setMode() there over calling this directly.
 */
export function applyThemeById(id: string, prefersDark = true): void {
  const config = getTheme(id);
  applyTheme(config, prefersDark);
}
