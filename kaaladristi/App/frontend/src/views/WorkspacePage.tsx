import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceCanvas from '@/components/domain/Workspace/WorkspaceCanvas'

export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { framework, isLoading, error, loadFramework } = useFrameworkStore()

  useEffect(() => {
    if (!framework && profile?.id) {
      loadFramework(profile.id)
    }
  }, [framework, profile?.id, loadFramework])

  if (isLoading || (!framework && !error)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--bg)' }}>
        <Loader2 className="w-6 h-6 text-accent-indigo animate-spin" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your framework…</span>
      </div>
    )
  }

  // version === 1 means the framework was just auto-created and has never been saved.
  // Any user interaction bumps it to 2+, so this redirect only fires for a fresh account.
  if (
    framework &&
    framework.version === 1 &&
    framework.blocks.length === 0 &&
    framework.chart_overlays.length === 0
  ) {
    return <Navigate to="/setup" replace />
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6"
        style={{ background: 'var(--bg)' }}>
        <div style={{ fontSize: 28, opacity: .4 }}>⚠</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textAlign: 'center', maxWidth: 280 }}>
          Could not load framework: {error}
        </p>
        <button
          onClick={() => profile?.id && loadFramework(profile.id)}
          style={{ padding: '8px 20px', borderRadius: 100, border: '1px solid rgba(255,255,255,.1)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 12, fontFamily: 'inherit' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{ padding: '14px 20px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300,
            color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {framework!.name}
          </h1>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-faint)', letterSpacing: '.05em' }}>
            v{framework!.version}
          </span>
        </div>
      </div>

      {/* Canvas — topbar contains overlay pills + Edit Canvas button */}
      <WorkspaceCanvas framework={framework!} />
    </div>
  )
}
