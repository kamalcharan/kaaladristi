/**
 * uxEvents — the two onboarding numbers we measure (migration 204,
 * km_ux_events): time to first bookmark and day-two return. Nothing else is
 * recorded here on purpose (docs/claude/onboarding-poa.md "Measure").
 *
 * Fire-and-forget: a failure never surfaces to the user. Each event fires
 * once per user — the table has UNIQUE (user_id, event), and a localStorage
 * flag saves the round trip on later calls.
 */

import { from } from '@/services/postgrest'
import { useAuthStore } from '@/stores/authStore'

export type UxEvent = 'first_bookmark' | 'day2_return'

const flagKey = (event: UxEvent, userId: string) => `kd_ux_${event}_${userId}`

function flagged(event: UxEvent, userId: string): boolean {
  try { return !!localStorage.getItem(flagKey(event, userId)) } catch { return false }
}
function flag(event: UxEvent, userId: string) {
  try { localStorage.setItem(flagKey(event, userId), new Date().toISOString()) } catch { /* ignore */ }
}

export function recordUxEvent(event: UxEvent, payload: Record<string, unknown> = {}): void {
  const userId = useAuthStore.getState().profile?.id
  if (!userId || flagged(event, userId)) return
  void from('km_ux_events')
    .insert({ user_id: userId, event, payload })
    .execute()
    .then(({ error }) => {
      // A unique-violation means it was recorded earlier from another device — same outcome.
      if (!error || /409|duplicate|unique/i.test(error.message)) flag(event, userId)
    })
    .catch(() => { /* non-critical */ })
}

/**
 * day2_return: the user came back 1–3 days after setting their persona.
 * Called from the Workspace page on mount; a no-op outside that window.
 */
export function maybeRecordDay2Return(personaSetAt: string | null | undefined): void {
  if (!personaSetAt) return
  const days = (Date.now() - new Date(personaSetAt).getTime()) / 86_400_000
  if (days >= 1 && days <= 3) recordUxEvent('day2_return', { days: Math.round(days * 10) / 10 })
}
