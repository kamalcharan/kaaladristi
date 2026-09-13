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

No migration or backend change is needed for this menu reduction. Pull/build the frontend. Existing backend version 5 remains compatible.
