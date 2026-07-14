import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { fetchLastRun } from '@/services/pipeline2'

const DISMISS_KEY = 'kd_pipeline_healthbar_dismissed_run'

/**
 * Thin, admin-only notice shown at the top of the Workspace when the most recent
 * daily pipeline run had a failed step. A single failed step no longer fails the
 * whole run (it downgrades to 'partial'), so this bar is how an admin still finds
 * out something needs a re-run. Dismissal is remembered per run id, so it won't
 * nag again until a *new* run fails.
 */
export default function PipelineHealthBar() {
  const { isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const [dismissedRun, setDismissedRun] = useState<number | null>(() => {
    const raw = localStorage.getItem(DISMISS_KEY)
    return raw ? Number(raw) : null
  })

  const { data } = useQuery({
    queryKey: ['pipeline2', 'last-run'],
    queryFn: fetchLastRun,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  })

  if (!isAdmin || !data?.exists || !data.has_error) return null
  if (data.id != null && data.id === dismissedRun) return null

  const dismiss = () => {
    if (data.id != null) {
      localStorage.setItem(DISMISS_KEY, String(data.id))
      setDismissedRun(data.id)
    }
  }

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 20px', flexShrink: 0,
        fontSize: 12, lineHeight: 1.4,
        color: 'var(--risk-amber, #f59e0b)',
        background: 'color-mix(in srgb, var(--risk-amber, #f59e0b) 10%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--risk-amber, #f59e0b) 30%, transparent)',
      }}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>Pipeline:</strong> a step failed
        {data.trade_date ? ` on ${data.trade_date}` : ''}
        {data.error_msg ? ` — ${data.error_msg}` : ''}
      </span>
      <button
        onClick={() => navigate('/data-pipeline')}
        style={{
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          color: 'var(--risk-amber, #f59e0b)', background: 'transparent',
          border: '1px solid color-mix(in srgb, var(--risk-amber, #f59e0b) 40%, transparent)',
          borderRadius: 6, padding: '2px 10px', whiteSpace: 'nowrap',
        }}
      >
        View Pipeline
      </button>
      <button onClick={dismiss} aria-label="Dismiss" style={{
        cursor: 'pointer', color: 'inherit', background: 'transparent', border: 'none',
        display: 'flex', alignItems: 'center', padding: 2, opacity: 0.7,
      }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
