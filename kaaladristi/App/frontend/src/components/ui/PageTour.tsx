// PageTour — the global "?" page-intro launcher, mounted once in the Layout
// topbar. It reads the current route, looks up its intro from the tour
// registry, and (for non-admin, non-workspace pages) renders a launcher that
// auto-starts once per page per user and replays on click.
//
// Keyed by tour id so navigating between pages cleanly tears down one page's
// tour machinery and mounts the next — no lingering overlay across routes.

import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTour } from '@/hooks/useTour'
import TourLauncher from './TourLauncher'
import { getTourForPath, type PageTour as PageTourConfig } from '@/config/tours/registry'

function PageTourInner({ tour, userId }: { tour: PageTourConfig; userId?: string }) {
  const { startTour } = useTour<string>({
    tourId: `page-${tour.id}`,
    steps: tour.steps,
    userId,
    enabled: true,
  })
  return <TourLauncher onClick={() => void startTour()} title="About this page" />
}

export default function PageTour() {
  const location = useLocation()
  const userId = useAuthStore((s) => s.profile?.id)
  const tour = getTourForPath(location.pathname)
  if (!tour) return null
  return <PageTourInner key={tour.id} tour={tour} userId={userId} />
}
