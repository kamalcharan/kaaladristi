/**
 * PersonalityScreen — setup step 2. Three things the user would DO, each
 * answered on live data, with VaNi's reading strip updating after every tap:
 *   01 Which of these would you act on?   (one live card per option)
 *   02 How long do you usually hold?      (chips)
 *   03 Where would you concede?           (three lines on the chosen chart)
 * Skip is always available and lands on the default persona (investor).
 */
import { useIsPhone } from '@/hooks/useMediaQuery'
import { useActsOnRows } from '@/hooks/useOnboardingScans'
import {
  HOLD_HORIZON_IDS, HOLD_HORIZON_OPTIONS, PERSONAS, derivePersona, isPersonaComplete,
  type ActsOn, type ConcedeLevel, type HoldHorizon, type Persona, type PersonaAnswers,
} from '@/constants/personaConfig'
import type { ScanStock } from '@/types'
import ReadingStrip from './ReadingStrip'
import ActsOnPicker from './ActsOnPicker'
import ConcedeChart from './ConcedeChart'
import { ActionIsland, Chip, GhostButton, PrimaryButton, Question, SectionLabel } from './ui'

export interface PersonalityState {
  answers: PersonaAnswers
  override: Persona | null
  stock: ScanStock | null
}

export default function PersonalityScreen({ state, onChange, onContinue, onSkip }: {
  state: PersonalityState
  onChange: (next: PersonalityState) => void
  onContinue: () => void
  onSkip: () => void
}) {
  const phone = useIsPhone()
  const data = useActsOnRows()
  const { answers, override, stock } = state
  const persona = override ?? derivePersona(answers)
  const answered = [answers.acts_on, answers.hold_horizon, answers.concede_level].filter(Boolean).length
  const complete = isPersonaComplete(answers)

  const setAnswers = (patch: PersonaAnswers, nextStock?: ScanStock | null) =>
    onChange({ ...state, answers: { ...answers, ...patch }, stock: nextStock === undefined ? stock : nextStock })

  const islandText = answered === 0
    ? 'Answer by pointing — VaNi assembles the rest.'
    : complete
      ? `${PERSONAS[persona].label} workbench ready to build.`
      : `${answered} of 3 · reading as ${PERSONAS[persona].label.toLowerCase()}`

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: phone ? '20px 14px 120px' : '36px 24px 120px',
        display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <SectionLabel>Step 2 of 6 · How you act</SectionLabel>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: phone ? 24 : 30, fontWeight: 300,
            letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
            Three things you'd do — on today's market.
          </h1>
        </div>

        <ReadingStrip answers={answers} override={override} onOverride={p => onChange({ ...state, override: p })} />

        <section>
          <Question n={1} text="Which of these would you act on?" sub="Live setups from the last trading date. Tap the one that matches how you trade." />
          <ActsOnPicker data={data} value={answers.acts_on ?? null}
            onPick={(k: ActsOn, s) => setAnswers({ acts_on: k }, s)} />
        </section>

        <section>
          <Question n={2} text="How long do you usually hold?" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HOLD_HORIZON_IDS.map((h: HoldHorizon) => (
              <Chip key={h} active={answers.hold_horizon === h} onClick={() => setAnswers({ hold_horizon: h })}>
                {HOLD_HORIZON_OPTIONS[h].label}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <Question n={3} text="Where would you concede you were wrong?"
            sub={stock ? 'Three lines on the setup you picked. Tap the one you would honour.' : 'Pick a setup above to see the lines on a real chart, or choose by name.'} />
          <ConcedeChart stock={stock} value={answers.concede_level ?? null}
            onChange={(v: ConcedeLevel) => setAnswers({ concede_level: v })} />
        </section>
      </div>

      <ActionIsland text={islandText}>
        {answered === 0 ? (
          <GhostButton onClick={onSkip} style={{ padding: '8px 14px', fontSize: 12 }}>Skip</GhostButton>
        ) : (
          <PrimaryButton onClick={onContinue} style={{ padding: '8px 16px', fontSize: 12 }}>
            {complete ? 'Build my workbench →' : 'Build with what I have →'}
          </PrimaryButton>
        )}
      </ActionIsland>
    </div>
  )
}
