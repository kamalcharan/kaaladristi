/**
 * ContinuityLine — the Morning Brief's persona-aware opening line for the
 * first CONTINUITY_DAYS after the persona was set (migration 204). Fully
 * deterministic, computed in the browser from the profile, the user's
 * bookmarks and one latest-bar read — no LLM call, so it costs nothing per
 * user and never drifts from the persona vocabulary.
 *
 *   "Swing traders on DristiQ are watching Breakout Surge today. The name you
 *    picked, BODALCHEM, closed ₹155.62 (+3.20%). 2 of 6 guide walks done."
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { from } from '@/services/postgrest'
import { getPresetMeta } from '@/services/scanEngine'
import { guideKeys, guideWalkedCount } from '@/services/guideProgress'
import { CONTINUITY_DAYS, PERSONAS, PERSONA_SCANNERS } from '@/constants/personaConfig'
import { fmtInr } from '@/components/domain/Onboarding/ui'

interface LastBar { close: number | null; pct_chng: number | null; trade_date: string }

export default function ContinuityLine({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const profile = useAuthStore(s => s.profile)
  const { bookmarks, hasLoaded, load } = useBookmarkStore()
  useEffect(() => { if (!hasLoaded) load() }, [hasLoaded, load])

  const persona = profile?.persona ?? null
  const setAt = profile?.persona_set_at ? new Date(profile.persona_set_at).getTime() : null
  const withinWindow = !!persona && setAt != null && (Date.now() - setAt) / 86_400_000 <= CONTINUITY_DAYS
  const pick = bookmarks[0] ?? null

  const { data: bar } = useQuery<LastBar | null>({
    queryKey: ['continuity-last-bar', pick?.equity_id ?? 0],
    queryFn: async () => {
      const { data, error } = await from('km_equity_eod').select('close,pct_chng,trade_date')
        .eq('equity_id', pick!.equity_id).order('trade_date', { ascending: false }).limit(1).execute()
      if (error) return null
      const rows = (Array.isArray(data) ? data : [data]) as LastBar[]
      return rows[0] ?? null
    },
    enabled: withinWindow && !!pick,
    staleTime: 60 * 60 * 1000,
  })

  if (!withinWindow || !persona) return null
  const first = getPresetMeta(PERSONA_SCANNERS[persona][0])
  const walked = guideWalkedCount(persona, profile?.guide_progress)
  const total = guideKeys(persona).length
  const pct = bar?.pct_chng

  return (
    <div data-tour="brief-continuity" style={{ fontSize: compact ? 12 : 13, lineHeight: 1.55, color: 'var(--text-secondary)',
      padding: compact ? '4px 0 8px' : '8px 0 10px', borderBottom: compact ? 'none' : '1px solid var(--border)', marginBottom: compact ? 6 : 10 }}>
      <strong style={{ color: 'var(--text-primary)' }}>{PERSONAS[persona].label}s</strong> on DristiQ are watching{' '}
      <button type="button" onClick={() => navigate(`/scanner/${PERSONA_SCANNERS[persona][0]}`)} style={linkStyle}>{first?.name ?? 'their scanners'}</button> today.
      {pick && (
        <> The name you picked, <button type="button" onClick={() => navigate(`/chart/equity/${pick.equity_id}`)} style={linkStyle}>{pick.symbol}</button>
          {bar?.close != null ? <>, closed {fmtInr(bar.close)}{pct != null ? <span style={{ color: pct >= 0 ? 'var(--bull)' : 'var(--bear)' }}> ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span> : null}.</> : '.'}
        </>
      )}
      {' '}<button type="button" onClick={() => navigate('/guide')} style={linkStyle}>{walked} of {total} guide walks done</button>.
    </div>
  )
}

const linkStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--accent)' }
