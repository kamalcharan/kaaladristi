/**
 * VaNi companion panel — the open/closed preference.
 *
 * Constants-first: never write the mode strings or the storage key inline.
 * There is exactly ONE stored value. The collapse control on the panel and the
 * "Always open / Always closed" switch in Account → Appearance write the same
 * key, the same way `kd_sidebar_collapsed` already works for the nav rail — so
 * a collapse made on a crowded scanner is still in force on the next page and
 * after a reload, and the switch is that same choice made explicitly.
 */
export const VANI_PANEL_STORAGE_KEY = 'kd_vani_panel'

export const VANI_PANEL_MODES = [
  { id: 'open',   label: 'Always open',   hint: 'VaNi sits beside every research page.' },
  { id: 'closed', label: 'Always closed', hint: 'Pages take the full width. VaNi waits on a rail, one click away.' },
] as const

export type VaNiPanelMode = typeof VANI_PANEL_MODES[number]['id']

/** Opening on the companion is the shipped behaviour — the default must not
 *  silently change what existing users see. */
export const VANI_PANEL_DEFAULT: VaNiPanelMode = 'open'

export function isVaNiPanelMode(value: unknown): value is VaNiPanelMode {
  return value === 'open' || value === 'closed'
}
