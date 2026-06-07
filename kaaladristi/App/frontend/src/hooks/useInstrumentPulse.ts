import { useVisualPulse } from './useVisualPulse'
import { useEquityVisualPulse } from './useEquityVisualPulse'

/**
 * Unified pulse hook — routes to useVisualPulse or useEquityVisualPulse
 * based on instrument type. Both inner hooks are always called (React rules),
 * null-gated so only the active one fetches.
 */
export function useInstrumentPulse(
  id: number | null,
  type: 'index' | 'equity' | null,
) {
  const indexPulse  = useVisualPulse(type === 'index'  ? id : null)
  const equityPulse = useEquityVisualPulse(type === 'equity' ? id : null)
  return type === 'equity' ? equityPulse : indexPulse
}
