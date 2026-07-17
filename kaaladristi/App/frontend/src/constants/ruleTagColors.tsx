// Rule-tag identity hues. Values reference the --tag-* CSS variables defined in
// styles/globals.css (no hardcoded hex here). Chips render theme-aware: a soft
// color-mix tint of the hue + a small hue dot + neutral theme-token text, so
// they read cleanly in BOTH light and dark. Previously these were dark-only
// Tailwind classes (bg-blue-900/60 text-blue-300 …) that turned into heavy,
// muddy fills in light mode.
export const RULE_TAG_COLORS: Record<string, string> = {
  Panchak:       'var(--tag-panchak)',
  Mercury:       'var(--tag-mercury)',
  Retrograde:    'var(--tag-retrograde)',
  Conjunction:   'var(--tag-conjunction)',
  Nakshatra:     'var(--tag-nakshatra)',
  Manifestation: 'var(--tag-manifestation)',
  Yoga:          'var(--tag-yoga)',
  Transit:       'var(--tag-transit)',
  Tithi:         'var(--tag-tithi)',
  Vedh:          'var(--tag-vedh)',
  Eclipse:       'var(--tag-eclipse)',
  Seasonal:      'var(--tag-seasonal)',
  SignPosition:  'var(--tag-signposition)',
  Lunar:         'var(--tag-lunar)',
  SpecialDay:    'var(--tag-specialday)',
  MajorTransit:  'var(--tag-majortransit)',
  Bayer:         'var(--tag-bayer)',
  Gandanta:      'var(--tag-gandanta)',
  Neptune:       'var(--tag-neptune)',
}

export const DEFAULT_TAG_COLOR = 'var(--tag-default)'

/** Resolve a tag's identity hue (a CSS custom-property reference string). */
export function tagHue(tag: string): string {
  return RULE_TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const hue = tagHue(tag)
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
      style={{
        background: `color-mix(in srgb, ${hue} 12%, transparent)`,
        color: 'var(--text-secondary)',
        borderColor: `color-mix(in srgb, ${hue} 30%, transparent)`,
      }}
    >
      <span
        aria-hidden
        style={{ width: 5, height: 5, borderRadius: '50%', background: hue, flexShrink: 0, display: 'inline-block' }}
      />
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
        >
          ×
        </button>
      )}
    </span>
  )
}
