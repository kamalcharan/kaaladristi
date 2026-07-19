// Workspace explainer walk — step definitions (data only, no engine logic).
//
// Each step anchors to a `data-tour="<target>"` attribute in WorkspacePage.
// `tab` tells the tour engine which Workspace tab must be active before the
// element can exist — the engine switches tabs and waits for the element to
// mount. A step whose element never appears (widget removed, slow data) is
// skipped, never breaks the walk.
//
// Copy rules (D39 / SEBI): observational voice only — describe what a widget
// SHOWS, never what to buy/sell or where price is headed.

export type WorkspaceTab = 'today' | 'discovery' | 'myspace' | 'bookmarks'

export interface TourStep {
  /** data-tour anchor value. Omit for a centered (element-less) step. */
  target?: string
  /** Workspace tab that must be active for the target to exist. */
  tab?: WorkspaceTab
  title: string
  body: string
  /** Preferred popover side (driver.js auto-repositions if it doesn't fit). */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function buildWorkspaceTourSteps(opts: { astro: boolean }): TourStep[] {
  const steps: TourStep[] = [
    {
      // centered welcome — no element
      title: 'Welcome to your Workspace',
      body: 'This is your daily starting point — market weather, breadth, and the astro layer in one place. A 60-second walk through what each panel shows. You can skip anytime and replay it later from the ? button.',
    },
    {
      target: 'ticker-rail',
      tab: 'today',
      title: 'Index cards',
      body: 'NIFTY 50, BANK, 500 and India VIX at a glance — last close, day change, and a micro-trend. The quickest read of how the broad market closed.',
      side: 'bottom',
    },
    {
      target: 'breadth-controls',
      tab: 'today',
      title: 'One selector, three views',
      body: 'This switch drives everything below it — breadth rotation, the breadth chart, and momentum — for NIFTY 50, 500 or BANK. "Open Market Breadth" goes to the full structure page.',
      side: 'bottom',
    },
    {
      target: 'breadth-rotation',
      tab: 'today',
      title: 'How breadth is moving',
      body: 'A read on participation: how many stocks in the chosen index are trading above their key averages, and which way that count has been rotating recently.',
      side: 'top',
    },
    {
      target: 'breadth-charts',
      tab: 'today',
      title: 'Breadth & momentum',
      body: 'Left: the breadth series itself with its historical zone. Right: its rate of change — whether participation is expanding, slowing or contracting. These describe conditions, not predictions.',
      side: 'top',
    },
  ]

  if (opts.astro) {
    // insert the astro row between rotation and the charts (matches page order)
    steps.splice(4, 0, {
      target: 'astro-row',
      tab: 'today',
      title: 'The astro layer',
      body: 'Today’s Panchangam alongside the current planetary regime. Kāla-Drishti pairs this layer with market data so you can see when astronomical windows and market conditions have historically coincided.',
      side: 'top',
    })
  }

  steps.push(
    {
      target: 'sector-pulse',
      tab: 'discovery',
      title: 'Discovery · Sector Pulse',
      body: 'Where money has been rotating — sectors ranked by the score framework, with rotation verdicts. A map of participation across the market, updated daily.',
      side: 'bottom',
    },
    {
      target: 'vani-highlights',
      tab: 'discovery',
      title: 'VaNi Highlights',
      body: 'Stocks flagged ✦ across all scanners in one board. VaNi is the AI layer — it explains conditions in plain language, and never issues trade calls.',
      side: 'top',
    },
    {
      target: 'workspace-canvas',
      tab: 'myspace',
      title: 'My Space — yours to build',
      body: 'A grid you compose yourself: add or remove blocks, widgets and astro overlays from the Catalog. What you save here becomes your personal framework.',
      side: 'bottom',
    },
    {
      target: 'tour-launcher',
      title: 'Replay anytime',
      body: 'That’s the walk. This ? button replays it whenever you want a refresher. Explore at your own pace.',
      side: 'bottom',
    },
  )

  return steps
}
