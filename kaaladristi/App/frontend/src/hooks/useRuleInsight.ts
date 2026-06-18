import { useQuery } from '@tanstack/react-query'

export interface RuleInsight {
  rule_id:   number
  rule_code: string
  insight:   string | null     // null when the LLM is unavailable — render nothing
  cached?:   boolean
  ai?:       boolean
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

export interface ActiveRule {
  id:                 number
  rule_code:          string
  display_name:       string
  base_bias:          string | null
  probability_label:  string | null
  start_date:         string | null
  end_date:           string | null
  days_remaining?:    number | null
  days_until?:        number | null
  confidence_score?:   number | null
  avg_return_matched?: number | null
  total_occurrences?:  number | null
}

export interface ActiveRuleToday {
  tag:        string
  date:       string
  active_now: ActiveRule[]
  upcoming:   ActiveRule[]
}

/**
 * Which specific rule(s) within a tag group are active today (plus upcoming).
 * Backed by GET /api/ai/active-rule-today. `tag` is the bare group tag, e.g. "Mercury".
 */
export function useActiveRuleToday(tag: string | null) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''
  return useQuery({
    queryKey: ['active-rule-today', tag],
    queryFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/ai/active-rule-today?tag=${encodeURIComponent(tag!)}`)
      if (!res.ok) throw new Error('Failed to fetch active rule')
      return res.json() as Promise<ActiveRuleToday>
    },
    enabled: !!tag,
    staleTime: 60 * 60 * 1000,   // refresh hourly — transit windows move slowly
    retry: 1,
  })
}
