# Sector leadership upgrade: rollout and review

## Rollout order

1. Apply migration 207 if it is not already installed, then `kaaladristi/App/DBscripts/km_migration_208_leadership_snapshots.sql` to the test database. Migration 208 adds published snapshots and membership/catalog invalidation; it does not rewrite index prices.
2. Pull backend and frontend together from `codex/vani-market-structure`.
3. In `kaaladristi/App/backend`, using the deployed Python environment and database configuration, run:

   ```sh
   python scripts/refresh_sector_leadership.py
   ```

   This publishes the latest session for all five category scopes and three display windows. Subsequent complete daily runs publish automatically. Successful custom-index calculations also attempt publication. A failed publication is reported separately from a successful index calculation.
4. For historical date selection, prepare the desired sessions explicitly:

   ```sh
   python scripts/refresh_sector_leadership.py --from 2026-06-01 --to 2026-09-11
   ```

   Choose the dates appropriate to your database. Missing snapshots show a preparation message; opening the page never triggers heavy calculations.

A membership/catalog edit invalidates existing snapshots across dates. The next successful refresh publishes the latest session; rerun the historical command for earlier dates you want to inspect. All curated revisions must be fully calculated before a batch can publish. An incomplete daily run retains earlier dated snapshots and does not publish the incomplete session. Resolve the failed source steps and rerun the daily pipeline or the refresh command afterward.

## What users see

Current Flow remains the default. Longer-Term Leadership shows one comparison row per basket, with mobile cards on smaller screens. It combines separate visible readings: a descriptive group, weekly/monthly agreement, Stage 2 counts and coverage, agreement history, and current flow.

- **Running broadly:** W/M agree for at least 8 completed weekly observations, at least 60% Stage 2 Leaders among classified constituents, at least 5 classified, and at least 80% membership coverage.
- **Building:** W/M agree but the running-broadly persistence or support requirements are not met.
- **Cooling:** W/M no longer agree after agreement within the preceding 26 completed weekly observations.
- **Limited coverage:** fewer than 5 classified constituents or coverage below 80%. Raw Leader and Watch counts remain visible.
- **Unavailable:** insufficient W/M readings when coverage is otherwise sufficient.
- **Not aligned:** no current agreement and no recent agreement to classify as Cooling.

These are explicit research rules, not a composite score, performance ranking or prediction. A basket can be Running broadly while current flow is Fading.

Basket-name clicks open the existing `/sector-rotation/:id` evidence page with the selected date. The separate MagicRS button expands the existing ChartView canvas component, with Weekly/Monthly controls. No new chart library or synthetic production series is used.

## Calculation and cache contract

The snapshot job computes a canonical 12-month display history with another 60 months of indicator warmup. It produces 3M/6M/12M projections without recalculating current classifications or the completed-week run. Current runs can extend beyond the display window, within available warmup history. Missing alignment breaks the run.

Weekly alignment uses the 144-period relative-strength baseline versus its 60-period mean, falling back to 21-period RS sign when the long mean is unavailable. Monthly uses 21-period RS sign. Both use matched NIFTY 500 period closes. A period is available only after the next calendar week/month starts, so the forming candle is excluded. Chart short averages use migration 169's 21-period average, with its warmup floor; chart shading describes RS versus average and can differ from the monthly above-zero agreement rule.

Stage support counts raw `stage=S2` and `S2_CANDIDATE`, without scanner display limits or extra filters. Eligible means known S1/S2/S2_CANDIDATE/S3/S4 at the selected closing-data session. Percentages require five eligible constituents; counts do not. History uses currently recorded membership, not historical membership.

Page and VaNi read the same published payload and snapshot hash. The read path performs a snapshot lookup and revision check; no constituent scanning, index calculation or LLM call is required to render the table. VaNi explanation retains Qwen-first routing, configured Haiku fallback, cache, Consulting VaNi loader and feedback.

Publication is transactional across all categories/windows. Membership generation and custom revision checks reject stale results. Previous published payloads remain in `km_leadership_observations`; existing index-price and membership archives remain available.

## Test angles for Kamal

| Test | Expected result |
|---|---|
| Open Longer-Term Leadership | Compare baskets immediately; no expanded evidence by default. Group counts match rows. |
| Click each group, including an empty group | Only matching baskets appear, or a clear empty message. All restores the full category. |
| Change 3M / 6M / 12M | History changes; current group, current W/M readings, stage counts and run remain consistent for the same date. |
| Switch Sectoral / Thematic / Curated | Table and longer-term VaNi follow the chosen scope. Current Flow's default still matches Discovery overall. |
| Find a basket with strong structure and fading current flow | Both readings remain visible; VaNi must not merge them into one score. |
| Compare 4-member, 5-member and partially covered baskets | Small baskets show actual Leader/Watch counts. Broad support needs both the five-classified and 80%-coverage floors. |
| Expand MagicRS and switch Weekly/Monthly | Existing chart style, correct period dates, actual RS values and clearly labelled averages. Missing history has an explanatory message. |
| Click a basket name or Open full sector evidence | Existing detail route opens for that basket and the selected date. |
| Select a historical date | A prepared snapshot loads with no future periods. An unprepared date shows the preparation message. |
| Edit a test basket, then finish Calculate | Old leadership snapshot becomes unavailable; rebuilt/latest publication reflects new membership. Reprepare old dates if needed. |
| Simulate publication failure | No partially published batch. Successful index calculation is distinguished from pending leadership publication. |
| Repeat VaNi request | Existing cache works, loader remains visible, feedback works. Check deployed Qwen/fallback logs. |
| Use light/dark at 320/390px and desktop | Filters wrap; cards fit; expansion and navigation work without whole-page horizontal overflow. |
| Check request timing and DB logs | Leadership context reads published JSON; heavy queries occur only in refresh jobs. Measure live refresh duration separately. |

## Local verification

53 backend tests passed, including classification boundaries, small samples, display-window stability, read-only snapshot loading, stale membership, atomic publication failure, rebuild and daily-pipeline publication contracts, and existing VaNi/cache behavior. Browser regression passed at 320/390/768/1440px in both themes using synthetic fixtures, including filters, MagicRS canvas, date-carrying links and current-flow regressions. Frontend typecheck, production build, theme/persona checks and Discovery flow parity checks passed.

PostgreSQL is not available in this workspace: migration execution, live refresh performance, database permissions and deployed Qwen/Haiku behavior require testing in your environment. The build retains pre-existing bundle-size, Browserslist and Tailwind warnings.