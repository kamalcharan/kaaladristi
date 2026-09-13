# VaNi main-page intent scope

Agreed launch menu: one automatic default and three follow-ups per mode on `/sector-rotation`. Deferred questions are hidden, not displayed as disabled or coming-soon items. Their frontend definitions, backend handlers and evidence calculations remain in place. Individual-sector detail questions are scoped separately to the selected sector, date, and research mode.

## Required now

| Mode | Automatic default | Follow-ups |
| --- | --- | --- |
| Current Flow | Overall flow (`sector.overview`) | Entering, fading, persistence |
| Longer-Term | Holding strength (`sector.leadership`) | Building, cooling, current-flow comparison |

Personal connections, explanatory cards, cached Qwen/Haiku readings, Consulting VaNi loader, feedback and analytics remain active. Users can return to the default from either menu.

## TODO — deferred separate questions

- [ ] Current Flow: leaving (`sector.leaving`). The overall Discovery component already includes Money Leaving.
- [ ] Current Flow: explain this flow (`sector.read`). Assess whether the existing cards need clearer explanations first.
- [ ] Current Flow: score comparison (`sector.compare`). Existing evidence/definitions remain available.
- [ ] Current Flow: learning (`sector.learn`).
- [ ] Current Flow: taxonomy (`sector.taxonomy`).
- [ ] Longer-Term: persistence (`sector.leadership.persistence`). Run/history evidence remains in the main canvas and relevant readings.
- [ ] Longer-Term: constituent support (`sector.leadership.support`). Support remains part of the underlying classifications and evidence.
- [ ] Longer-Term: learning (`sector.leadership.learn`).

Revisit these after observing beta users complete a research journey without a founder walkthrough: identify a sector, explain what caught their attention, inspect constituents, and optionally save a stock. Use PostHog intent selections and next-step events alongside observation; automatic openings alone do not establish adoption.

The original menu reduction required no migration. The index-detail narrative update now requires deploying the backend too: sector intent version 8 invalidates old cached explanations.

## Index-detail follow-up

- [x] Scope breadth/ROC headings and exact counts to the selected index.
- [x] Use the VaNi mascot loader and distinguish explanation styles visually.
- [x] Give concise, simple and detailed answers distinct narrative instructions; separate history totals from streaks and index counts from constituents.
- [x] Switch short-term flow / longer-term strength without losing the selected session; reuse completed weekly/monthly evidence.
- [ ] Review live model answers for all four detail questions at each depth, including unavailable data and small samples.
- [x] Extend explanation-style controls to longer-term detail stories and explain the separate horizons.
- [ ] Confirm contrast and spacing on every product theme; automated coverage currently includes dark/light at mobile/desktop widths.

Breadth follow-up: chart legends and tooltips now respect fixed versus historical-percentile zones. VaNi receives the same date-bounded zone calculation and Greed caution. The evidence panel groups observations and highlights symbols and values. Live answer review remains pending.

Index-detail horizon menus: short-term activity, horizon agreement, daily-flow persistence and recent stock participation; longer-term agreement, Stage 2 support, completed-week persistence and current-flow comparison. Horizon comparisons reuse the selected-session leadership snapshot and explicitly distinguish Flow 22D from weekly/monthly strength. Main-page launch menus remain unchanged.
