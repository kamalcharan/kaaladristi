# Handover — 2026-08-29 → next session

**Next session's job: the eight skills now checked in at
`App/mnt/skills/user/`.** Everything below the "Session record" heading is
context from the session that ended; read the Skills section first.

---

## 1. The skills — state as found

Eight directories, each with a single `SKILL.md`, all tracked by git:

| skill | lines | frontmatter |
|---|---|---|
| `dristiQ-screeners` | 1,103 | yes |
| `dristiQ-framework` | 290 | yes |
| `dristiQ-correlation` | 181 | yes |
| `dristiQ-rule-engine` | 165 | yes |
| `dristiQ-data-quality` | 140 | yes |
| `dristiQ-widgets` | 140 | yes |
| `sebi-sweep` | 143 | **NO** |
| `flow_intensity_map` | 127 | **NO** |

### Two things to settle before editing content

**(a) `sebi-sweep` and `flow_intensity_map` have no YAML frontmatter.** They
open with `# Title` instead of a `---` block carrying `name` and
`description`. Without that they are markdown files, not skills — nothing
will ever load them. The other six have it.

**(b) The location is almost certainly wrong for Claude Code.**
`App/mnt/skills/user/` mirrors the `/mnt/skills/user/` convention of a
different runtime. Claude Code discovers project skills from
`.claude/skills/`, and there is no `.claude/skills` directory anywhere in
this repo. So none of the eight are currently loadable here — verify against
the live tooling before assuming either way, but expect a move.

Decide (b) before rewriting content; moving eight files afterwards is
cheaper than rewriting them twice.

### What to check in the content

These were written against a codebase that moved a long way in the session
just ended. Specifically:

- **`dristiQ-screeners` (1,103 lines) will be the most out of date.** Six
  price-action presets moved onto the `km_scan_results` matview (migration
  195), and `fieldAvailability` is still category-keyed. Anything in the
  skill describing per-scanner select lists needs re-reading against
  `services/scanEngine.ts`.
- **`dristiQ-data-quality`** predates every finding in section 3 below.
- **`dristiQ-widgets`** documents MagicRS, which was rebuilt this session
  (Pine-parity render, benchmark-relative wording, short-RS fallback on W/M).
- **`sebi-sweep`** is the D39 audit skill. It exists, and four live D39
  violations were still found by eye this session — so whatever it does, it
  was not being run. See section 4.

---

## 2. Immediately runnable / unfinished

- `python scripts/compute_wg_journeys.py` — **owed now.** The magic_rs
  backfill moved zones across ~1,900 symbols and the WG alignment clocks read
  `magic_rs_zone`; journeys are stale until this re-runs.
- `python scripts/backfill_magic_rs_history.py --all` — 216 symbols still
  carry an MA older than their stored RS (down from 1,876). They sit above
  the 60% coverage floor so the default run skipped them.
- `python scripts/backfill_gl_events.py --restart` — the ±5-day dot rule has
  never been applied. `--restart` is required; a plain run resumes and does
  nothing.
- `python scripts/backfill_stage_entry.py` — needed for the raw-stage
  re-anchoring to appear. Dates are stored, not computed at read time.
- Migrations **194b** (optional index) and **196** (`gl_event_date`) — check
  whether 196 is applied; 190–195 are.

---

## 3. Data debts, all traceable to one event

The **2026-08-03 universe expansion** added 2,145 symbols in a day and took
the active universe from 7,949 to 10,094. Enrichment never followed it. Most
of what broke this session traces here:

- **Indicator history.** 2,068 NSE symbols got prices but no indicators.
  WALCHANNAG holds 555 price bars, 81 RSI bars. This is why ZIMLAB's stage
  starts 31 Jul rather than April.
- **Index membership.** The seeder last ran 2026-02-14. 2,376 NSE symbols
  have no membership from either source (`index_names[]` or
  `km_index_constituents`).
- **Backfill horizons.** 1,529 NSE symbols share `first_trade_date =
  2024-06-03` — a loader run with a start date rather than from listing.
  DSKULKARNI: listed 1995, first bar 2026-08-03. Not 1,529 separate bugs;
  about four batch-shaped ones.
- **`km_corporate_actions` is empty (0 rows).** Prices are raw, so splits
  show as cliffs. Affects `sma_150`, `w52_high`, `d365_pct_chng`, and every
  entry-price/percent-since figure.
- **`breakdown_level` / `pct_from_breakdown`** have one day of history
  (2026-08-27). Breakdown Surge is correct today, blind before.

---

## 4. The thing worth fixing structurally

Nearly every bug this session was **two lists that never agreed**, not a
missing value:

- picker offered columns the fetcher never selected → dashes
- `StoryKind` copied by hand in three places → new kinds drew nothing
- `.limit(8000)` against a 10,412-row universe → search returned BSE only
- a stage badge and its date reading different columns
- `MIN_AVG_AMT_22D_CR` deleted, three references left → the nightly
  integrity check died of `NameError` for three weeks, and
  `km_integrity_findings` holds four rows total

**A banned-word lint over rendered strings would have caught all four D39
violations found by eye.** That is probably `sebi-sweep`'s real job, and it
is the highest-leverage thing the skills work could produce.

---

## Session record — what shipped 2026-08-28/29

All merged to `main`. Frontend deployed by the owner.

- **195** — six price-action scanners onto `km_scan_results`
- **196** — `km_wg_journeys.gl_event_date`
- Discovery tabs: EOD enrichment (read-time join, not copied columns)
- Stage entry re-anchored to the raw stage, both batch and nightly paths
- Story events: all stage transitions (was S2/S4 only — 9,674 were silent),
  GL events, WG journey markers, in Story View / Story Play / Thesis
- Study **Data tab** built: 145-column picker, admin coverage/depth/defect
  cards
- `ACTIVE_UNIVERSE_CAP` — six universe fetches were capped below the universe
- MagicRS rebuilt to Pine parity, bound to the chart's range **and viewport**,
  short-RS fallback on W/M, benchmark-relative plain wording
- `scripts/backfill_magic_rs_history.py` — ran, 913,119 rows, 1,934 symbols
- D39: raw zone strings, stage names, divergence badge and narrative

### Corrections made during the session, so they are not re-derived

- **The `magic_ma` values were never wrong.** They were computed from a real
  in-memory series that was never persisted. The zone `Strong Bear` on
  WALCHANNAG is correct — it ran to +45 RS in May and gave it back by August.
  The bug was that you could not *see* why.
- **`cycleLabels.ts` still emits "Stage 2 Uptrend"** — on D39's explicit
  banned list. Flagged, deliberately not swept into an unrelated commit.
- `magic_rs` is 144-bar; weekly and monthly cannot carry it (144 months ≈ 12
  years, deepest monthly history is 80 bars). They carry `magic_rs_short`
  (21-bar). The UI must say which it is showing.

### Owner working preferences

Ask questions in one batch, not in sequence. No item-letter shorthand. Do not
re-list decisions already made. Merge to `main` in the same step as the
branch push. Do not ask permission for work already implied by the request —
"provide proper UX" means fix it, not offer options.
