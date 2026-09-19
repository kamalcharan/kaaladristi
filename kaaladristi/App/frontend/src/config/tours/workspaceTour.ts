// Workspace explainer walk — step definitions (data only, no engine logic).
// Copy is observational: describe what each view shows without issuing calls.

export type WorkspaceTab = 'today' | 'discovery' | 'metrics' | 'bookmarks'

export interface TourStep {
  target?: string
  tab?: WorkspaceTab
  title: string
  body: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function buildWorkspaceTourSteps(_opts: { astro: boolean }): TourStep[] {
  return [
    {
      title: 'Welcome to your Workspace',
      body: 'This is your daily decision starting point: market posture, supporting evidence, and what it means for your bookmarked stocks. You can skip anytime and replay it later from the ? button.',
    },
    {
      target: 'today-posture', tab: 'today', title: 'Today’s market posture', side: 'bottom',
      body: 'The breadth gauge turns the market-wide evidence into a clear operating posture. Its direction and score show whether conditions are broadening, selective, or defensive.',
    },
    {
      target: 'today-evidence', tab: 'today', title: 'Evidence behind the posture', side: 'top',
      body: 'Participation, breadth momentum, daily pressure and five-day extremes explain why the current posture was assigned.',
    },
    {
      target: 'today-bookmarks', tab: 'today', title: 'Your stocks in context', side: 'top',
      body: 'Your bookmarked stocks are assessed against today’s market environment using MagicRS and short- versus longer-term flow.',
    },
    {
      target: 'today-market-structure', tab: 'today', title: 'Full market evidence', side: 'top',
      body: 'The participation and momentum histories support the summary above and let you inspect how the current condition developed.',
    },
    {
      target: 'sector-pulse', tab: 'discovery', title: 'Discovery · Sector Pulse', side: 'bottom',
      body: 'See where short-term flow and longer-term strength are concentrated across sectors and industries.',
    },
    {
      target: 'vani-highlights', tab: 'discovery', title: 'VaNi Highlights', side: 'top',
      body: 'Stocks where multiple scanner conditions align, presented as observations for further research.',
    },
    {
      target: 'market-metrics', tab: 'metrics', title: 'Market Metrics', side: 'bottom',
      body: 'Use the headline indices and India VIX as context after Today has established the broader market posture. Astro context will join this view when it is ready.',
    },
    {
      target: 'tour-launcher', title: 'Replay anytime', side: 'bottom',
      body: 'Use this ? button whenever you want to walk through the Workspace again.',
    },
  ]
}
