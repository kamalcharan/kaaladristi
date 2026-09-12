# Market Structure and VaNi: local review

This branch implements the first page of the adoption upgrade. Market Structure
has a dedicated VaNi companion; existing Workspace, scanner and chart intent
experiences remain in place. No deployment or database migration is included.

## What changed

- VaNi opens with a reading of the selected market snapshot, explanation-depth
  controls, explicit follow-up questions, expandable evidence, and a replayable
  three-step walkthrough. On smaller screens the companion starts collapsed.
- `/guide` includes Market Structure alongside the existing persona-based walks.
  Completion uses the existing profile progress service; dismissal is also
  remembered locally. The existing guide convention counts skipping as walked.
- Eight versioned intents distinguish live readings from fixed education.
  Definitions bypass the LLM. Live requests validate their snapshot against the
  database and supply precomputed comparisons to the model.
- The persistent VaNi cache keys include intent version, explanation depth,
  period and exact data snapshot. Same-date corrections change the key. Requests
  sharing a key reuse generation locally; direct PostgreSQL connections also
  coordinate across workers. PostgREST-only deployments deduplicate within each
  process. A busy PostgreSQL worker prompts automatic client polling.
- New Market Structure intents explicitly opt into Qwen-first, configured cloud
  fallback. This corrects a mismatch with the discussed architecture: the existing
  `prefer_local` path previously stopped after Qwen failure. Older callers retain
  that default. Your configured cloud provider/model must point to Haiku.
- Cached responses receive their own interaction log on API requests. Feedback
  is available for cached answers and is only marked saved after server success.
- Breadth percentages are prominent. Existing score calculations, Fear <35,
  Greed >55, and the 22D/44D/66D chart controls are retained. Both charts, history
  and VaNi share the selection.
- Fear/Greed zones use neutral styling; their contrarian interpretation is
  explained separately. Numerical history replaces window-relative intensity
  on this page. Its condition colors reuse the Flowmap palette: participation
  compares with the preceding available session; ROC 13 compares with its signal.
  Positive ROC below signal is amber. Negative ROC above signal is green recovery,
  explicitly described as still negative. Missing data is distinct from zero.
- Sector Rotation receives a research-context banner when opened from VaNi.
  It retains its own date selector; the banner asks users to check dates before
  comparing. It does not silently change the sector data to match another series.

## Local acceptance checklist

1. Run the updated frontend and API together using the existing environment.
   Existing cache, guide-progress and feedback tables/configuration are required.
2. Open `/guide`, choose Market Structure, walk through all three steps, close
   and replay. Check both desktop and phone layouts in your preferred themes.
3. Change 66D to 22D on either chart: both controls and VaNi should follow.
   Expand history, choose a session, then use **Return to latest data**.
4. Check the actual percentages, data dates and ROC relationships against your
   database, including a positive ROC below signal. Missing or mismatched series
   must remain explicitly identified. Historical selection is bounded by the
   latest 66 available observations fetched by the existing page.
5. Request an identical reading from a fresh browser session: confirm a cache hit
   without another LLM generation, with feedback still available. Change depth or
   data snapshot and confirm a distinct entry. Test feedback failure and retry.
6. In your test environment, make Qwen unavailable and verify the configured
   Haiku fallback, provider logging and subsequent cache reuse. Check prose with
   your actual Qwen model; automated tests validate routing and supplied evidence,
   not the factual quality of every possible generated response.
7. Follow the Sector Rotation link and confirm the context banner. Visit Workspace
   and a scanner to check their existing VaNi behavior.

## Checks

From `kaaladristi/App/backend`:

```text
python -m unittest test_market_structure_vani -v
python test_vani_routing.py
```

From `kaaladristi/App/frontend`:

```text
npm run typecheck
node scripts/qa/check-market-structure.mjs
npm run build
```

The contract check also requires Python; set `PYTHON` if its executable is not
named `python`. On Windows, the existing theme checker needs GNU grep and a Bash
command shell because it uses Unix shell quoting. No theme baseline was relaxed.

The application components were rendered with synthetic offline data during
development. Authenticated live-data behavior, actual VPS responses, phone
interaction and cross-worker PostgreSQL locking still need your local review.
