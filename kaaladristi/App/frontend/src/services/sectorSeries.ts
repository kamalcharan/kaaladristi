/**
 * sectorSeries — the stock's industry strength over time, for the story's
 * sector thermometer + the "Sector rotating in" event.
 *
 * Reads km_industry_eod (industry_rank per date) and turns it into a per-date
 * percentile (higher = stronger sector) + a `leading` flag (top quartile).
 * Total industry count is approximated by the global max rank — good enough for
 * a glanceable gauge; avoids an N-per-date count query.
 */

import { from } from './postgrest'

export interface SectorPoint {
  percentile: number
  leading: boolean
}

export async function fetchSectorSeries(industry: string | null): Promise<Map<string, SectorPoint>> {
  const out = new Map<string, SectorPoint>()
  if (!industry) return out

  const [rankRes, maxRes] = await Promise.all([
    from('km_industry_eod')
      .select('trade_date,industry_rank')
      .eq('industry', industry)
      .order('trade_date', { ascending: false })
      .limit(400)
      .execute(),
    from('km_industry_eod')
      .select('industry_rank')
      .order('industry_rank', { ascending: false })
      .limit(1)
      .single()
      .execute(),
  ])

  const rows = (rankRes.data ?? []) as { trade_date: string; industry_rank: number | null }[]
  const maxRank = (maxRes.data as { industry_rank: number } | null)?.industry_rank ?? 100
  const total = Math.max(20, maxRank)
  const cutoff = Math.ceil(total / 4)

  for (const r of rows) {
    if (r.industry_rank == null) continue
    out.set(r.trade_date, {
      percentile: Math.max(0, Math.min(100, Math.round((1 - r.industry_rank / total) * 100))),
      leading: r.industry_rank <= cutoff,
    })
  }
  return out
}
