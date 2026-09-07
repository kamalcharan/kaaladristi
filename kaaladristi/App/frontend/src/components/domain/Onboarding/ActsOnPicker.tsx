/**
 * ActsOnPicker — "Which of these would you act on?" answered by pointing at
 * a live setup, not a label. One Studio card per option, top row of that
 * option's preset for the last trading date. If a preset fails to load the
 * option degrades to its label + hint so the step never blocks.
 */
import { useIsPhone } from '@/hooks/useMediaQuery'
import { ACTS_ON_IDS, ACTS_ON_OPTIONS, ACTS_ON_PRESETS, type ActsOn } from '@/constants/personaConfig'
import { cardDescriptorFor } from '@/config/onboardingCards'
import { StudioCard } from '@/components/domain/BreakoutSurgeTable'
import { getPresetMeta } from '@/services/scanEngine'
import type { ActsOnRows } from '@/hooks/useOnboardingScans'
import type { ScanStock } from '@/types'
import { MONO } from './ui'

export default function ActsOnPicker({ data, value, onPick }: {
  data: ActsOnRows
  value: ActsOn | null
  onPick: (k: ActsOn, stock: ScanStock | null) => void
}) {
  const phone = useIsPhone()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
      {ACTS_ON_IDS.map(k => {
        const opt = ACTS_ON_OPTIONS[k]
        const presetId = ACTS_ON_PRESETS[k]
        const stock = data.rows[k][0] ?? null
        const descriptor = cardDescriptorFor(presetId)
        const active = value === k
        const presetName = getPresetMeta(presetId)?.name ?? presetId
        return (
          <div key={k} role="button" tabIndex={0} aria-pressed={active}
            onClick={() => onPick(k, stock)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(k, stock) } }}
            style={{ cursor: 'pointer', borderRadius: 14, padding: 12, minWidth: 0,
              background: active ? 'var(--accent-glow)' : 'var(--card)',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all .15s ease', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{presetName}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.45 }}>{opt.hint}</div>
            </div>
            {stock && descriptor ? (
              <div onClick={e => e.stopPropagation()} style={{ minWidth: 0 }}>
                <StudioCard stacked stock={stock} descriptor={descriptor} onClick={() => onPick(k, stock)} />
              </div>
            ) : (
              <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', padding: '10px 0' }}>
                {data.loading && !data.failed[k] ? 'Reading today\'s market…' : 'No live setup today — pick by description.'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
