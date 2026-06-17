import { useRuleInsight } from '@/hooks/useRuleInsight'

/**
 * VaNi plain-language interpretation of an astro rule.
 * Renders nothing (clean absence) when there is no insight — never a placeholder.
 * Shared by the Catalog DeepDivePanel and the Workspace astro-rule panel block.
 */
export default function RuleInsightCard({
  ruleId,
  className = 'mt-4',
}: {
  ruleId: number | null
  className?: string
}) {
  const { data, isLoading } = useRuleInsight(ruleId)

  // No insight and not loading → render nothing at all.
  if (!isLoading && !data?.insight) return null

  return (
    <div className={`${className} rounded-lg border border-indigo-500/20 bg-indigo-950/20 p-4`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-400 text-sm">✦</span>
        <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">
          VaNi Interpretation
        </span>
        {data?.cached && (
          <span className="ml-auto text-[10px] text-gray-500">⚡ cached</span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-gray-700/50 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-700/50 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-gray-700/50 rounded animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {data!.insight!
            .replace(/<\/?explanation>/g, '')
            .replace(/<\/?how_to_use>/g, '\n')
            .replace(/<\/?caveat>/g, '\n⚠ ')
            .trim()}
        </p>
      )}
    </div>
  )
}
