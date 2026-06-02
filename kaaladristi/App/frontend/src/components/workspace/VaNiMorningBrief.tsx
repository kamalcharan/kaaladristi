import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'
import type { UserFramework } from '@/types/framework'
import { useAuthStore } from '@/stores/authStore'
import type { KmProfile } from '@/types'
import { getCatalogItem } from '@/constants/catalogItems'
import { fetchCatalogRules } from '@/pages/RuleEngine/ruleService'
import VaNiFeedback from '@/components/domain/VaNi/VaNiFeedback'

function todayKey(userId: string) {
  const d = new Date().toISOString().slice(0, 10)
  return `vani_morning_shown:${userId}:${d}`
}

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

const LOADING_MESSAGES = [
  'Reading your framework overlays…',
  'Checking active astro rules…',
  'Correlating panchang conditions…',
  'Surfacing what matters today…',
]

function VaNiLoader() {
  const [msgIdx, setMsgIdx] = useState(0)
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2200)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '28px 20px', gap: 16,
    }}>
      {/* Pulsing orb */}
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)',
          opacity: 0.15,
          animation: 'vani-ring 1.8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 6, borderRadius: '50%',
          background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
          fontFamily: 'var(--font-mono,monospace)',
        }}>
          Vᴺ
        </div>
      </div>
      <style>{`
        @keyframes vani-ring {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.35); opacity: 0.06; }
        }
      `}</style>
      <div style={{
        fontSize: 12, color: 'var(--text-secondary)',
        fontStyle: 'italic', textAlign: 'center', minHeight: 18,
        transition: 'opacity 0.4s',
      }}>
        {LOADING_MESSAGES[msgIdx]}{'.'.repeat(dots)}
      </div>
    </div>
  )
}

const PIPELINEURL = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''


interface VaniBriefObs {
  type:          string
  title:         string
  description:   string
  badge:         string
  action_label:  string
  action?:       string
  action_target?: string
  item_key?:     string
}

interface VaniBriefResult {
  observations: VaniBriefObs[]
  cached:       boolean
  source?:      string
  log_id?:      string
}

function useVaniDailyBrief(
  userId: string | undefined,
  today: string,
  activeOverlays: Array<{ catalog_item_id: string; name: string; type: string }>,
  confluences: Array<{ item_a: string; item_b: string; item_a_display: string; item_b_display: string; instances: number; status: string }>,
  astroRulesReady: boolean,
) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''

  // Stable cache key: sorted astro catalog_item_ids + sorted confluence pairs
  const overlayKeys = activeOverlays
    .filter(o => o.type === 'astro_zone' || o.type === 'astro_marker')
    .map(o => o.catalog_item_id)
    .sort()
  const confluenceKeys = confluences
    .slice(0, 2)
    .map(c => [c.item_a, c.item_b].sort().join(':'))
    .sort()

  return useQuery({
    queryKey: ['vani-morning-brief', today, overlayKeys.join(','), confluenceKeys.join(',')],
    queryFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/vani/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, user_id: userId, active_overlays: activeOverlays, confluences }),
      })
      if (!res.ok) throw new Error('vani daily failed')
      return res.json() as Promise<VaniBriefResult>
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: !!userId && astroRulesReady,  // wait for rules to load before firing
  })
}

interface BriefItem {
  type:        'astro' | 'confluence' | 'outlook'
  title:       string
  description: string
  badge:       string
  dot:         string  // CSS color
  action:      () => void
}

interface VaNiMorningBriefProps {
  /** If true, shows the expanded modal. Controlled from WorkspacePage. */
  modalOpen?:    boolean
  onModalOpen?:  () => void
  onModalClose?: () => void
}

export default function VaNiMorningBrief({ modalOpen, onModalOpen, onModalClose }: VaNiMorningBriefProps) {
  const navigate       = useNavigate()
  const { profile }    = useAuthStore()
  const { framework, vaniCorrelations } = useFrameworkStore()

  const items = useComputeBriefItems({ navigate, framework, vaniCorrelations })

  if (items.length === 0) return null

  return (
    <>
      {/* Inline card */}
      <div
        onClick={onModalOpen}
        style={{
          border: '1px solid rgba(157,143,249,0.22)',
          borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(157,143,249,0.06) 0%, rgba(91,79,212,0.04) 100%)',
          padding: '12px 16px',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          marginBottom: 12,
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(157,143,249,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(157,143,249,0.22)')}
      >
        {/* VaNi orb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            Vᴺ
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12, fontStyle: 'italic',
            color: 'rgba(157,143,249,0.9)',
          }}>
            VaNi
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 10,
            color: 'var(--text-faint)', fontFamily: 'var(--font-mono, monospace)',
          }}>
            Full context →
          </span>
        </div>

        {/* Items */}
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            marginBottom: i < items.length - 1 ? 8 : 0,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
              background: item.dot,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text-primary)',
                marginBottom: 1,
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {item.description}
              </div>
            </div>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
              color: item.dot, background: `${item.dot}18`,
              border: `1px solid ${item.dot}30`,
              padding: '1px 5px', borderRadius: 3, flexShrink: 0,
            }}>
              {item.badge}
            </span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <MorningModal items={items} profile={profile} onClose={onModalClose ?? (() => {})} />
      )}
    </>
  )
}

function MorningModal({ items, profile, onClose }: {
  items:   BriefItem[]
  profile: KmProfile | null
  onClose: () => void
}) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const dd  = String(now.getDate()).padStart(2, '0')
  const mmm = now.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()
  const yyyy = now.getFullYear()
  const dateStr = `${dd}-${mmm}-${yyyy}`
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'

  const { framework, vaniCorrelations } = useFrameworkStore()
  const { isAdmin } = useAuthStore()

  // Astro rule display names — same query key as CatalogAstroSection, served from cache.
  // No default — undefined = still loading, [] = loaded (empty). Critical for the guard below.
  const { data: astroRules } = useQuery({
    queryKey: ['rule-engine', 'catalog-rules'],
    queryFn: fetchCatalogRules,
    staleTime: 10 * 60 * 1000,
  })
  const astroRulesReady = astroRules !== undefined

  const astroRuleNames = useMemo(() => {
    const map: Record<string, string> = {}
    astroRules?.forEach(r => {
      map[`astro_rule:${r.rule_code}`] = r.display_name ?? ''
    })
    return map
  }, [astroRules])

  // Resolve display name — no fallbacks. If unresolved, item is dropped entirely.
  const resolveName = (cid: string): string | null =>
    getCatalogItem(cid)?.display_name ?? astroRuleNames[cid] ?? null

  const activeOverlays = useMemo(() => {
    if (!astroRulesReady) return []
    return (framework?.chart_overlays ?? [])
      .filter(o => o.visible !== false)
      .map(o => ({
        catalog_item_id: o.catalog_item_id,
        name: resolveName(o.catalog_item_id),
        type: o.type ?? 'indicator_line',
      }))
      .filter((o): o is typeof o & { name: string } => o.name !== null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework?.chart_overlays, astroRuleNames, astroRulesReady])

  const confluences = useMemo(() => {
    if (!astroRulesReady) return []
    return (vaniCorrelations ?? [])
      .slice(0, 2)
      .map(c => {
        const a = resolveName(c.item_a)
        const b = resolveName(c.item_b)
        if (!a || !b) return null
        return {
          item_a: c.item_a,
          item_b: c.item_b,
          item_a_display: a,
          item_b_display: b,
          instances: c.n_instances ?? 0,
          status: c.currently_active ? 'active' : 'approaching',
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaniCorrelations, astroRuleNames, astroRulesReady])

  const { data: briefData, isLoading: briefLoading } = useVaniDailyBrief(
    profile?.id,
    today,
    activeOverlays,
    confluences,
    astroRulesReady,   // guard — don't fire until rules are loaded
  )

  // Progressive rendering — cards pop in as each resolves
  const [liveObs, setLiveObs] = useState<VaniBriefObs[]>([])
  const [allCached, setAllCached] = useState(false)

  useEffect(() => {
    if (!briefData) return
    // Start with whatever the batch call returned
    setLiveObs(briefData.observations ?? [])
    setAllCached(briefData.cached ?? false)
  }, [briefData])

  // Minimum loader display — 900ms even for cache hits
  const [minWait, setMinWait] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setMinWait(false), 900)
    return () => clearTimeout(t)
  }, [])
  const showLoader = (briefLoading || minWait) && liveObs.length === 0



  function handleAction(obs: VaniBriefObs) {
    if (!obs.action_target) return
    onClose?.()
    navigate(obs.action_target)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 501,
        width: 420, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-card, #0d1117)',
        border: '1px solid rgba(157,143,249,0.25)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(157,143,249,0.06) 0%, transparent 60%)',
        }}>
          <button
            onClick={onClose}
            style={{
              float: 'right', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
            }}
          >
            <X size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              Vᴺ
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic',
              color: '#9d8ff9',
            }}>
              VaNi
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            What's active in your framework as markets open today.
          </p>
          <div style={{
            marginTop: 5, fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-faint)',
          }}>
            {dateStr} · {timeStr}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: showLoader ? 0 : '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'padding 0.2s' }}>
          {showLoader ? (
            <VaNiLoader />
          ) : liveObs.length > 0 ? (
            liveObs.map((obs, i) => {
              const dotColor = obs.type === 'confluence' ? '#f59e0b' : obs.type === 'panchang' ? '#2dd4bf' : '#9d8ff9'
              return (
                <div
                  key={obs.item_key ?? i}
                  className="vani-obs-card"
                  style={{
                    position: 'relative',
                    borderRadius: 8, padding: '12px 14px',
                    background: 'rgba(255,255,255,0.025)',
                    border: `1px solid ${dotColor}22`,
                    borderLeft: `3px solid ${dotColor}`,
                  }}
                >
                  {isAdmin && obs.item_key && (
                    <button
                      title="Clear this observation's cache"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await fetch(
                          `${PIPELINEURL}/api/vani/observation-cache/${encodeURIComponent(obs.item_key!)}/${today}`,
                          { method: 'DELETE' },
                        ).catch(() => {})
                      }}
                      className="absolute top-2 right-2 flex items-center gap-1 text-[8px] font-mono text-risk-red/30 hover:text-risk-red/70 transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>clear cache</span>
                    </button>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {obs.title}
                    </div>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono,monospace)',
                      color: dotColor, background: `${dotColor}18`,
                      border: `1px solid ${dotColor}30`,
                      padding: '2px 6px', borderRadius: 3, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {obs.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>
                    {obs.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      onClick={() => handleAction(obs)}
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--accent, #7c6af7)',
                        cursor: obs.action_target ? 'pointer' : 'default',
                        opacity: obs.action_target ? 1 : 0.4,
                      }}
                    >
                      {obs.action_label}
                    </span>
                    {obs.log_id && <VaNiFeedback logId={obs.log_id} />}
                  </div>
                </div>
              )
            })
          ) : (
            <p style={{
              fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic',
              textAlign: 'center', padding: '12px 0', margin: 0,
            }}>
              VaNi is unavailable right now.
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onClick={onClose}
              style={{
                fontSize: 12, color: 'var(--text-muted)', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left',
              }}
            >
              Dismiss
            </button>
            {!showLoader && liveObs.length > 0 && (
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)' }}>
                {allCached ? '⚡ cached · instant' : '✦ generated · fresh'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#7c6af7,#5b4fd4)',
              color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            Enter workspace →
          </button>
        </div>
      </div>
    </>
  )
}

// ── Compute brief items ───────────────────────────────────────────────────────

function useComputeBriefItems({
  navigate,
  framework,
  vaniCorrelations,
}: {
  navigate:         ReturnType<typeof useNavigate>
  framework:        UserFramework | null
  vaniCorrelations: VaNiCorrelation[]
}): BriefItem[] {
  const items: BriefItem[] = []

  // 1. Active astro overlays from chart_overlays
  const astroOverlays = (framework?.chart_overlays ?? [])
    .filter((o: UserFramework['chart_overlays'][number]) => o.catalog_item_id.startsWith('astro_rule:') && o.visible)

  for (const overlay of astroOverlays.slice(0, 1)) {
    items.push({
      type:        'astro',
      title:       fmtId(overlay.catalog_item_id),
      description: 'Astro rule active as chart overlay in your framework.',
      badge:       'Active overlay',
      dot:         'var(--gold, #f59e0b)',
      action:      () => navigate('/workspace'),
    })
  }

  // 2. VaNi confluence pairs
  for (const corr of vaniCorrelations.slice(0, 1)) {
    items.push({
      type:        'confluence',
      title:       `${fmtId(corr.item_a)} ∩ ${fmtId(corr.item_b)}`,
      description: `${corr.n_instances} historical instances of this combination in your framework.`,
      badge:       `${corr.n_instances}×`,
      dot:         'var(--accent, #7c6af7)',
      action:      () => navigate(`/correlation/${corr.item_a}/${corr.item_b}`),
    })
  }

  // 3. Six-day outlook if in framework
  const hasSixDay = (framework?.blocks ?? []).some((b: UserFramework['blocks'][number]) => b.catalog_item_id === 'six_day_outlook')
  if (hasSixDay && items.length < 3) {
    items.push({
      type:        'outlook',
      title:       'Six-Day Outlook',
      description: 'Forward astro signal layer is active in your framework.',
      badge:       'In framework',
      dot:         'var(--text-muted, #6b7280)',
      action:      () => navigate('/workspace'),
    })
  }

  return items.slice(0, 3)
}

// ── Auto-show hook ────────────────────────────────────────────────────────────

export function useMorningBriefAutoShow(userId: string | undefined): {
  shouldShow: boolean
  dismiss:    () => void
} {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!userId) return
    const key = todayKey(userId)
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setShown(true), 1200)
      return () => clearTimeout(t)
    }
  }, [userId])

  const dismiss = useCallback(() => {
    if (!userId) return
    try { localStorage.setItem(todayKey(userId), '1') } catch {}
    setShown(false)
  }, [userId])

  return { shouldShow: shown, dismiss }
}
