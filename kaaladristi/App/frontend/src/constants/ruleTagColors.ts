export const RULE_TAG_COLORS: Record<string, string> = {
  Panchak:       'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  Mercury:       'bg-blue-900/60 text-blue-300 border-blue-700',
  Retrograde:    'bg-orange-900/60 text-orange-300 border-orange-700',
  Conjunction:   'bg-purple-900/60 text-purple-300 border-purple-700',
  Nakshatra:     'bg-teal-900/60 text-teal-300 border-teal-700',
  Manifestation: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  Yoga:          'bg-green-900/60 text-green-300 border-green-700',
  Transit:       'bg-rose-900/60 text-rose-300 border-rose-700',
}

export const DEFAULT_TAG_COLOR = 'bg-gray-800 text-gray-400 border-gray-600'

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const cls = RULE_TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
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
