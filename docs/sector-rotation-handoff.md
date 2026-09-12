# Sector Rotation adoption and mobile upgrade

Scope: `/sector-rotation`, `/sector-rotation/:indexId`, their VaNi companion,
and compact Flow 5D / Flow 22D naming in shared scanner and table surfaces.

## What changed

- The table and index detail now use the same score-state classifier as
  Discovery and Flow Map: Strong, Building, Fading, Outflow, Quiet. Missing
  scores remain unavailable. Index and constituent thresholds remain distinct.
- Five constituents enable breadth and ROC; five to seven show a small-sample
  caption. The conflicting eight-stock chart restriction is removed.
- Detail histories, constituent data and price context are bounded by the
  displayed session. A historical URL carries `?asof=YYYY-MM-DD`. The price
  chart loads a year ending at that session. Category heatmaps use market
  sessions; constituent maps use the selected index's sessions.
- Both maps retain latest-first dates and offer visible Newer/Older controls,
  touch/keyboard cell details and fixed row labels. Large flow reads paginate
  rather than relying on the PostgREST response cap. Multi-column ordering
  is emitted as one order parameter to keep those pages deterministic.
- Mobile users get compact index and constituent cards with expandable
  details, bookmarks, wrapping controls and a modal VaNi sheet. Desktop users
  retain the tables and a docked companion.
- Flow-score concentration is explicitly distinguished from contribution to
  index price return. Missing constituent data yields an incomplete-coverage
  explanation rather than a definitive narrow-participation verdict.
- Money Flow Trend has dates and clearer line identities; being above the
  longer baseline no longer claims day-over-day acceleration. Price Context
  remains a secondary tab. Index participation history labels 20 EMA, 50 SMA
  and 150 SMA correctly.

## VaNi

The existing `/api/vani/ask` handles versioned `sector.*` intents:

- `sector.context`: read-only authoritative evidence; no LLM.
- `sector.learn`, `sector.taxonomy`: educational content; no LLM.
- `sector.read`, `sector.compare`, `sector.persistence`,
  `sector.participation`: grounded synthesis, Qwen first with the existing
  explicitly enabled cloud fallback (Haiku under the current default config).

Snapshots include actual data, selected date, category/index and history
window. Same-session corrections invalidate the snapshot. Generation checks
the snapshot before invoking the model. Persistent cache and single-flight
locking reuse the Market Structure implementation. Cache hits and generated
answers are logged for the existing feedback control. The client shows
“Consulting VaNi…” for at least 450 ms, including browser-cache hits.

The older automatically generated sector insight card is removed from these
pages, so it does not create a second model path beside the companion.

## Deployment and boundaries

Pull/build **both frontend and backend** from the feature branch. Restart the
API with the updated backend. No new database migration is introduced. The
sector evidence loader uses the existing direct PostgreSQL client and tables,
including `km_index_breadth` from migration 203; configure `DATABASE_URL` as in
the existing VPS deployment. A PostgREST-only backend is not supported by this
new evidence loader.

Scoring formulas and calibrated classification thresholds are preserved.
History uses current recorded index membership, not historical rebalancing.
The category page's India VIX card is explicitly labelled as its latest
snapshot and includes its own date.

## Validation

- `python -m unittest test_sector_vani test_market_structure_vani`: 27 tests.
- `node scripts/qa/check-sector-contracts.mjs`: browser/server classification,
  missing data, concentration, 600-constituent pagination, historical bounds,
  readable dates, query ordering and minimum count.
- `node scripts/qa/check-market-structure.mjs`: prior feature regression.
- `npm run typecheck` and `npm run build` (includes theme/persona checks).
- `scripts/qa/check-sector-ui.mjs`: actual route components against synthetic
  responses at 320/390/768/1440 px in light/dark mode. Checks table/card layout,
  map scrolling, cell taps, five-stock breadth, modal VaNi, cached-answer loader,
  price context and historical date changes. All external requests are blocked.

For UI checks, run Vite on loopback port 4318, then run the script. It uses
Chrome by default; `SECTOR_QA_BROWSER` can specify another Chromium executable.
Temporary QA entry files are removed in `finally`. Screenshots go into ignored
`node_modules/.cache/sector-qa` unless `SECTOR_QA_OUTPUT` is supplied.

No live VPS model invocation or production data audit was performed. Please
verify the deployed model/fallback, production data and user permissions when
testing locally against your environment. Existing build warnings concern
bundle size, Browserslist age and an ambiguous pre-existing Tailwind class.

## Default listing intent follow-up

The listing route automatically opens `sector.overview`: Discovery-style Money Entering (Strong + Building), Fading and Money Leaving (Outflow) cards, up to three linked examples per group with expandable lists and mini-trends. Quiet and unavailable coverage remain separate. The default is inline on mobile. Other questions are available under Explore another question; index-detail defaults are unchanged.

The overview prompt receives only computed group balance and requests at most two short sentences, without index-by-index narration. Existing Qwen-first routing, configured fallback, cache, feedback and the visible loading state are reused. Raw evidence paragraphs are hidden for this intent. Frontend and backend must be updated together. Automated UI checks now also verify default opening and evidence visibility.

## Overall flow parity correction

The default now ignores the active tab, table date and history selection. It uses the latest completed session, Sectoral + Curated coverage and 22 sessions of history, matching Discovery's intended overall scope. Both clients use `fetchSectorPulseContext` and the new read-only `sector.pulse.context` endpoint (no LLM invocation). The overview narration validates that same snapshot. Frontend and backend must be updated together.

Discovery no longer substitutes an older index reading when the current session is missing. Both views classify current-session records with the same missing-data handling. Entering/fading sort by Flow 5D descending; leaving sorts by 5D return ascending; name breaks ties. Tests cover tab-independent snapshots, stale-row exclusion and Discovery/VaNi record-and-signal parity. Live database values still need local verification.
