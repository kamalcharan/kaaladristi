/**
 * ReadingStrip — VaNi's one visible inference during setup.
 *
 * Grows a clause per answer ("You act on confirmed strength, hold for weeks…
 * that reads as swing trader"). The persona chips are the override: tapping
 * one makes the strip say "you chose", tapping the derived one again clears
 * the override. This is the agentic part of the flow — the user watches VaNi
 * reason and corrects it in one tap, no chat.
 */
import { PERSONAS, PERSONA_IDS, derivePersona, readingLine, type Persona, type PersonaAnswers } from '@/constants/personaConfig'
import { Chip, VaniDot } from './ui'

const NO_ANSWER = (a: PersonaAnswers) => !a.acts_on && !a.hold_horizon && !a.concede_level

export default function ReadingStrip({ answers, override, onOverride }: {
  answers: PersonaAnswers
  override: Persona | null
  onOverride: (p: Persona | null) => void
}) {
  const derived = derivePersona(answers)
  const active: Persona | null = override ?? (NO_ANSWER(answers) ? null : derived)
  return (
    <div data-tour="onboarding-reading" style={{ display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 16px', borderRadius: 14, background: 'var(--card)',
      border: '1px solid var(--accent-dim)', animation: 'bubble-in .3s ease both' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <VaniDot />
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
          {readingLine(answers, override)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 34 }}>
        {PERSONA_IDS.map(p => (
          <Chip key={p} active={active === p}
            title={PERSONAS[p].voice}
            onClick={() => onOverride(p === derived ? null : p)}
            style={{ padding: '6px 12px', fontSize: 12 }}>
            {PERSONAS[p].label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
