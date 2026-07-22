// Virtual "group" overlay items — each adds an ENTIRE tag's range rules to the
// chart as ONE overlay layer (one pill), instead of N individual rule overlays.
//
// A group overlay is stored exactly like any other ChartOverlay, differentiated
// only by its `astro_group:` id prefix. astroOverlayService.fetchAstroBands()
// expands the prefix at render time into all range rules carrying the tag.
//
// These are NOT in catalogItems.ts (which is the static indicator/widget registry)
// — they are a distinct, astro-only construct.

import type { CatalogItem } from './catalogItems'

/** Id prefix that marks a ChartOverlay as a virtual group overlay. */
export const ASTRO_GROUP_PREFIX = 'astro_group:'

/**
 * Launch scope — which astro group overlays are live for users right now.
 * We ship one planet slice at a time (Mercury first) so the astro layer is
 * provably correct end-to-end before the next group is turned on. Add a tag
 * here (e.g. 'Venus') the moment that slice's rules are catalog_visible and
 * its windows/confidence are verified. Empty check + this allowlist together
 * gate the Group Overlays pill row in CatalogAstroSection.
 */
export const LAUNCH_ACTIVE_GROUP_TAGS: string[] = ['Mercury']

/** A group overlay is a CatalogItem (so it flows through addOverlay) + its source tag. */
export interface AstroGroupOverlay extends CatalogItem {
  tag: string
}

export const ASTRO_GROUP_OVERLAYS: AstroGroupOverlay[] = [
  {
    id: 'astro_group:Panchak',
    display_name: 'Panchak',
    tag: 'Panchak',
    color: '#6366F1',          // indigo
    description: 'All Panchak windows — 5-day lunar zone',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
  {
    id: 'astro_group:Mercury',
    display_name: 'Mercury',
    tag: 'Mercury',
    color: '#3B82F6',          // blue
    description: 'All Mercury transit rules as a single overlay layer',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
  {
    id: 'astro_group:Venus',
    display_name: 'Venus',
    tag: 'Venus',
    color: '#EC4899',          // pink
    description: 'All Venus transit rules as a single overlay layer',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
  {
    id: 'astro_group:Bayer',
    display_name: 'Bayer Rules',
    tag: 'Bayer',
    color: '#F59E0B',          // amber
    description: 'George Bayer astro-trading rules as overlay zones',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
  {
    id: 'astro_group:MajorTransit',
    display_name: 'Major Transits',
    tag: 'MajorTransit',
    color: '#EF4444',          // rose
    description: 'All major planetary transit windows combined',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
  {
    id: 'astro_group:Gandanta',
    display_name: 'Mars Gandanta',
    tag: 'Gandanta',
    color: '#991B1B',          // red-800
    description: 'Mars Gandanta zones — water/fire sign junctions',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
  {
    id: 'astro_group:Neptune',
    display_name: 'Neptune',
    tag: 'Neptune',
    color: '#1E3A5F',          // deep navy
    description: 'Neptune station and retrograde windows',
    block_type: 'astro_rule',
    placement: 'chart_overlay',
    overlay_type: 'astro_zone',
    data_source: 'rule_engine',
    applicable_to: ['index'],
    tier_required: 'free',
  },
]

export type AstroGroupId = `astro_group:${string}`

/** Glyph shown in front of the group name on the workspace overlay pill. */
const ASTRO_GROUP_GLYPHS: Record<string, string> = {
  'astro_group:Mercury': '☿',
  'astro_group:Venus': '♀',
  'astro_group:Bayer': '⬡',
  'astro_group:MajorTransit': '⟳',
  'astro_group:Panchak': '◈',
  'astro_group:Gandanta': '♂',
  'astro_group:Neptune': '♆',
}

/** Pill label for a group overlay id (glyph + name), or null if not a group id. */
export function astroGroupPillLabel(catalogItemId: string): string | null {
  if (!catalogItemId.startsWith(ASTRO_GROUP_PREFIX)) return null
  const group = ASTRO_GROUP_OVERLAYS.find(g => g.id === catalogItemId)
  const name = group?.display_name ?? catalogItemId.slice(ASTRO_GROUP_PREFIX.length)
  const glyph = ASTRO_GROUP_GLYPHS[catalogItemId]
  return glyph ? `${glyph} ${name}` : name
}
