/**
 * TryItSort — the wizard's hands-on moment. Three live cards from the intro
 * preset and the same sort chips the Scanner Studio uses; tapping a chip
 * re-orders the cards. "I was shown" becomes "I did".
 */
import { useMemo, useState } from 'react'
import { useIntroRows } from '@/hooks/useOnboardingScans'
import { INTRO_PRESET } from '@/constants/personaConfig'
import { getStudioDescriptor, cardSortOptions, sortForCards } from '@/config/scannerStudio'
import { StudioCard } from '@/components/domain/BreakoutSurgeTable'
import type { ScanStock } from '@/types'
import { Chip, SectionLabel } from './ui'

export default function TryItSort() {
  const { data } = useIntroRows()
  const descriptor = getStudioDescriptor(INTRO_PRESET)
  const options = useMemo(() => cardSortOptions(descriptor).slice(0, 4), [descriptor])
  const [key, setKey] = useState<keyof ScanStock>(descriptor?.sort.key ?? 'score_5d')
  const rows = useMemo(() => sortForCards(data ?? [], key, key === 'symbol' ? 'asc' : 'desc').slice(0, 3), [data, key])
  if (!descriptor || rows.length === 0) return null
  return (
    <div data-tour="onboarding-try-it" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel style={{ marginBottom: 0 }}>Try it — sort today's {descriptor.displayName}</SectionLabel>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => (
          <Chip key={String(o.key)} active={key === o.key} onClick={() => setKey(o.key)} style={{ padding: '6px 11px', fontSize: 12 }}>
            {o.label}
          </Chip>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(s => <StudioCard stacked key={s.equity_id} stock={s} descriptor={descriptor} />)}
      </div>
    </div>
  )
}
