# Flower Pot VaNi result actions

The five existing intents retain the shared VaNi shell. New coils, top coiling industries and RS comparison groups now return database equity IDs alongside the narrative. Their links select that cohort in Flower Pot results. Recent outcomes opens the exact 180-day release records used by the explanation, with stock-chart links. Tightness remains educational.

URL parameters: fpb_intent, fpb_group, fpb_asof, exchange. A reload restores the cohort by querying the endpoint again. The date is a validation guard, not a historical query: unavailable old sessions fail visibly. Outcomes are current recorded statuses, not a historical status snapshot. Additional local filters can narrow the displayed cohort and can be cleared; arbitrary table filter settings are not serialized.

The new-coils query remains NSE compression evidence; some returned stocks may be outside the current materialized scan. Displayed and evidence counts are separate. Missing cohort contracts and service/model failures raise errors rather than presenting empty success.

Confluence compares with the fifth preceding market session, excludes missing RS, and separates positive and negative changes. Groups are the top three on each side, not an exhaustive list or a new VaNi eligibility rule. Narratives cache against the evidence and prompt.

Validation: test_fpb_actions.py; check-fpb-actions.mjs (light/dark, 390/1440, links, URL reload, outcomes, old-session rejection); frontend typecheck and production build. Live PostgreSQL and model integration require VPS verification. No migration required; deploy frontend and backend together.
