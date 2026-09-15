# Handover — 2026-09-15 → next session (topic: PEAD)

Two parts: where the last sprint left things, then what I verified about PEAD
readiness so the next session does not spend its first hour rediscovering it.

---

## Part 1 — State of the world

**`main` is at `46b2629`** — PR #293 merged, 18 commits, fast-forward-able
(`origin/main` was already an ancestor). The `claude/tender-euler-2j7ab5`
branch was restarted from that merge commit, so it carries no unmerged history.

Thesis events **Phases 0, 1, 2, 3a and 3b are shipped**; **Phase 4 (VaNi
narration per family) is not started and is parked** at the owner's call. Full
detail is in CLAUDE.md under *Current Plan → Thesis events* and in
`docs/claude/thesis-events-poa.md`, whose status line says the same.

Three things are open and none of them are PEAD:

1. **UI verification has never happened.** Nothing from that sprint has been
   seen in a browser. The checklist — with stocks picked from the live DB — is
   in CLAUDE.md. The decisive case is IPCALAB (`/chart/equity/599`) at **1M**:
   ~21 bars, where a Flower Pot marker was structurally impossible before the
   warm-up landed.
2. **Deploy is not frontend-only.** The warm-up and story-event work is, but
   Phase 1c's VaNi side needs the backend deployed and the API restarted —
   `/api/ai/vani-narrate` gaining `_sebi_post_filter`, plus the two
   `_VANI_NARRATE_SYSTEM` rules.
3. **Migrations 209 / 210 / 211 are applied** but 210 and 211 are still empty by
   design. `km_dimension_watermarks` fills from the next daily run;
   `stir_first_date` / `stir_window_bars` and archived `turn_date` fill from the
   next `wg_journeys` run. Until then `JourneyStrip` correctly shows a bare
   stir count rather than "21 / 41" — that is the designed fallback, not a bug.
   `km_journey_base_rates` DOES carry its row (348 of 595), so that check is
   live now.

**Pipeline banner.** Audited 2026-09-15. The 2026-09-14 failure was a **market
holiday**: `_last_trading_day()` (`pipeline2/scheduler.py:23`) skips weekends
only, `km_trading_calendar` has zero forward-dated rows so it cannot be
consulted, and `_classify` (`handlers.py:88`) has no "nothing to compute" state
— `after == 0` ⇒ `failed`, for all 25 date-scoped dimensions. The blast radius
did not grow; the **message** became honest on 2026-09-09 (`failed steps:`
prefix, commit `0d781bc`). This is the 4th weekday holiday of 2026 to do it.

Two findings from that audit worth acting on independently, neither fixed:

- **The holiday label is a guess that becomes permanent.** `daily_pipeline.py:138`
  infers "holiday" from a failed download and writes it; the gap sweep
  (`worker.py:445`) then excludes that date forever, with no exchange filter and
  no expiry. A download outage on a real trading day becomes a hole nothing
  revisits.
- **`completed_at` is written as naive `datetime.utcnow()`** while `started_at`
  is server `now()` (IST), both into `timestamptz`. Every job duration reads
  ≈ −5h30m. Job durations are currently unmeasurable.

Also: the banner fires on **5 of the last 10 runs** — `nse_flow` failed on both
09-03 and 09-11, `gl_events` threw `missing FROM-clause entry` on 09-01. Those
are not false alarms and are unrelated to holidays.

---

## Part 2 — PEAD readiness (verified 2026-09-15, not assumed)

### The spec already exists

**`docs/scanners/PEAD_FRAMEWORK.md`** — 576 lines, v1.0, "Research Framework +
Implementation Specification". It defines three trigger types (Earnings Misread
/ Policy Catalyst / Geopolitical Theme), the drift phase calendar, a heatmap
fingerprint, a primary table `km_pead_tracker`, and — read this before writing
any copy — its own **§"PEAD — The SEBI-Safe Framing"**.

Read it first. Do not redesign what it already settles.

### `km_pead_tracker` does not exist

Zero references across `.sql`, `.py` and `.ts`. It is specified, not built. No
migration creates it. Next migration number is **212** (disk is at 211) — but
`ls App/DBscripts/ | sort` first, the numbering has drifted (duplicates at
152/153, 161/162; no 155).

### ⚠ The blocker: this database holds NO earnings data at all

Verified by querying `information_schema` for every table matching
`earn / result / announc / quarter / financ / corp / event`:

| Table | Rows |
|---|---|
| `km_corporate_actions` | **0** |
| `km_astro_events` | 0 |
| `km_ux_events` | 13 |

Nothing else matches. There is no announcement-date table, no quarterly
results table, no surprise/estimate data. The only fundamental-ish fields are
`km_equity_symbols.mcap_cr` / `shares_outstanding`, which are **point-in-time,
not historical** — they cannot date an event.

**Consequence: TYPE 1 (Earnings Misread) cannot be computed today.** No
announcement date ⇒ no event window ⇒ no drift to measure. This is the single
fact that should shape the first conversation.

`km_corporate_actions` being empty is already a known, recorded problem — see
CLAUDE.md **D44**, where unadjusted corporate actions cost ~8 breadth points and
`adjust_close_cliffs()` exists as a workaround. Filling it is the structural fix
for that *and* a prerequisite here. `docs/claude/scanner-audit-2026-07-12.md` §7
already costs out the sources (NSE corporate-actions archive — "free, do this
regardless"; NSE quarterly XBRL; yfinance as the automated path).

### What DOES exist and is directly reusable

- **The drift windows the spec names map onto stored columns.** Its 1–5 / 6–22 /
  23–66 day phases are `ret_5d` / `ret_22d` / `ret_66d`, already computed daily.
- **The "who is accumulating" half is fully present** — `delivery_pct`,
  `delivery_surge_x`, `rvol`, `magic_rs` + zone, `stage`, `flow_type`,
  `sniper_inst`.
- **The story-event layer built last sprint is the right shape for this.** A
  PEAD event is a dated marker with a phase and a window — exactly what
  `services/storyEvents.ts` already renders, prioritises and hands to VaNi.
  `services/priceActionEvents.ts` is the worked example of deriving an event
  family on read with zero schema change.

### The real sequencing choice for the owner

**Types 2 and 3 (Policy Catalyst, Geopolitical Theme) are date-tagged by a
human**, not derived from a feed. They need no earnings ingest and are
buildable now. **Type 1 needs an ingest that does not exist.**

So the question to put to the owner early is: start with 2/3 on owner-supplied
dates, or build the earnings-date ingest first? Do not assume — the spec
presents all three together and it is easy to read that as "all three at once".

### Data-depth caveat

`DATA_DEPTH_AUDIT.md`: raw prices are ~26 years, but the **enriched layer is
~1.5–2 years** — `delivery_pct` ~2025+ (NSE), `ema_20` null before ~2025 on both
exchanges. The spec's own workstream (§"Last 4 Incidents") is sized to that and
is fine. A broad multi-year historical validation is **not** currently possible
without the deep-history initiative the audit describes.

---

## Part 3 — House rules that will bite on PEAD specifically

These are in CLAUDE.md in full; these five are the ones this topic walks into.

1. **Measure the distribution before inventing a threshold — and accept "no
   threshold" as an answer.** PEAD invites magic numbers (what counts as a
   surprise? how big a gap? which drift cutoff?). The breakout-cooldown case is
   the precedent: 566 entries, no cliff anywhere, so the correct outcome was to
   add no threshold at all.
2. **One eligibility rule, one implementation.** Seven scanners had their rule
   in both SQL and TypeScript; the fix was deleting the client-side copies, not
   reconciling them. Decide up front whether a PEAD event is stored or derived —
   not both.
3. **A derivation starved of warm-up reports "none", not "I could not look".**
   PEAD windows are 66+ bars. This is exactly the trap the Flower Pot warm-up
   just fixed; `storyCoverage()` exists to make such a gap sayable.
4. **Presence is not correctness.** A populated `km_pead_tracker` row derived
   from a superseded bar looks identical to a current one. `DIMENSION_DEPENDENTS`
   + `km_dimension_watermarks` (migration 210) are the machinery for this — wire
   any new nightly dimension into both.
5. **SEBI / D39 voice.** Observational only: no buy/sell/target/wait/size. And if
   VaNi narrates drift, **never hand a small model a signed number** — every
   comparison is pre-resolved to a word (ABOVE/BELOW, UP/DOWN) before the model
   sees it, and any frequency carries its denominator and an explicit fence
   saying it is not a probability for that stock.

---

## Part 4 — Suggested first moves

1. Read `docs/scanners/PEAD_FRAMEWORK.md` end to end, including its SEBI section.
2. Put the sequencing question to the owner: Types 2/3 on owner-supplied dates
   now, or earnings ingest first?
3. If earnings ingest: `docs/claude/scanner-audit-2026-07-12.md` §7 already has
   the source table and cost estimates; `NSE_FILINGS_INTELLIGENCE.md` designs the
   filings channel. Filling `km_corporate_actions` pays for itself twice (D44).
4. Do not open with a migration. `km_pead_tracker` is a spec; whether PEAD
   events should be stored at all is a live question given how much of the drift
   is already derivable from `ret_5d/22d/66d` on read.

**Settled — do not re-open:** the universe decision (full NSE + BSE coverage),
and anything else under CLAUDE.md *Settled Decisions*.
