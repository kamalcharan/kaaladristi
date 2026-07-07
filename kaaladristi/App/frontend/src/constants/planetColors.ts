/**
 * Planet colors — Overlap Visibility Phase 1 (owner POA, 2026-07-07)
 * ====================================================================
 * One fixed, high-contrast color per source planet, used to paint
 * single-day point-event markers on charts so a cluster of coincident
 * events (Mer↑ ♆ B27 Ven↓ …) is readable at a glance. Zones/bands keep
 * their group/user colors — this palette applies to point markers only.
 *
 * Where a planet also has an astro_group overlay color
 * (constants/astroGroupOverlays.ts), the hue matches (Mercury blue,
 * Venus pink); dark hues unusable for 1-px lines (Neptune navy) get a
 * brighter variant here.
 */

export const PLANET_COLORS: Record<string, string> = {
  Sun:     '#FB923C',   // orange
  Moon:    '#E2E8F0',   // light slate
  Mercury: '#3B82F6',   // blue    (matches astro_group:Mercury)
  Venus:   '#EC4899',   // pink    (matches astro_group:Venus)
  Mars:    '#EF4444',   // red
  Jupiter: '#FACC15',   // yellow
  Saturn:  '#94A3B8',   // slate
  Rahu:    '#8B5CF6',   // violet
  Ketu:    '#2DD4BF',   // teal
  Neptune: '#38BDF8',   // sky (bright variant of the navy group color)
  Uranus:  '#67E8F9',   // cyan
  Pluto:   '#D946EF',   // fuchsia
};

// Rule-code tokens → planet. Weekday tokens map to their vaar lord
// (MON=Monday→Moon, SAT in DN codes=Saturday→Saturn) — the same planet
// the day belongs to, so the color stays truthful.
const TOKEN_TO_PLANET: Record<string, string> = {
  SUN: 'Sun',   MON: 'Moon',    MER: 'Mercury', VEN: 'Venus',
  MAR: 'Mars',  JUP: 'Jupiter', SAT: 'Saturn',  RAH: 'Rahu',
  KET: 'Ketu',  NEP: 'Neptune', URA: 'Uranus',  HER: 'Uranus',
  PLU: 'Pluto',
};

/** Source planet of a rule code, from its first planet token
 * (TR-MER-RET → Mercury, BAY-R02-MAR-MER-SPD → Mars, NEP-RET-BEA →
 * Neptune). Returns null when no token matches (e.g. PNK Panchak codes). */
export function planetOfRuleCode(ruleCode: string): string | null {
  for (const token of ruleCode.toUpperCase().split(/[-_]/)) {
    const planet = TOKEN_TO_PLANET[token];
    if (planet) return planet;
  }
  return null;
}

/** Marker color for a rule code — planet color, or null to keep the
 * band's own group/user color as the fallback. */
export function planetColorOfRuleCode(ruleCode: string): string | null {
  const planet = planetOfRuleCode(ruleCode);
  return planet ? PLANET_COLORS[planet] : null;
}
