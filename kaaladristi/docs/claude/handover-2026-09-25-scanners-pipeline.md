# Handover — 2026-09-25 · scanner ordering, Standouts, and the pipeline clock bug

Branch `claude/confident-ptolemy-5haczv`, merged to `main`. Five commits.
Everything below was verified against the live DB, not assumed.

---

## 1. STATE — what is live right now

| | status |
|---|---|
| Migrations 223, 224, 225 | **all applied** (223 re-run 10:38 IST, 224 at 11:02, 225 confirmed by `still_skewed = 0`) |
| Backend deployed | **yes** — job 4297 stamped `started 14:14:00 → completed 14:23:14`, a POSITIVE 9m14s. Under the old code that completion would have been written 5h30m early. |
| **Frontend built** | **NO — this is the one outstanding deploy.** The sort changes, the removed VaNi button and the Stage 2 loader are in `aca534af` / `27abc748`, which only reached `main` with this merge. `cd App/frontend && npm run build`. |
| nse_flow 2026-09-21 | **repaired** — 3,292 / 3,417 NSE rows, cascade ran `scan_refresh` one second later |
| Critical integrity findings | none since 2026-09-24 22:53; both of that night's have been resolved |

---

## 2. What shipped

### Scanner default ordering (`aca534af`)

Owner gave a per-screener spec. Twelve changed, two were already right, **five
were refused on measurement** — and the refusals are pinned by the guard so a
later session cannot quietly "finish the list":

- **weekly/monthly movers + decliners** — there is NO breakout or breakdown date
  anywhere on the scan row. Membership is `pct_wtd > 0` / `pct_mtd > 0`: a STATE
  against a reference that resets every Monday and every 1st, not a dated
  crossing. They keep distance-past-the-reference.
- **gl_breakout** — the arm fires on the session of the cross, so `gl_days_above`
  read **1 on all 14 rows** of the 2026-09-24 bar. A constant is not an order.
- **conviction_flow** — kept on `delivery_surge_x` rather than raw
  `delivery_pct`; raw delivery floats illiquid names that always settle high.

Also typed `DEFAULT_SORT`'s keys as `keyof ScanStock`. They were `string`, so a
typo compiled and then read as an undefined property on every row — and
nulls-last-in-both-directions means the table renders in FETCH order, which
looks exactly like an order somebody chose.

⚠ **Studio descriptors are read FIRST by `getDefaultSort`.** A Studio preset's
ranking lives on `config/scannerStudio.ts`; putting it in `DEFAULT_SORT` does
nothing.

### VaNi Weakness Watch retired (migration 224, `2d5e0d99`)

`is_active = FALSE`. Stage 4 Leaders covers the same family and renders
`rs_percentile` as a default column, so sorting it ascending is the same
shortlist. The row is **not deleted** — the id is an address (`?setup=` links,
the thesis adapter registry). The `SCAN_PRESETS` array entry went in the same
change or the scanner reappears whenever the presets API is unreachable.

Latent bug this exposed and fixed: `fetchStandouts` read `kd_scan_presets` with
no `is_active` filter, so a retired preset carrying a `vani_side` would keep
voting in the Standouts agreement count.

### Scanner loading states (`27abc748`)

There are **five** scanner layouts, not one. Four had a loader; Stage 2's table
branch read `!isLoading && !error` and rendered NOTHING — while loading, and
then permanently if the scan failed, because the error card lived in the cards
branch. **The missing error surface was the real defect**: silence is
indistinguishable from "no stocks match today".

### km_jobs.completed_at was 5h30m early (migration 225, `b2d7e75d`)

`datetime.utcnow()` is naive; psycopg2 sends it as a bare literal; PostgreSQL
resolves a bare literal against the session TimeZone (Asia/Kolkata). **4,274 of
4,296 rows** had `completed_at` before their own `started_at`.

**The damage was not the timestamps.** `_parent_fix_failed` (120 min) and the
cascade debounce (30 min) both window on `completed_at > now() - interval`, so
both were **structurally inert** — no job has ever reached `status='deferred'`,
including 2026-09-24 when three fixes failed at 19:30 and the cascade ran at
20:05. Fixed with `SQL_NOW`, a sentinel `_update_job` renders as `now()`.

---

## 3. OPEN — pick up here

### a) Frontend build (blocking)

Nothing from §2's frontend work is visible until `npm run build` runs on the VPS.

### b) The gap sweep's 3-day window — the one real design question

`_daily_gap_sweep` reads `health_grid(conn, days=3)`. A forced fix that FAILS
nullifies its columns first, so when 2026-09-21's `nse_flow` fix died on the
step advisory lock it left `flow_type`/`accum_distrib`/`vacuum_flag` NULL on all
3,417 NSE rows — and by 09-24 the date had aged out of the sweep. Nothing would
ever have retried it; it took a hand-queued job four days later.

The documented trade-off ("NULL drops the fill rate and the gap sweep retries")
therefore only holds for three days. **Measure what a 5- or 10-day window would
actually enqueue each night before changing it** — longer sweeps and more jobs
are the cost, and the owner has not decided.

### c) Two items I raised and the owner has not ruled on

- Whether `PIPELINE2_PARENT_FAIL_WINDOW_MIN` (120) is still the right number now
  that the guard can actually fire. It has never run in production, so its
  calibration has never been tested against a real case.
- `lib/alerting.py` still no-ops unless `ALERT_WEBHOOK_URL` or
  `ALERT_EMAIL_TO`+`SMTP_*` are set. Every critical finding is still PULL-only.

### d) Carried forward, untouched this session

`volume_drive`'s SVD arm is a measured fade (−1.80 pts) — the biggest open
scanner defect. The volume-spurt column (`vol_spurt_count_22d >= 8 AND
magic_rs_chg_22d > 0`). Splitting the ≥+15% filing edge (n=70, same
date-count problem as PEAD). `2026-08-25` has 0 SBD/SVD/SYD across all 3,006
rows. October is the first genuinely independent PEAD test.

---

## 4. Guards added — run these before believing a change here

```bash
cd App/frontend
node scripts/qa/check-scanner-sort.mjs      #  9 checks — ordering + the refusals + the retirement
node scripts/qa/check-scanner-loading.mjs   #  4 checks — a loader AND an error surface per branch
node scripts/qa/check-standouts.mjs         # 10 checks
node scripts/qa/check-pead-scanner.mjs      # 11 checks
npm run typecheck && npm run build

cd ../backend
python -m unittest test_job_timestamps      # 10 checks — the DB clock stamps km_jobs
python -m unittest test_pipeline_cascade test_dimension_watermarks
```

`check-scanner-sort.mjs` was verified to fail against 16 sabotages,
`check-scanner-loading.mjs` against 12, and `test_job_timestamps.py` pins the
parameter ORDER through `_update_job` — the sentinel skips a `params.append`, so
a misalignment there would be silent.

---

## 5. Traps worth re-reading before touching any of this

- **The DB row wins, the array is the fallback.** `getPresetMeta()` reads
  `kd_scan_presets` FIRST. The owner ran migration 223 in its first form and the
  preset kept rendering in its own category although the code said Market — the
  migration-218 `universe` trap, hit again.
- **A guard that has never fired is not evidence that it works.**
  `SELECT count(*) … WHERE status='deferred'` was the whole diagnosis of §2's
  clock bug. Any new guard deserves that query.
- **Repairing timestamps needs a band, not a sign test.** The residual after
  shifting is seconds of app-vs-database clock drift (207 rows, worst 9.1s), so
  `WHERE completed_at < started_at` would re-shift those by another 5h30m on a
  re-run.
- **An unforced fix is the safer repair** when a dimension's columns are already
  NULL: `_handle_columnfill` nullifies only when `force` is set, and that nullify
  is what loses the data if the recompute then fails.
