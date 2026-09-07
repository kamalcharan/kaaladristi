/**
 * BuildWatch — reloads a stale tab when a newer build is live.
 *
 * The app is a SPA: sign-out → login → sign-up → /setup never fetches a new
 * index.html, so a tab opened before a deploy keeps running the OLD bundle
 * through every one of those steps (2026-09-07: five redeploys of the new
 * onboarding "did nothing" because the test tab was never reloaded).
 *
 * On every route change (throttled) and whenever the tab becomes visible, it
 * fetches /version.json (no-store, written by scripts/write-version.mjs) and
 * hard-reloads when the served SHA differs from the one baked into this
 * bundle. Dev builds ("dev") never reload.
 */
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const RUNNING = import.meta.env.VITE_BUILD_SHA || 'dev'
const MIN_INTERVAL_MS = 30_000

export default function BuildWatch() {
  const location = useLocation()
  const lastCheck = useRef(0)

  useEffect(() => {
    if (RUNNING === 'dev') return
    const check = async () => {
      const now = Date.now()
      if (now - lastCheck.current < MIN_INTERVAL_MS) return
      lastCheck.current = now
      try {
        const res = await fetch(`/version.json?t=${now}`, { cache: 'no-store' })
        if (!res.ok) return
        const { sha } = (await res.json()) as { sha?: string }
        if (sha && sha !== 'dev' && sha !== RUNNING) {
          console.info(`DristiQ build ${sha} is live (running ${RUNNING}) — reloading`)
          window.location.reload()
        }
      } catch { /* offline or blocked — try again on the next navigation */ }
    }
    void check()
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [location.pathname])

  return null
}
