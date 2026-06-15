export const RULE_TAG_COLORS: Record<string, string> = {
  Panchak:       'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  Mercury:       'bg-blue-900/60 text-blue-300 border-blue-700',
  Retrograde:    'bg-orange-900/60 text-orange-300 border-orange-700',
  Conjunction:   'bg-purple-900/60 text-purple-300 border-purple-700',
  Nakshatra:     'bg-teal-900/60 text-teal-300 border-teal-700',
  Manifestation: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  Yoga:          'bg-green-900/60 text-green-300 border-green-700',
  Transit:       'bg-rose-900/60 text-rose-300 border-rose-700',
  Tithi:         'bg-amber-900/60 text-amber-300 border-amber-700',
  Vedh:          'bg-cyan-900/60 text-cyan-300 border-cyan-700',
  Eclipse:       'bg-red-900/60 text-red-300 border-red-700',
  Seasonal:      'bg-lime-900/60 text-lime-300 border-lime-700',
  SignPosition:  'bg-violet-900/60 text-violet-300 border-violet-700',
  Lunar:         'bg-slate-800 text-slate-300 border-slate-600',
  SpecialDay:    'bg-pink-900/60 text-pink-300 border-pink-700',
  MajorTransit:  'bg-rose-900/60 text-rose-300 border-rose-700',
  Bayer:         'bg-amber-800/60 text-amber-200 border-amber-600',
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
