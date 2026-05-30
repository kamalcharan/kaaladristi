/** Per-item defaults — must match OVERLAY_DEFAULT_COLOR in TradingChart exactly */
export const ITEM_DEFAULT_COLOR: Record<string, string> = {
  'ema_20':     '#FFD700',
  'ema_60':     '#FFA500',
  'sma_50':     '#FF6347',
  'sma_150':    '#00CED1',
  'sma_200':    '#DA70D6',
  'supertrend': '#10b981',
}

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
