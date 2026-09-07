/**
 * onboardingCards — card-only descriptors for the setup wizard.
 *
 * The Personality step shows one live row per "act on" option
 * (constants/personaConfig.ts ACTS_ON_PRESETS). Breakout Surge has a full
 * Studio descriptor; Stage 2 Leaders and Quiet Rising Flow do not (they are
 * not Studio pages), so the wizard needs just the slice the card reads —
 * hero, two levels, side and the RSI note. Nothing here feeds a filter bar,
 * an export or lib/scan_contract.py, which is why it lives outside
 * config/scannerStudio.ts.
 *
 * Every slot is a stored ScanStock column (same rule as StudioLevel).
 * Labels reuse fieldConfig / Studio vocabulary — no new directional phrasing.
 */

import type { ScanStock } from '@/types'
import { getStudioDescriptor } from '@/config/scannerStudio'
import type { StudioCardDescriptor } from '@/components/domain/BreakoutSurgeTable'

const notExtended = { label: 'RSI < 70', test: (r: ScanStock) => r.rsi_14 == null || r.rsi_14 < 70 }

const ONBOARDING_CARD_DESCRIPTORS: Record<string, StudioCardDescriptor> = {
  stage_2_leaders: {
    presetId: 'stage_2_leaders',
    displayName: 'Stage 2 Leaders',
    side: 'strength',
    cardHero:   { key: 'pct_from_stage_entry', label: 'Since Stage 2', filterLabel: 'Since S2', kind: 'pct' },
    cardLevels: [
      { key: 'stage_since_close', label: 'Stage 2 entry', kind: 'price' },
      { key: 'w52_high',          label: '52W High',      kind: 'price' },
    ],
    rsiQuick: notExtended,
  },
  quiet_accumulation: {
    presetId: 'quiet_accumulation',
    displayName: 'Quiet Rising Flow',
    side: 'strength',
    cardHero:   { key: 'sniper_inst', label: 'Smart Money', kind: 'count', colorKey: 'sniper_inst' },
    cardLevels: [
      { key: 'ema_20', label: 'EMA 20', kind: 'price' },
      { key: 'sma_50', label: 'SMA 50', kind: 'price' },
    ],
    rsiQuick: notExtended,
  },
}

/** Studio descriptor when the preset has one, else the onboarding card slice. */
export function cardDescriptorFor(presetId: string): StudioCardDescriptor | null {
  return getStudioDescriptor(presetId) ?? ONBOARDING_CARD_DESCRIPTORS[presetId] ?? null
}
