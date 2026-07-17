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
    <div
      className={`${className} rounded-lg border p-4`}
      style={{
        background: 'color-mix(in srgb, var(--vani) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--vani) 22%, transparent)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--vani)] text-sm">✦</span>
        <span className="text-xs font-medium text-[var(--vani)] uppercase tracking-wider">
          VaNi Interpretation
        </span>
        {data?.cached && (
          <span className="ml-auto text-[10px] text-muted">⚡ cached</span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-[var(--panel-recess)] rounded animate-pulse w-full" />
          <div className="h-3 bg-[var(--panel-recess)] rounded animate-pulse w-4/5" />
          <div className="h-3 bg-[var(--panel-recess)] rounded animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-sm text-kd-text-secondary leading-relaxed whitespace-pre-wrap">
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
