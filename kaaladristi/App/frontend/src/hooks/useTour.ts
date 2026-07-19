// useTour — thin React wrapper around driver.js for page explainer walks.
//
// Responsibilities:
//   · build a driver.js instance from TourStep[] data (config/tours/*)
//   · tab-aware navigation: switch the host page's tab, wait for the target
//     element to mount, THEN move — steps whose element never appears are
//     skipped silently (e.g. widget removed from the user's framework)
//   · once-per-user persistence (localStorage, same precedent as
//     BetaWelcomeModal) + auto-start sequenced AFTER the welcome modal is
//     acknowledged (listens for the 'kd:welcome-acked' window event)
//
// The popover is skinned with theme tokens in styles/tour.css (.kd-tour-popover).

import { useCallback, useEffect, useRef } from 'react'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/styles/tour.css'
import type { TourStep } from '@/config/tours/workspaceTour'

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

  const driverRef = useRef<Driver | null>(null)
  // live refs so the driver callbacks never close over stale props
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const onTabChangeRef = useRef(onTabChange)
  onTabChangeRef.current = onTabChange

  const hasSeen = useCallback((): boolean => {
    if (!userId) return true
    try { return !!localStorage.getItem(seenKey(tourId, userId)) } catch { return true }
  }, [tourId, userId])

  const markSeen = useCallback(() => {
    if (!userId) return
    try { localStorage.setItem(seenKey(tourId, userId), new Date().toISOString()) } catch { /* ignore */ }
  }, [tourId, userId])

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
    if (!autoStart || !enabled || !userId || hasSeen()) return

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
  }, [autoStart, enabled, userId, hasSeen, startTour])

  // unmount safety — never leave a dangling overlay on route change
  useEffect(() => () => { driverRef.current?.destroy() }, [])

  return { startTour, hasSeen }
}
