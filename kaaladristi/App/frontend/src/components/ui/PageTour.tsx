// PageTour — the global "?" page-intro launcher, mounted once in the Layout
// topbar. It reads the current route, looks up its intro from the tour
// registry, and (for non-admin, non-workspace pages) renders a launcher that
// auto-starts once per page per user and replays on click.
//
// Keyed by tour id so navigating between pages cleanly tears down one page's
// tour machinery and mounts the next — no lingering overlay across routes.

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTour } from '@/hooks/useTour'
import TourLauncher from './TourLauncher'
import { getTourForPath, type PageTour as PageTourConfig } from '@/config/tours/registry'
import { markGuideWalked, tourRequest } from '@/services/guideProgress'

function PageTourInner({ tour, userId, search }: { tour: PageTourConfig; userId?: string; search: string }) {
  // "Show me" from the Guide: `?tour=1&guide=<key>` starts the walk on this
  // page regardless of whether the user has seen it, and marks the key walked
  // when the tour closes.
  const req = tourRequest(search)
  const guideKey = req?.guideKey ?? null
  const { startTour } = useTour<string>({
    tourId: `page-${tour.id}`,
    steps: tour.steps,
    userId,
    enabled: true,
    autoStart: !req,
    onDone: guideKey ? () => void markGuideWalked(guideKey) : undefined,
  })
  const firedRef = useRef(false)
  useEffect(() => {
    if (!req || firedRef.current) return
    firedRef.current = true
    const t = window.setTimeout(() => void startTour(), 900) // let the page's data land
    return () => window.clearTimeout(t)
  }, [req, startTour])
  return <TourLauncher onClick={() => void startTour()} title="About this page" />
}

export default function PageTour() {
  const location = useLocation()
  const userId = useAuthStore((s) => s.profile?.id)
  const tour = getTourForPath(location.pathname)
  if (!tour) return null
  return <PageTourInner key={tour.id} tour={tour} userId={userId} search={location.search} />
}
