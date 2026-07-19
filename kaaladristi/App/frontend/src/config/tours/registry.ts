// Page-intro tour registry — one concise intro walk per non-admin page.
//
// Workspace is intentionally absent: it self-manages a richer, tab-aware
// spotlight tour (config/tours/workspaceTour.ts + its own launcher). Admin/ops
// pages (users, data-pipeline, admin/panchang, custom-index management) are
// deliberately excluded.
//
// These use centered steps (no `target`) by design — a page intro that
// describes what the page is for and the key idea, with zero per-element
// anchors to drift. Copy stays observational (D39 / SEBI): describe what a
// page SHOWS, never a buy/sell/target.

import type { TourStep } from './workspaceTour'

export interface PageTour {
  /** Stable id → localStorage key (kd_tour_<id>_<userId>). */
  id: string
  /** First-match wins; order specific → generic in the PAGE_TOURS list. */
  match: (pathname: string) => boolean
  steps: TourStep[]
}

const eq = (p: string) => (path: string) => path === p
const pre = (p: string) => (path: string) => path.startsWith(p)

// Order matters — more specific paths first.
export const PAGE_TOURS: PageTour[] = [
  {
    id: 'catalog', match: eq('/catalog'),
    steps: [
      { title: 'The Catalog', body: 'Every building block in one place — master frameworks, astro rules, indicators, widgets and scanners. This is where you assemble what your Workspace shows.' },
      { title: 'Browse, then add', body: 'Open any item for a deep-dive, then add it to your framework. What you activate here appears on your Workspace canvas.' },
    ],
  },
  {
    id: 'sector-rotation-detail', match: pre('/sector-rotation/'),
    steps: [
      { title: 'Index detail', body: 'A closer look at one index — its constituents, the flow map of where money is moving inside it, breadth, and an auto-composed synthesis read.' },
      { title: 'Observational', body: 'Everything here describes current conditions and history — not a call on where price is headed.' },
    ],
  },
  {
    id: 'sector-rotation', match: eq('/sector-rotation'),
    steps: [
      { title: 'Sector Rotation', body: 'How money is rotating across NSE sectors and indices on a return clock (5D / 22D / 66D). Greener reads as rotating in, redder as rotating out.' },
      { title: 'Drill in', body: 'Open any row for its constituents and flow map. Custom themed baskets appear here alongside the standard indices.' },
    ],
  },
  {
    id: 'correlation', match: pre('/correlation/'),
    steps: [
      { title: 'Correlation', body: 'How two instruments — or an astro rule and an instrument — have moved together historically. A study of co-occurrence, strictly observational.' },
    ],
  },
  {
    id: 'markets', match: eq('/markets'),
    steps: [
      { title: 'Markets', body: 'The full NSE / BSE universe — indices and equities, searchable, with each instrument’s key signals at a glance.' },
    ],
  },
  {
    id: 'inference', match: eq('/inference'),
    steps: [
      { title: 'Inference', body: 'The planetary DC (Dasha Cycle) inference rules and how they map to market conditions — the research layer behind the astro reads.' },
    ],
  },
  {
    id: 'rule-eval', match: eq('/rule-eval'),
    steps: [
      { title: 'Rule Eval', body: 'Inspect how an astro rule has behaved against historical market data — matches, windows, and measured outcomes. Backtesting, not forecasting.' },
    ],
  },
  {
    id: 'astro-calendar', match: eq('/astro-calendar'),
    steps: [
      { title: 'Astro Calendar', body: 'Upcoming panchang and planetary events on a monthly calendar, each tagged with its historically-observed market character.' },
    ],
  },
  {
    id: 'study', match: pre('/chart/'),
    steps: [
      { title: 'Study', body: 'Your decision workbench for a single instrument: Read the snapshot, weigh the Evidence, and verify on the Chart with your own overlays, timeframes and zoom.' },
      { title: 'Verify, don’t obey', body: 'Study surfaces the conditions and lets you check them yourself — it never tells you to buy or sell.' },
    ],
  },
  {
    id: 'pulse-equity', match: pre('/pulse/equity/'),
    steps: [
      { title: 'Visual Pulse — Equity', body: 'A 5-second visual read of one stock: every indicator maps to a real-world metaphor so you can glance the state, plus Magic RS zones, pump/dump watch, scan presence and industry context.' },
      { title: 'A glance, not a verdict', body: 'The metaphors summarise conditions quickly — dig into Study when you want the full evidence.' },
    ],
  },
  {
    id: 'pulse', match: pre('/pulse/'),
    steps: [
      { title: 'Visual Pulse', body: 'A metaphor-driven, 5-second read of this index. Each indicator becomes a real-world visual — signal tower, zones, dials — for a fast go / no-go glance.' },
    ],
  },
  {
    id: 'intraday', match: pre('/intraday/'),
    steps: [
      { title: 'Intraday Cockpit', body: 'A time-aware decision page for the session: the panchang timeline (09:15–15:30), a confluence dial, and the conflict engine reconciling technicals, panchang and planets.' },
      { title: 'Time-aware', body: 'Rahu and Abhijit windows, next-event resolver and verdict update live through the trading day.' },
    ],
  },
  {
    id: 'scanner', match: pre('/scanner'),
    steps: [
      { title: 'Scanner', body: 'Nine observational presets over the market — strength and weakness confluence, smart-money loading, fresh breakouts, quiet accumulation, and more.' },
      { title: 'Sort, filter, export', body: 'Filter by exchange and timeframe, sort any column, and export a preset to TradingView. Each preset surfaces conditions — it doesn’t issue trades.' },
    ],
  },
  {
    id: 'bookmarks', match: eq('/bookmarks'),
    steps: [
      { title: 'My Bookmarks', body: 'The stocks you’ve saved, together with live price, the scanner tags they carry, and their sector status — your personal watchlist.' },
    ],
  },
  {
    id: 'manipulation-watch', match: eq('/manipulation-watch'),
    steps: [
      { title: 'Manipulation Watch', body: 'Stocks showing pump or dump signatures from volume, delivery and price divergence. Surfaced for awareness — a flag to look closer, not an accusation.' },
    ],
  },
  {
    id: 'industry-transition', match: eq('/industry-transition'),
    steps: [
      { title: 'Industry Transition', body: 'Which industries are rotating into or out of leadership, ranked by structural relative strength across their constituents.' },
    ],
  },
  {
    id: 'market-structure', match: eq('/market-structure'),
    steps: [
      { title: 'Market Structure', body: 'The breadth and regime view of the whole market — today’s structure and the historical confluence of breadth, momentum and time cycles.' },
    ],
  },
  {
    id: 'planetary-intel', match: eq('/planetary-intel'),
    steps: [
      { title: 'Planetary Intel', body: 'The current sky — live planetary positions and transits, and the market windows they historically open. Reference, not prediction.' },
    ],
  },
  {
    id: 'panchang', match: eq('/panchang'),
    steps: [
      { title: 'Panchang', body: 'The full daily Vedic almanac — tithi, vara, nakshatra, yoga and karana — with the day’s astro read for the market.' },
    ],
  },
  {
    id: 'rules-detail', match: pre('/rules/'),
    steps: [
      { title: 'Rule detail', body: 'This rule’s conditions, its historical matches, and per-benchmark confidence from backtesting against real closes.' },
    ],
  },
  {
    id: 'rules', match: eq('/rules'),
    steps: [
      { title: 'Rules', body: 'The astro rule library, each with a confidence score measured from historical backtesting. Observational research — never a trading signal.' },
    ],
  },
  {
    id: 'pricing', match: eq('/pricing'),
    steps: [
      { title: 'Plans', body: 'A 14-day trial and an annual plan, with GST shown upfront. During beta you have full founding-member access — no payment needed.' },
    ],
  },
  {
    id: 'account', match: eq('/account'),
    steps: [
      { title: 'Account', body: 'Your profile, security and plan. Update your details, change your password, and see your access status here.' },
    ],
  },
  {
    id: 'settings', match: eq('/settings'),
    steps: [
      { title: 'Settings', body: 'Your theme, colour mode and preferences — all saved to your account so they follow you across devices.' },
    ],
  },
]

/** First matching page tour for a pathname, or null (admin/unknown/workspace). */
export function getTourForPath(pathname: string): PageTour | null {
  if (pathname === '/workspace') return null // self-managed
  return PAGE_TOURS.find((t) => t.match(pathname)) ?? null
}
