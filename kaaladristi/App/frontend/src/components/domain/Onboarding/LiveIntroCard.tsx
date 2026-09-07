/**
 * LiveIntroCard — first value before the first question. One live Studio
 * card (INTRO_PRESET's top row for the last trading date) under the VaNi
 * intro, stamped with its date. Renders nothing while loading, on error, or
 * when the scan is empty, so the static intro is the fallback.
 */
import { useIntroRows } from '@/hooks/useOnboardingScans'
import { INTRO_PRESET } from '@/constants/personaConfig'
import { cardDescriptorFor } from '@/config/onboardingCards'
import { StudioCard } from '@/components/domain/BreakoutSurgeTable'
import { getPresetMeta } from '@/services/scanEngine'
import { MONO } from './ui'

export default function LiveIntroCard() {
  const { data } = useIntroRows()
  const stock = data?.[0]
  const descriptor = cardDescriptorFor(INTRO_PRESET)
  if (!stock || !descriptor) return null
  const name = getPresetMeta(INTRO_PRESET)?.name ?? INTRO_PRESET
  return (
    <div data-tour="onboarding-intro-card" style={{ width: 'min(560px, 100%)', margin: '0 auto 24px', textAlign: 'left',
      animation: 'text-in .6s ease 1.15s both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10,
        letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        <span>Live on DristiQ · {name}</span>
        <span>{stock.trade_date ?? ''}</span>
      </div>
      <StudioCard stacked stock={stock} descriptor={descriptor} />
    </div>
  )
}
