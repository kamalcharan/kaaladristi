/**
 * HowYouInvestPanel — Account → "How you invest".
 *
 * The persisted persona (migration 204) made editable: the same three
 * questions as setup, as chips, plus the reading strip with its override
 * chip, "Re-run the three picks" (the live cards again) and the Guide
 * progress. Saving changes the persona the Guide and Morning Brief follow;
 * the workbench stays as the user built it.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/auth'
import { useActsOnRows } from '@/hooks/useOnboardingScans'
import { guideKeys, guideWalkedCount } from '@/services/guideProgress'
import {
  ACTS_ON_IDS, ACTS_ON_OPTIONS, CONCEDE_LEVEL_IDS, CONCEDE_LEVEL_OPTIONS, DEFAULT_PERSONA,
  HOLD_HORIZON_IDS, HOLD_HORIZON_OPTIONS, PERSONAS, derivePersona, type Persona, type PersonaAnswers,
} from '@/constants/personaConfig'
import ReadingStrip from './ReadingStrip'
import ActsOnPicker from './ActsOnPicker'
import { Chip, GhostButton, MONO, PrimaryButton, Question } from './ui'

export default function HowYouInvestPanel({ rerun = false }: { rerun?: boolean }) {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuthStore()
  const [answers, setAnswers] = useState<PersonaAnswers>({
    acts_on: profile?.acts_on ?? null, hold_horizon: profile?.hold_horizon ?? null, concede_level: profile?.concede_level ?? null,
  })
  const [override, setOverride] = useState<Persona | null>(() =>
    profile?.persona && profile.persona !== derivePersona({
      acts_on: profile.acts_on, hold_horizon: profile.hold_horizon, concede_level: profile.concede_level,
    }) ? profile.persona : null)
  const [showPicks, setShowPicks] = useState(rerun)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picks = useActsOnRows()

  useEffect(() => { if (rerun) setShowPicks(true) }, [rerun])

  const persona = override ?? derivePersona(answers)
  const savedPersona: Persona = profile?.persona ?? DEFAULT_PERSONA
  const dirty = persona !== profile?.persona
    || (answers.acts_on ?? null) !== (profile?.acts_on ?? null)
    || (answers.hold_horizon ?? null) !== (profile?.hold_horizon ?? null)
    || (answers.concede_level ?? null) !== (profile?.concede_level ?? null)
  const walked = guideWalkedCount(savedPersona, profile?.guide_progress)
  const total = guideKeys(savedPersona).length

  const patch = (p: PersonaAnswers) => { setAnswers(a => ({ ...a, ...p })); setSaved(false) }

  async function save() {
    setSaving(true); setError(null)
    try {
      await updateProfile({
        persona, acts_on: answers.acts_on ?? null, hold_horizon: answers.hold_horizon ?? null, concede_level: answers.concede_level ?? null,
      })
      await refreshProfile()
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ReadingStrip answers={answers} override={override} onOverride={p => { setOverride(p); setSaved(false) }} />

      <section>
        <Question n={1} text="Which setup would you act on?" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACTS_ON_IDS.map(k => (
            <Chip key={k} active={answers.acts_on === k} onClick={() => patch({ acts_on: k })} title={ACTS_ON_OPTIONS[k].hint}>
              {ACTS_ON_OPTIONS[k].label}
            </Chip>
          ))}
          <GhostButton onClick={() => setShowPicks(v => !v)} style={{ padding: '9px 14px', fontSize: 12 }}>
            {showPicks ? 'Hide the three picks' : 'Re-run the three picks'}
          </GhostButton>
        </div>
        {showPicks && (
          <div style={{ marginTop: 14 }}>
            <ActsOnPicker data={picks} value={answers.acts_on ?? null} onPick={k => patch({ acts_on: k })} />
          </div>
        )}
      </section>

      <section>
        <Question n={2} text="How long do you usually hold?" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HOLD_HORIZON_IDS.map(h => (
            <Chip key={h} active={answers.hold_horizon === h} onClick={() => patch({ hold_horizon: h })}>{HOLD_HORIZON_OPTIONS[h].label}</Chip>
          ))}
        </div>
      </section>

      <section>
        <Question n={3} text="Where would you concede you were wrong?" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONCEDE_LEVEL_IDS.map(k => (
            <Chip key={k} active={answers.concede_level === k} onClick={() => patch({ concede_level: k })}>
              {CONCEDE_LEVEL_OPTIONS[k].label}
              <span style={{ fontFamily: MONO, fontSize: 11, marginLeft: 8, opacity: .8 }}>{CONCEDE_LEVEL_OPTIONS[k].line}</span>
            </Chip>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PrimaryButton onClick={() => void save()} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
        <span style={{ fontSize: 12, color: error ? 'var(--bear)' : 'var(--text-muted)' }}>
          {error ?? (saved ? `Saved — the Guide and Morning Brief now follow ${PERSONAS[persona].label.toLowerCase()}.` : 'Your workbench stays as you built it; the Guide and Morning Brief follow this.')}
        </span>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>How to use DristiQ · {walked} of {total} walks done</span>
        <button type="button" onClick={() => navigate('/guide')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--accent)', fontFamily: 'inherit' }}>
          Open the guide →
        </button>
      </div>
    </div>
  )
}
