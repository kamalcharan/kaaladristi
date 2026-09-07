/**
 * GuidePage — /guide, "How to use DristiQ".
 *
 * Not videos: a checklist of the persona's four scanners plus Workspace and
 * Study, each with a "Show me" that opens the REAL page and runs its existing
 * page tour on live data (`?tour=1&guide=<key>` — PageTour / WorkspacePage).
 * A walked row shows the date from km_profiles.guide_progress (migration 204).
 */
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/ui'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { getPresetMeta } from '@/services/scanEngine'
import { guideKeys, guideWalkedCount } from '@/services/guideProgress'
import { DEFAULT_PERSONA, PERSONAS, PERSONA_SCANNERS, type Persona } from '@/constants/personaConfig'
import { MONO, PrimaryButton, VaniDot } from '@/components/domain/Onboarding/ui'

const PAGE_ROWS: Record<string, { name: string; why: string; path: string }> = {
  workspace: { name: 'Workspace', why: 'Your assembled workbench — the blocks, overlays and scanners VaNi placed for you, and the Morning Brief.', path: '/workspace' },
  chart:     { name: 'Study', why: 'Verify any setup on the chart with your own overlays, timeframes and zoom before you act.', path: '/chart/index/1' },
}

function rowFor(key: string): { name: string; why: string; path: string } | null {
  if (PAGE_ROWS[key]) return PAGE_ROWS[key]
  const m = getPresetMeta(key)
  return m ? { name: m.name, why: m.description, path: `/scanner/${key}` } : null
}

export default function GuidePage() {
  const navigate = useNavigate()
  const phone = useIsPhone()
  const profile = useAuthStore(s => s.profile)
  const persona: Persona = profile?.persona ?? DEFAULT_PERSONA
  const progress = profile?.guide_progress ?? {}
  const keys = guideKeys(persona)
  const walked = guideWalkedCount(persona, progress)
  const scannerCount = PERSONA_SCANNERS[persona].length

  return (
    <div style={{ minHeight: '100%' }}>
      <PageHeader eyebrow="Guide" title="How to use DristiQ" meta={`${walked} of ${keys.length} walks done · ${PERSONAS[persona].label}`} />
      <div style={{ padding: phone ? '16px 14px 60px' : '28px 32px 60px', maxWidth: 820 }}>
        <div data-tour="guide-persona" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px',
          borderRadius: 14, background: 'var(--card)', border: '1px solid var(--accent-dim)', marginBottom: 24 }}>
          <VaniDot />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {profile?.persona
                ? <>You read as <strong>{PERSONAS[persona].label.toLowerCase()}</strong> — {PERSONAS[persona].voice}</>
                : <>VaNi has not read how you invest yet, so this guide uses the {PERSONAS[persona].label.toLowerCase()} set.</>}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate('/account?tab=invest')} style={linkStyle}>Change how you invest →</button>
              <button type="button" onClick={() => navigate('/account?tab=invest&rerun=1')} style={linkStyle}>Re-run the three picks →</button>
            </div>
          </div>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
          Each row opens the real page with a short walk on live data
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.map((key, i) => {
            const row = rowFor(key)
            if (!row) return null
            const date = progress[key]
            const kind = i < scannerCount ? 'Scanner' : 'Page'
            return (
              <div key={key} data-tour={`guide-row-${key}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px',
                borderRadius: 12, background: 'var(--card)', border: `1px solid ${date ? 'var(--accent-dim)' : 'var(--border)'}`, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: date ? 'var(--bull)' : 'var(--accent)', width: 22, flexShrink: 0 }}>
                  {date ? '✓' : `0${i + 1}`}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)' }}>{kind}{date ? ` · walked ${date}` : ''}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 2 }}>{row.why}</div>
                </div>
                <PrimaryButton onClick={() => navigate(`${row.path}?tour=1&guide=${key}`)} style={{ padding: '8px 14px', fontSize: 12, flexShrink: 0 }}>
                  {date ? 'Again' : 'Show me'}
                </PrimaryButton>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const linkStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--accent)', fontFamily: 'inherit' }
