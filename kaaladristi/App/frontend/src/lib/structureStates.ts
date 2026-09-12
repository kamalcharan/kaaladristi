export type StructureState = 'BUILDING' | 'FADING' | 'OUTFLOW' | 'QUIET' | 'MISSING';
export function participationState(value: number | null | undefined, previous: number | null | undefined): StructureState {
  if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous)) return 'MISSING';
  return value > previous ? 'BUILDING' : value < previous ? 'FADING' : 'QUIET';
}
export function momentumState(fast: number | null | undefined, signal: number | null | undefined): StructureState {
  if (fast == null || signal == null || !Number.isFinite(fast) || !Number.isFinite(signal)) return 'MISSING';
  if (fast === 0 || fast === signal) return 'QUIET';
  return fast > signal ? 'BUILDING' : fast > 0 ? 'FADING' : 'OUTFLOW';
}
export function momentumLabel(fast: number | null | undefined, signal: number | null | undefined): string {
  const state = momentumState(fast, signal);
  return state === 'BUILDING' ? (fast! < 0 ? 'Recovering relative to signal' : 'Building')
    : state === 'FADING' ? 'Fading / slowing' : state === 'OUTFLOW' ? 'Contracting'
      : state === 'MISSING' ? 'Unavailable' : 'Quiet';
}
