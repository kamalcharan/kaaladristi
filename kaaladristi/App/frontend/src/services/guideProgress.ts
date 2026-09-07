/**
 * guideProgress — which "Show me" walks the user has taken (migration 204,
 * km_profiles.guide_progress = {"<key>": "YYYY-MM-DD"}). Keys are scan preset
 * ids or GUIDE_PAGES entries ('workspace' | 'chart').
 *
 * A tour is launched by navigating to the real page with `?tour=1&guide=<key>`
 * (components/ui/PageTour.tsx and views/WorkspacePage.tsx honour it) and the
 * tour's onDone marks the key here. Skipping counts as walked — the user has
 * seen the page.
 */
import { updateProfile } from '@/services/auth'
import { useAuthStore } from '@/stores/authStore'
import { GUIDE_PAGES, PERSONA_SCANNERS, type Persona } from '@/constants/personaConfig'

export function guideKeys(persona: Persona): string[] {
  return [...PERSONA_SCANNERS[persona], ...GUIDE_PAGES]
}

export function guideWalkedCount(persona: Persona, progress: Record<string, string> | undefined): number {
  const p = progress ?? {}
  return guideKeys(persona).filter(k => !!p[k]).length
}

/** Parse the tour deep link. Returns null when the URL does not ask for one. */
export function tourRequest(search: string): { guideKey: string | null } | null {
  const q = new URLSearchParams(search)
  if (q.get('tour') !== '1') return null
  return { guideKey: q.get('guide') }
}

export async function markGuideWalked(key: string | null | undefined): Promise<void> {
  if (!key) return
  const { profile, refreshProfile } = useAuthStore.getState()
  if (!profile?.id) return
  const current = profile.guide_progress ?? {}
  if (current[key]) return
  try {
    await updateProfile({ guide_progress: { ...current, [key]: new Date().toISOString().slice(0, 10) } })
    await refreshProfile()
  } catch { /* non-critical — the Guide re-reads on next load */ }
}
