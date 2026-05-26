import { useVisualPulse } from './useVisualPulse'

export const NIFTY_50_ID = 1

export function useNiftyPulse() {
  return useVisualPulse(NIFTY_50_ID)
}
