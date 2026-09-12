# Longer-Term Leadership — local review

## Deploy order

1. Apply `kaaladristi/App/DBscripts/km_migration_207_sector_leadership.sql` to your test database first. It adds membership revisions, membership-change logs, archived observations/history and an index-scoped version of the existing score calculation. It does not rebuild or delete existing index data when applied.
2. Update the backend and frontend together from `codex/vani-market-structure`.
3. Start with a test curated basket before editing one used by beta customers. Membership edits now automatically rebuild the complete index history, including scores, breadth and indicators. The old bars are archived before replacement.

## What is implemented

On `/sector-rotation`, Current Flow remains the default. Longer-Term Leadership adds three separate readings: weekly/monthly index alignment, constituent Stage 2 support, and persistence. There is no combined score, performance prediction, or new industry-basket construction. Existing Broad Market / Sectoral / Thematic / Curated tabs remain available.

Weekly alignment uses the existing long MagicRS ratio baseline (144 periods) versus its 60-period mean, with short 21-period RS sign as the warmup fallback. Monthly uses short MagicRS sign, matching the Ascent alignment approach. Both use NIFTY 500. Period closes must match the benchmark session; missing periods are not compressed out. Only completed calendar weeks/months are used: the next calendar period must have started by the selected session. Consequently the latest forming period is deliberately excluded; source period-close dates are displayed.

Stage support uses raw `stage = S2` / `S2_CANDIDATE` across recorded constituents, not scanner result limits, user filters or the smoothed `stage_confirmed` field. Denominator = constituents with known S1/S2/S2_CANDIDATE/S3/S4 on that session. At least five classified constituents are needed. Classified/total coverage is visible. Scanner listings with extra filters may therefore show different counts.

History is reconstructed using current recorded membership. Previous published leadership payloads are saved separately in `km_leadership_observations`; prior index bars are archived before full rebuild in `km_custom_index_history_archive`. Membership changes are retained in `km_custom_index_membership_log`. These are database records; there is no archive-browser UI in this increment.

## Test angles

| Test | Expected result |
|---|---|
| Open the main page | Current Flow opens; its default VaNi uses the shared Discovery Sector Pulse component. |
| Switch to Longer-Term Leadership | Three separate readings appear. VaNi changes to the longer-term picture for the same category, date and window. |
| Change 3M / 6M / 12M | History/persistence changes. The latest readings should stay the same for an unchanged date and membership. |
| Switch Sectoral / Thematic / Curated | The main reading and longer-term VaNi follow the selected category. Current Flow's overall default remains independent of the tab. |
| Inspect a familiar mature basket | Check weekly/monthly source dates and alignment against the matching completed periods, not the forming chart candle. |
| Select a past date | No future period or future stage reading enters the result. It remains a reconstruction of today's recorded membership. |
| Open participation history | Latest date is first in the table. Graph shows chronological Leaders/Watch percentages; missing observations produce gaps. |
| Compare a 5-stock and a larger basket | Counts and percentages use eligible constituents; coverage is visible. A basket with fewer than five classified stocks shows unavailable support. |
| Find incomplete stage or price history | Missing data must not appear as zero strength or a negative alignment. It breaks an alignment streak and is excluded from known-sample counts. |
| Sort by Stage 2 Leaders share | Compare basket support without a combined ranking score. Read coverage alongside the percentage. |
| Find a long leader with recent fading flow | Longer-term alignment/support and current flow can disagree. VaNi must explain rather than collapse them into a single verdict. |
| Add/remove a test constituent | Full recalculation starts automatically. Previous bars are archived, membership revision changes, and a completed rebuild refreshes related caches. |
| Fail a rebuild in your test environment | The error is visible. Revision stays pending; VaNi/Discovery avoid the stale index snapshot. Retry Calculate. |
| Change membership during a rebuild from another session | Completion detects the revision mismatch and requests a retry rather than declaring the newest basket ready. |
| Create a new test basket | Saving triggers calculation. On failure you land on Manage with a retry message, without creating a second basket. |
| Request VaNi twice | First request uses Qwen-first routing with the existing configured fallback; repeat uses cache when available. Both show Consulting VaNi. Check thumbs feedback. |
| Mobile + themes | Test light/dark at 320/390px and desktop. Switch modes, expand history, inspect values, retry errors and open a basket. No whole-page horizontal overflow. |

Reconstructed history is not evidence of when a theme was originally discovered. Current-run counts are bounded to the selected window. A missing benchmark or insufficient warmup must result in unavailable alignment.

## Verification performed here

- 42 backend tests: alignment warmup/missing data, denominator and sample floor, date/window behavior, snapshot invalidation, archive writes, rebuild order/failure/concurrency, existing VaNi/cache contracts.
- Browser checks at 320/390/768/1440px in light and dark, including the new view/windows/history and automatic VaNi switching, using synthetic responses with external requests blocked.
- Frontend typecheck, existing sector classification/parity checks, production build and theme/persona checks.

The SQL migration has not been applied to a live PostgreSQL instance here. Live data accuracy, full-history rebuild duration, deployed Qwen/fallback and production permissions need verification in your environment. Existing build warnings concern bundle size, old Browserslist data and a pre-existing Tailwind class.
