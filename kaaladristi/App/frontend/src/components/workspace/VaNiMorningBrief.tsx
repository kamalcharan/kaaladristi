import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'
import type { UserFramework } from '@/types/framework'
import { useAuthStore } from '@/stores/authStore'
import type { KmProfile } from '@/types'
import { getCatalogItem } from '@/constants/catalogItems'

function todayKey(userId: string) {
  const d = new Date().toISOString().slice(0, 10)
  return `vani_morning_shown:${userId}:${d}`
}

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

function useVaniDailyBrief(
  userId: string | undefined,
  today: string,
  activeOverlays: Array<{ name: string; type: string }>,
  confluences: Array<{ item_a: string; item_b: string; instances: number; status: string }>,
) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''
  return useQuery({
    queryKey: ['vani-morning-brief', userId, today,
      activeOverlays.map(o => o.name).sort().join(','),
      confluences.map(c => c.item_a + c.item_b).sort().join(','),
    ],
    queryFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/vani/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          user_id: userId,
          active_overlays: activeOverlays,
          confluences,
        }),
      })
      if (!res.ok) throw new Error('vani daily failed')
      return res.json() as Promise<{ interpretation: string; cached: boolean }>
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
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
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'

  // Build overlay context from framework
  const { framework, vaniCorrelations } = useFrameworkStore()
  const activeOverlays = (framework?.chart_overlays ?? [])
    .filter(o => o.visible !== false)
    .slice(0, 3)
    .map(o => ({
      name: getCatalogItem(o.catalog_item_id)?.display_name ?? o.catalog_item_id,
      type: o.type ?? 'indicator_line',
    }))
  const confluences = (vaniCorrelations ?? [])
    .slice(0, 2)
    .map(c => ({
      item_a: c.item_a,
      item_b: c.item_b,
      instances: c.n_instances ?? 0,
      status: c.currently_active ? 'active' : 'approaching',
    }))

  const { data: briefData, isLoading: briefLoading } = useVaniDailyBrief(
    profile?.id,
    today,
    activeOverlays,
    confluences,
  )

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
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {briefLoading ? (
            /* Skeleton rows */
            [90, 72, 55].map((w, i) => (
              <div key={i} style={{
                height: 14, borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                width: `${w}%`,
                opacity: 0.7,
                transition: 'opacity 0.8s ease-in-out',
              }} />
            ))
          ) : briefData?.interpretation ? (
            /* LLM sentences */
            briefData.interpretation
              .split(/(?<=\.)\s+/)
              .filter(s => s.trim().length > 0)
              .map((sentence, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65,
                }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>✦</span>
                  <span>{sentence.trim()}</span>
                </div>
              ))
          ) : (
            /* No data — say so clearly */
            <p style={{
              fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic',
              textAlign: 'center', padding: '12px 0',
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
          <button
            onClick={onClose}
            style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Dismiss
          </button>
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
