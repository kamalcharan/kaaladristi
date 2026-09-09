/**
 * flowerPotCards — card-only descriptors for Flower Pot Burst.
 *
 * Owner decision D5 (gap audit §9, 2026-09-07): the Option B+E Studio card
 * becomes THE card, driven by a descriptor per preset. Flower Pot was named as
 * the next one to converge.
 *
 * WHY THESE LIVE HERE AND NOT IN config/scannerStudio.ts
 *
 * Membership of STUDIO_DESCRIPTORS is what routes a preset into
 * views/ScannerStudio.tsx (ScanView reads STUDIO_PRESET_IDS), and it is also
 * what App/backend/lib/scan_contract.py parses for the scanner-integrity
 * contract. Flower Pot must NOT be routed there: the Studio shell renders one
 * flat cohort, and this scanner is three — Bursts, Shatters and Coiling Setups
 * — plus the Live Releases ledger, which has no slot in that shell. Per gap
 * audit §5 the owner ruled the page is not to be unified. So the card
 * converges; the page does not. Same reasoning as config/onboardingCards.ts,
 * which builds card-only descriptors for the setup wizard.
 *
 * WHY THREE DESCRIPTORS AND NOT ONE
 *
 * The hero slot is "the scan's own metric", and Flower Pot's own metric
 * changes with the phase. A coil has no quality score (fpb_quality is NULL
 * until it releases) and a release's tightness is already history — the number
 * that matters is how hard it broke. Owner call: Tightness on coils, Quality
 * on releases.
 *
 * Every label is fieldConfig's own header word for the same column
 * (Tightness / Quality), so the card and the grid read as one scanner — the
 * rule the metric line already follows.
 */

import type { ScanStock } from '@/types'
import type { StudioLevel } from '@/config/scannerStudio'
import type { StudioCardDescriptor } from '@/components/domain/BreakoutSurgeTable'

/**
 * Both level slots on every Flower Pot card, coil and release alike: the
 * 10-day range the coil is compressing inside. It is the scanner's own
 * geometry — the burst gate is `close > hi10_prior` and the shatter gate
 * `close < lo10_prior` — so on a coil the pair reads as the walls it is
 * pressing against, and on a release as the wall it just went through.
 *
 * Projected by migration 205 (fpb_hi10 / fpb_lo10); both read "—" until it is
 * applied, the same way every other Studio's levels did before their arm
 * landed.
 */
const TEN_DAY_RANGE: [StudioLevel, StudioLevel] = [
  { key: 'fpb_hi10', label: '10D High', kind: 'price' },
  { key: 'fpb_lo10', label: '10D Low', kind: 'price' },
]

/** The platform's own thresholds, not fresh ones: 70 is the bar every strength
 *  Studio uses and 30 is is_vani_oversold's. A null RSI passes, matching them. */
const NOT_EXTENDED = { label: 'Not overbought', test: (r: ScanStock) => (r.rsi_14 ?? 0) < 70 }
const NOT_OVERSOLD = { label: 'Not oversold', test: (r: ScanStock) => (r.rsi_14 ?? 100) > 30 }

/** displayName is the card's VaNi pageContext and its empty state. It stays the
 *  SCANNER's name on all three — the phase is already the section heading above
 *  the card, and a pageContext that changed per row would tell VaNi it was
 *  looking at three different pages. */
const DISPLAY_NAME = 'Flower Pot Burst'

/** A coil: still compressing, nothing has happened yet. */
export const FPB_COIL_CARD: StudioCardDescriptor = {
  presetId: 'flower_pot_burst',
  displayName: DISPLAY_NAME,
  side: 'strength',
  cardHero: { key: 'fpb_compression_score', label: 'Tightness', kind: 'score' },
  cardLevels: TEN_DAY_RANGE,
  rsiQuick: NOT_EXTENDED,
}

/** An upward release. Quality combines the volume burst, the range expansion,
 *  the close strength and delivery — fieldConfig: "> 2.5 = strong burst". */
export const FPB_BURST_CARD: StudioCardDescriptor = {
  ...FPB_COIL_CARD,
  cardHero: { key: 'fpb_quality', label: 'Quality', kind: 'score' },
}

/** A downward release. Same hero, mirrored side — so the card's RSI pill reads
 *  "oversold" rather than "overbought" on a stock that has just broken down. */
export const FPB_SHATTER_CARD: StudioCardDescriptor = {
  ...FPB_BURST_CARD,
  side: 'caution',
  rsiQuick: NOT_OVERSOLD,
}

/** The descriptor for one row, chosen by its phase. SETUP (and an unset phase,
 *  which the client-side fallback path can produce) takes the coil card. */
export function fpbCardDescriptor(stock: ScanStock): StudioCardDescriptor {
  if (stock.fpb_phase === 'BURST') return FPB_BURST_CARD
  if (stock.fpb_phase === 'SHATTER') return FPB_SHATTER_CARD
  return FPB_COIL_CARD
}
