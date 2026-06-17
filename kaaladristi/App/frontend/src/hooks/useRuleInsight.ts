import { useQuery } from '@tanstack/react-query'

export interface RuleInsight {
  rule_id:   number
  rule_code: string
  insight:   string
  cached:    boolean
  fallback?: boolean
}

/** VaNi plain-language explanation of an astro rule. Backed by GET /api/ai/rule-insight. */
export function useRuleInsight(ruleId: number | null) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''
  return useQuery({
    queryKey: ['rule-insight', ruleId],
    queryFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/ai/rule-insight?rule_id=${ruleId}`)
      if (!res.ok) throw new Error('Failed to fetch rule insight')
      return res.json() as Promise<RuleInsight>
    },
    enabled: !!ruleId,
    staleTime: Infinity,      // insights don't change
    gcTime: 1000 * 60 * 60,   // 1 hour in memory
    retry: 1,
  })
}
