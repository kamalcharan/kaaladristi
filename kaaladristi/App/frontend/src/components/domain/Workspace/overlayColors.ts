import { INDICATOR_DEFAULT_COLORS } from '@/constants/catalogItems'

/** Per-item defaults — catalog is the single source of truth */
export const ITEM_DEFAULT_COLOR = INDICATOR_DEFAULT_COLORS

/** Fallback by overlay type (astro rules, unknown indicators) */
export const TYPE_DEFAULT_COLOR: Record<string, string> = {
  astro_zone:     '#c9a84c',
  astro_marker:   '#c9a84c',
  indicator_line: '#7c6af7',
  indicator_band: '#7c6af7',
}

export function effectiveDotColor(
  overlayId: string,
  overlayType: string,
  savedColor?: string,
): string {
  return savedColor ?? ITEM_DEFAULT_COLOR[overlayId] ?? TYPE_DEFAULT_COLOR[overlayType] ?? '#7c6af7'
}
