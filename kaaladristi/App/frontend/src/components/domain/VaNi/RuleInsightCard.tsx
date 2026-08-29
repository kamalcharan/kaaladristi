import { useRuleInsight } from '@/hooks/useRuleInsight'
import VaNiInsight from '@/components/domain/VaNiInsight'

/**
 * VaNi plain-language interpretation of an astro rule.
 * Renders nothing (clean absence) when there is no insight — never a placeholder.
 * Shared by the Catalog DeepDivePanel and the Workspace astro-rule panel block.
 *
 * Thin wrapper around VaNiInsight (the one common "VaNi says" card used across
 * the product) — this file's only remaining job is the fetch and the
 * rule-insight-specific tag stripping below; VaNiInsight owns all rendering
 * (was previously a second, bespoke card with its own header and a
 * different accent color, `--vani`, than every other VaNi surface).
 */
export default function RuleInsightCard({
  ruleId,
  className = 'mt-4',
}: {
  ruleId: number | null
  className?: string
}) {
  const { data, isLoading } = useRuleInsight(ruleId)

  const insight = data?.insight
    ?.replace(/<\/?explanation>/g, '')
    .replace(/<\/?how_to_use>/g, '\n')
    .replace(/<\/?caveat>/g, '\n⚠ ')
    .trim()

  return (
    <VaNiInsight insight={insight} isLoading={isLoading} cached={data?.cached} className={className} />
  )
}
