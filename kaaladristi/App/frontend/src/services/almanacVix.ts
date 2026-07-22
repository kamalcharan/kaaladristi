// India VIX context for the Almanac event list — plain reference, not a
// scored signal (sample sizes in km_rule_evidence.vix_windows are too small
// to claim a pattern; see docs/claude/VIX-Upgrade.md Tier 1).

import { from } from './postgrest'

export const VIX_INDEX_ID = 94

export interface VixPoint {
  date: string
  close: number
}

export async function fetchVixSeries(sinceIso: string, untilIso: string): Promise<VixPoint[]> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date,close')
    .eq('index_id', VIX_INDEX_ID)
    .gte('trade_date', sinceIso)
    .lte('trade_date', untilIso)
    .order('trade_date', { ascending: true })
    .execute()
  if (error || !data) return []
  return (data as { trade_date: string; close: number }[])
    .map(r => ({ date: r.trade_date, close: Number(r.close) }))
}

/** VIX level + short (5-session) trend as of the latest available close on/before `iso`. Null if no data yet (future date). */
export function vixContextForDate(series: VixPoint[], iso: string): { close: number; trendPct: number } | null {
  let idx = -1
  for (let i = 0; i < series.length; i++) {
    if (series[i].date <= iso) idx = i
    else break
  }
  if (idx < 0) return null
  const cur = series[idx]
  const prev = series[Math.max(0, idx - 5)]
  const trendPct = prev.close ? ((cur.close - prev.close) / prev.close) * 100 : 0
  return { close: cur.close, trendPct }
}
