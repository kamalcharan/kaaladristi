# Canonical Venus backend consumers

Requires applied migrations 235 and 236 and deployment of these backend changes. No additional migration or generator run is needed. This change has not been deployed or merged by the task.

## API

`GET /api/astro/venus/calendar?from_date=2026-10-01&to_date=2026-10-31`

Uses the existing app-wide route authentication guard. Defaults to today in IST through 90 days ahead; rejects reversed ranges and ranges longer than 3660 days. Missing canonical schema/data access yields HTTP 503 with no silent fallback to legacy events. An empty valid date range returns empty lists, not fabricated events.

Response: `events` contains all matching canonical records; `markers` selects points and `bands` selects periods. These are alternative/grouped representations of the same events, not lists to concatenate. Render Tara Asta/Udaya from markers; do not generate additional endpoint markers from the period band. Astronomical dates remain unshifted even on non-trading days. A future chart adapter must decide how to display them without changing the source date.

Records retain event identity, source, calculation method, precision, IST timestamps, daily-sample crossing brackets and visibility-model parameters. Generic Mercury/Venus crossing and specialised contra-directional crossing remain distinct classifications; consumers should avoid presenting two markers for a shared occurrence unless intentionally comparing classifications.

## VaNi

`index.astro_now` now combines its existing Mercury narration with canonical Venus daily motion/sign, Tara Asta/Udaya and upcoming Mercury-direct/Venus-retrograde crossing. Registry label names both planets. It remains deterministic, with no Qwen or Haiku invocation. Persistent-cache version is incremented so old Mercury-only entries are not reused. Both first reads and cache hits return the existing response contract.

Boundary days display the calculated IST time rather than claiming an all-day visibility state. Period and endpoint narration are deduplicated. Daily-sample crossing brackets stay brackets. The text does not infer a rally, a buy/sell signal or replace visibility with the angular-combustion rule.

## Local validation and deployment checks

Nine Venus Python tests pass; modified backend modules compile. Actual migrations 235/236 and the service's SQL execute together in isolated PostgreSQL/PGlite, verifying the October payload and existing identity protections. No live HTTP deployment test was performed.

After backend deployment:

1. Request October 2026 from the new endpoint: Asta is 14 October at 18:00:27 IST and Udaya is 28 October at 06:10:13 IST; angular combustion remains separate.
2. Request VaNi `index.astro_now` on 4 October: Venus is present and the contra-directional crossing retains its 6–7 October bracket. Request again to check the cached response matches.
3. On 14 October, narration names the 18:00 boundary rather than claiming the whole day is inside Tara Asta. On 20 October it describes the active period and gives Udaya once.
4. Check the December 2025–February 2026 period across the year boundary and a weekend event; dates must not move to an exchange session.
5. Confirm reversed date ranges return 422 and a valid range without recorded data returns no invented state.

The current chart overlay service reads legacy transits directly; this backend work supplies its canonical replacement endpoint but does not change chart rendering, almanac layout, the separate legacy astro-calendar scoring intents, or correlation calculations. Those readers need a subsequent explicitly scoped integration. There is no need to maintain a second set of Drik production dates.
