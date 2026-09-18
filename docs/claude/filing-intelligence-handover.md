# Filing Intelligence — session handover (2026-09-16 → 09-18)

**Status: Sprint 2 SHIPPED and LIVE.** Six migrations applied, three ingests
running on their own schedules, ~31,000 events in the database.

**⚠ OWNER REVIEW PENDING — the UI layer and everything below it.** The plan
(`filing-intelligence-poa.md`) puts UI deliberately out of scope: *"POA focuses
on making all things data-ready — UI layer mention it but we won't build it —
it needs deep discussion and I have my own thoughts for it."* Nothing here is on
a screen. See **What needs your decision** at the foot of this file.

Plan of record: `docs/claude/filing-intelligence-poa.md`.

---

## What this sprint was for, in one paragraph

DristiQ could always see **what** was happening to a stock — Stirring → Waking
Giants → Volume Drive → Breakout Surge → Ascent is a footprint made of price and
volume. It could never see **why**. A stock woke on 23 July and the platform
knew the date but not the cause. Sprint 2 built the *why* layer: company
filings, which of them were results, how a stock drifted after reporting, and
who bought it by name.

---

## What is live

| | Rows | Answers |
|---|---|---|
| `km_filings_raw` / `km_corporate_events` | 28,363 events from 28,076 announcements | What did this company announce, and when could the market ACT on it? |
| `km_board_meetings` | 11,183 intimations | Which of those announcements were RESULTS? |
| `kd_result_returns()` / `v_result_drift` | 2,303 drift rows over 2,719 result events | How did it move after reporting? |
| `km_bulk_deals` / `km_bulk_deal_days` | 216 for 17-SEP, forward-only | **Who** bought — by name |

### Migrations (all applied by the owner in pgAdmin)

| # | File | What |
|---|---|---|
| 212 | `km_migration_212_filings_ingest.sql` | The spine: raw + events + `kd_day_zero_trade_date()` |
| 213 | `km_migration_213_derivation_check_class.sql` | Adds `'derivation'` to the integrity check-class CHECK (210 shipped a check the constraint rejected) |
| 214 | `km_migration_214_board_meetings.sql` | Board-meeting intimations + `is_result_announcement` |
| 215 | `km_migration_215_result_drift.sql` | `returns_since_result`, derived (function + view, no table) |
| 216 | `km_migration_216_result_drift_dedup.sql` | One drift row per RESULTS MEETING, not per announcement |
| 217 | `km_migration_217_bulk_deals.sql` | Bulk/block deals + per-day coverage |

### Code

```
lib/filing_taxonomy.py                  NSE `desc` -> family; board-meeting purpose -> is-results
scripts/ingest_nse_filings.py           announcements    (--days / --from / --to / --dry-run)
scripts/ingest_nse_board_meetings.py    intimations      (+ --reclassify, --relink, --explain-revisions)
scripts/ingest_nse_bulk_deals.py        bulk/block CSV   (+ --backfill-day0)
scripts/probe_nse_*.py                  four read-only probes; they are the record of WHY each
                                        source was chosen
test_filing_intelligence.py             60 tests (7 pure; 53 need KD_TEST_DSN)
```

### Schedules (pipeline2, all outside the 12:30–19:30 VPS window)

| Dimension | IST | Why that cadence |
|---|---|---|
| `filings_ingest` | 06/09/12/20/23 **:10** | Filings cluster AFTER the close — 287 of 582 arrive 15:30–22:55 |
| `board_meetings_ingest` | 07/21 **:40** | ~16 rows a day, and an intimation lands days before its meeting |
| `bulk_deals_ingest` | 08/22 **:20** | One published session; re-fetch is free (replace-the-day) |

Minutes are offset on purpose — three NSE fetchers must never share one.

### Running the tests

```bash
cd App/backend
python3 -m unittest test_filing_intelligence          # 7 run, 53 skip
createdb kd_test && KD_TEST_DSN=postgresql:///kd_test \
  python3 -m unittest test_filing_intelligence        # all 60
```

The SQL tests apply the **real migration files**, so a migration that does not
apply is itself caught. `KD_TEST_DSN` refuses any database whose name lacks
`test` — it truncates.

---

## The five assumptions that were measured and turned out wrong

This is the part worth carrying forward. Each would have reached a schema.

1. **"A result is filed under a Financial Results category."** It is not — it
   arrives as the generic `Outcome of Board Meeting`, alongside dividends and
   fundraising. All three discriminators failed (filename 13%, 'fin' 16%,
   `hasXbrl` TRUE on 3,013 of 3,013). Hence the second feed.
2. **"±4 days is a safe match tolerance."** 98.7% of outcomes are filed on the
   meeting date itself; SEBI requires disclosure within 30 *minutes*. +2 and
   beyond cannot be that meeting's outcome. 16 mismatches, now ±1.
3. **"NSE aggregates bulk deals per client per side per day."** It does not —
   HDFC Mutual Fund bought ASTERDM twice in one session, two schemes under one
   AMC name. A natural key would have silently dropped 1 deal in 70.
4. **"70 rows in 30 days ≈ 850/yr."** 70 was a page cap. It returned exactly 70
   for a 30-day window, a 1-year window, and *every single trading day*. The
   CSV holds 212 for one session.
5. **"One board meeting produces one outcome announcement."** 1.19 on average —
   427 of 2,733 drift rows were a second Day 0 for a result already counted.

---

## Rules that are load-bearing — do not "simplify" these

- **Day 0 is when the market could ACT, never when the company filed.** From
  `exchdisstime`, through `kd_day_zero_trade_date()`. One implementation, three
  callers. A bulk deal published after the close is actionable the NEXT session.
- **Reaction and drift are never merged.** Day −1 → Day 0 is the repricing;
  Day 0 → end is the drift. Merging them reports an effect never measured.
- **`suspect_corporate_action` must be filtered on in any study.**
  `km_corporate_actions` is still empty, so a split inside a span reads as a
  real −50%. Measured 10 of 2,733 today, but `v_result_drift` only spans ~120
  days; a full-history study will see more.
- **FALSE is a measurement; NULL is a gap.** An outcome with no intimation in
  the tolerance window stays NULL. FALSE would assert something we never
  checked, and it never corrects itself.
- **Bulk deals have no natural key.** Replace-the-day, in one transaction, so a
  genuine identical pair survives as a pair.

---

## Bugs found and fixed while building (all silent, all live)

| What | Why it mattered |
|---|---|
| Migration 213 missing | `check_derivation_staleness` emitted a class the CHECK rejected; one bad row lost the whole integrity sweep |
| Weekly/monthly boundary guard ignored `force` | Cascade sets `force=True`, so those steps reported blank failures nightly |
| Deferred reported as silence | ~half of every evening run is deferred by design; it read as a half-failed run |
| **`--relink` committed its clear and rolled back its restore** | A live run turned 2,717 verdicts into 2. Recovered fully. |
| Duplicate rows in the board-meeting feed | Two rows, one natural key, so every run wrote twice and counted two phantom "revisions" |
| Paging guard measured the CSV against the API's cap | Warned on every healthy session — the kind of alarm that gets muted before it's ever right |

**The transferable lesson** is from the `--relink` one: every test called the
function and then committed *itself*, so it passed whether or not the code
committed. A test shaped that way structurally cannot see a missing commit. The
shape that can is **write → roll back → read**, and the strongest version makes
the operation change something first.

---

## What needs your decision

### 1. UI — the whole layer (the reason this file exists)

Everything above is queryable and nothing is visible. Your own framing was that
the viewing layer needs its own discussion. Open questions when you want it:

- Where do filings surface — the stock cockpit, a feed, the Morning Brief, or a
  scanner? (You already said *not* the Morning Brief, because the pipeline runs
  several times a day and the brief would have to keep changing. "At any point
  in time we can show 3–4 days of filing intelligence" was your steer.)
- Vocabulary: **Eagles** for the UI/stocks layer, **Spark** for the dated event,
  with negative sparks. Settled in principle; never rendered.
- What a user does with a bulk deal — a badge on a scanner row, a panel, a filter?
- Does PEAD become a scanner of its own, or a column on the existing ones?

### 2. Smaller, still open

- **Bulk-deal history.** None exists — the CSV is one day, the API caps at 70.
  `probe_nse_bulkdeals.py` now tries four dated-archive patterns; if one answers,
  a backfill is ~250 small files a year. **Unrun.**
- **205 outcome announcements sit NULL** — companies with no intimation in the
  window. Widening the board-meeting fetch resolves some.
- **Sprint 3** — reading the documents (Qwen, serialized, with retries) to
  extract amounts and ratios. The deterministic pass covers ~63.5% today.
- **Sprint 3b** — populate `km_corporate_actions`. Unblocks honest drift, and
  also fixes `sma_150` / `w52_high` / `d365_pct_chng` (D44).
- **BSE.** NSE only, by your decision — sequencing, not scope. The schema is
  two-source from day one so BSE is additive.

---

## Re-running things

```bash
cd App/backend

# announcements: window fetch, idempotent, backfillable
python3 scripts/ingest_nse_filings.py --from 2026-06-01 --to 2026-09-18

# intimations; --relink re-judges history after a tolerance change (no fetch)
python3 scripts/ingest_nse_board_meetings.py --days 120
python3 scripts/ingest_nse_board_meetings.py --relink --from 2026-06-01 --to 2026-09-16

# bulk deals: whatever session the archive currently publishes
python3 scripts/ingest_nse_bulk_deals.py --dry-run
```

Health, at a glance:

```sql
SELECT (SELECT count(*) FROM km_corporate_events)                        AS events,
       (SELECT count(*) FROM km_corporate_events
         WHERE is_result_announcement)                                   AS results,
       (SELECT count(*) FROM kd_result_returns())                        AS drift_rows,
       (SELECT count(*) FROM km_bulk_deals)                              AS deals;

-- how much of the drift population a split makes unusable
SELECT suspect_corporate_action, count(*) FROM v_result_drift GROUP BY 1;

-- days actually fetched (row_count 0 = quiet; ABSENT = never fetched)
SELECT deal_type, deal_date, row_count FROM km_bulk_deal_days ORDER BY deal_date DESC;
```
