// useTour — thin React wrapper around driver.js for page explainer walks.
//
// Responsibilities:
//   · build a driver.js instance from TourStep[] data (config/tours/*)
//   · tab-aware navigation: switch the host page's tab, wait for the target
//     element to mount, THEN move — steps whose element never appears are
//     skipped silently (e.g. widget removed from the user's framework)
//   · SERVER-BACKED once-per-user persistence (km_profiles.tours_seen, jsonb
//     map { tourId: isoTs }, migration 167). Previously the flag lived only
//     in localStorage keyed by user, which meant every new browser / device /
//     incognito / evicted-storage session re-fired the walk — reported as
//     "guided walk shows every login". localStorage is kept as an instant
//     cache to avoid a flash between mount and the first profile hydrate.
//   · Auto-start is suppressed when profile.guided_tours_enabled === false
//     (user opted out during onboarding). The `?` launcher still replays
//     any tour on demand — this only disables the AUTO fire.
//   · Auto-start sequenced AFTER the welcome modal is acknowledged (listens
//     for the 'kd:welcome-acked' window event).
//
// The popover is skinned with theme tokens in styles/tour.css (.kd-tour-popover).

import { useCallback, useEffect, useRef } from 'react'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/styles/tour.css'
import type { TourStep } from '@/config/tours/workspaceTour'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/auth'

const seenKey = (tourId: string, userId: string) => `kd_tour_${tourId}_${userId}`
const welcomeAckKey = (userId: string) => `kd_welcome_ack_${userId}`

/** Poll for a selector to appear (post tab-switch render). */
function waitForElement(selector: string, timeoutMs = 2000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector)
    if (found) return resolve(found)
    const t0 = performance.now()
    const iv = window.setInterval(() => {
      const el = document.querySelector(selector)
      if (el || performance.now() - t0 > timeoutMs) {
        window.clearInterval(iv)
        resolve(el)
      }
    }, 60)
  })
}

interface UseTourOptions<Tab extends string> {
  tourId: string
  steps: TourStep[]
  userId?: string
  /** Host page readiness gate — auto-start only fires once this is true. */
  enabled?: boolean
  /** Auto-start on first visit (after welcome-modal ack). Default true. */
  autoStart?: boolean
  /** Called before a step that lives on another tab; must trigger the tab render. */
  onTabChange?: (tab: Tab) => void
}

export function useTour<Tab extends string>(opts: UseTourOptions<Tab>) {
  const { tourId, steps, userId, enabled = true, autoStart = true, onTabChange } = opts

  // Reactive slices of the auth profile — hasSeen re-evaluates the moment the
  // profile hydrates, so an unseen tour on a fresh session still auto-fires
  // once the profile lands (see effect below with `profileReady` in deps).
  const toursSeen           = useAuthStore((s) => s.profile?.tours_seen)
  const guidedToursEnabled  = useAuthStore((s) => s.profile?.guided_tours_enabled)
  const profileReady        = useAuthStore((s) => s.profile != null)
  const refreshProfile      = useAuthStore((s) => s.refreshProfile)

  const driverRef = useRef<Driver | null>(null)
  // live refs so the driver callbacks never close over stale props / state
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const onTabChangeRef = useRef(onTabChange)
  onTabChangeRef.current = onTabChange
  const toursSeenRef = useRef(toursSeen)
  toursSeenRef.current = toursSeen

  const hasSeen = useCallback((): boolean => {
    if (!userId) return true
    // DB is truth: profile.tours_seen[tourId] set ⇒ done, on any device.
    if (toursSeen && toursSeen[tourId]) return true
    // localStorage is a per-device cache — treat as seen if present so the
    // walk doesn't flash before the profile hydrates on a slow network.
    try { if (localStorage.getItem(seenKey(tourId, userId))) return true } catch { /* ignore */ }
    return false
  }, [tourId, userId, toursSeen])

  const markSeen = useCallback(() => {
    if (!userId) return
    const now = new Date().toISOString()
    // 1. Instant-cache: writes even if the network is dead so a page refresh
    //    doesn't re-fire the tour while the DB write is in flight.
    try { localStorage.setItem(seenKey(tourId, userId), now) } catch { /* ignore */ }
    // 2. Server truth: full-object write (no partial-key jsonb merge on the
    //    backend). Concurrent tab races are effectively impossible — a user
    //    can't complete two different tours in the same millisecond.
    const next = { ...(toursSeenRef.current ?? {}), [tourId]: now }
    updateProfile({ tours_seen: next })
      .then(() => refreshProfile())
      .catch((err) => console.warn('[useTour] tours_seen persist failed:', err))
  }, [tourId, userId, refreshProfile])

  /**
   * Prepare step `index` (switch tab, wait for mount). Walks forward/backward
   * past steps whose element never appears. Returns the reachable index or null.
   */
  const prepareStep = useCallback(async (index: number, dir: 1 | -1): Promise<number | null> => {
    const all = stepsRef.current
    for (let i = index; i >= 0 && i < all.length; i += dir) {
      const step = all[i]
      if (!step.target) return i // centered step — always reachable
      if (step.tab) onTabChangeRef.current?.(step.tab as Tab)
      const el = await waitForElement(`[data-tour="${step.target}"]`)
      if (el) return i
    }
    return null
  }, [])

  const startTour = useCallback(async () => {
    driverRef.current?.destroy()

    const driveSteps: DriveStep[] = stepsRef.current.map((s) => ({
      // element resolved lazily — the target may mount only after a tab switch
      element: s.target ? () => document.querySelector(`[data-tour="${s.target}"]`) as Element : undefined,
      popover: {
        title: s.title,
        description: s.body,
        side: s.side,
      },
    }))

    const d = driver({
      steps: driveSteps,
      popoverClass: 'kd-tour-popover',
      overlayOpacity: 0.65,
      stagePadding: 6,
      smoothScroll: true,
      allowClose: true,
      disableActiveInteraction: true,
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done',
      onNextClick: () => {
        const at = d.getActiveIndex()
        if (at == null) return d.destroy()
        if (at >= stepsRef.current.length - 1) return d.destroy()
        void prepareStep(at + 1, 1).then((idx) => (idx == null ? d.destroy() : d.moveTo(idx)))
      },
      onPrevClick: () => {
        const at = d.getActiveIndex()
        if (at == null || at <= 0) return
        void prepareStep(at - 1, -1).then((idx) => (idx == null ? undefined : d.moveTo(idx)))
      },
      onDestroyed: () => {
        markSeen() // skipped or completed — either way, don't nag again
        driverRef.current = null
      },
    })

    driverRef.current = d
    const first = await prepareStep(0, 1)
    if (first != null) d.drive(first)
  }, [markSeen, prepareStep])

  // ── First-visit auto-start, sequenced after the beta welcome modal ──
  useEffect(() => {
    if (!autoStart || !enabled || !userId) return
    // Wait for the profile to hydrate before deciding — hasSeen() would
    // otherwise return false during the pre-profile window and re-fire the
    // walk on every full reload for a user who's already completed it.
    if (!profileReady) return
    // User opted out during onboarding → the ? launcher still works but we
    // never auto-fire. This is the single "off switch" that suppresses every
    // page tour globally without needing to seed tours_seen for each id.
    if (guidedToursEnabled === false) return
    if (hasSeen()) return

    let timer: number | undefined
    const begin = (delay: number) => { timer = window.setTimeout(() => void startTour(), delay) }

    let acked = true
    try { acked = !!localStorage.getItem(welcomeAckKey(userId)) } catch { /* treat as acked */ }

    if (acked) {
      begin(700) // let the page settle
      return () => window.clearTimeout(timer)
    }
    const onAck = () => begin(450)
    window.addEventListener('kd:welcome-acked', onAck)
    return () => {
      window.removeEventListener('kd:welcome-acked', onAck)
      window.clearTimeout(timer)
    }
  }, [autoStart, enabled, userId, profileReady, guidedToursEnabled, hasSeen, startTour])

  // unmount safety — never leave a dangling overlay on route change
  useEffect(() => () => { driverRef.current?.destroy() }, [])

  return { startTour, hasSeen }
}
