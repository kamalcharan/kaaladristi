# Scanner Enhancement — Trend Signals (New / Sustaining / Rising RVOL) + Date Filter

**Status:** Design discussion complete, not built. Owner to confirm scope before implementation.
**Depends on:** VaNi-in-scanners (shipped — see `docs/claude/vani-status.md` and the `scanner.explain_preset` / `scanner.read_results` intents in `lib/vani_intents.py`). This doc is the v2 layer on top of that.

---

## The problem this solves

Live-tested `scanner.read_results` output on Breakout Surge and it read as generic, template-shaped prose that would look the same every day:

> "As of the 2026-07-16 close, the Breakout Surge screener returned 270 stocks, with a notable concentration in industries like Media & Entertainment... The cohort appears to be in an early to mid-stage phase, with a mix of stocks showing strong price movement..."

Two root causes, both structural, not prompt-tunable:

1. **No comparison point.** VaNi only ever sees a single day's snapshot. With nothing to contrast against, it defaults to generic scaffolding ("early to mid-stage phase," "structural stress is manageable") — vocabulary picked from the SEBI-safe word list because it sounds appropriate, not because anything in the data supports it.
2. **Sample vs total mismatch.** The scan matched 270 stocks; VaNi only receives the top 25 rows. "Concentration in X, Y, Z industries" is the model eyeballing 25 rows and describing it as if it characterizes all 270 — not just unhelpful, potentially inaccurate.

## What would actually help decision-making (owner's ask)

Three concrete, computable signals, not LLM-inferred narrative:

1. **New today** — stocks that entered the scan's qualifying set today but weren't in it yesterday (e.g. "8 new breakouts today"). Mark with an icon/badge on the row in the results table, not just in VaNi's text.
2. **Sustaining** — stocks that have held qualifying/favorable status across the last N sessions (proposed default: 4 days) — signals the move has follow-through, not a one-day flash.
3. **Rising RVOL** — stocks whose relative volume has been trending up session over session — signals building interest, independent of price action.

VaNi's job changes from "summarize the table" to "turn 3-4 pre-computed facts into two sentences." This also fixes the sample-mismatch problem for free, since the facts are computed server-side against the full result set, not the 25-row sample sent for narration.

## Architecture: pre-computed, not live

This should follow the exact pattern already used everywhere else in this pipeline (`rolling_metrics`, `stage_classification`, `magic_rs`) — a **scheduled job that runs once, right after the daily pipeline finishes**, writing results to a small table. VaNi and the UI badge just read. Zero computation at request time. Do not compute this live per VaNi ask.

## Complexity — splits sharply by scanner type

| Scanner type | Where qualifying logic lives | Complexity to pre-compute membership |
|---|---|---|
| **Breakout Surge, Conviction Flow, Stage family** (`stage_2_leaders`, `stage_2_watch`, `stage_3_watch`, `stage_4_leaders`, `vani_exit_watch`) | Simple SQL filter on already-stored columns (e.g. `pct_chng > 0 AND close >= 50 AND pct_from_breakout > 0`) | **Low.** One scheduled job re-runs the same filter across the last N confirmed dates, writes a small membership table (`preset_id, trade_date, equity_id`). New/sustaining fall out of a plain set-diff — no need to reimplement scan logic elsewhere. |
| **Power Buy, Power Sell, Smart Money, Quiet Accumulation, Distribution Warnings** | Multi-condition logic combining industry rotation + flow + zone, written in TypeScript only (`App/frontend/src/services/scanEngine.ts`) — does not exist in Python/SQL at all today | **Real work.** Porting each scan's qualification logic server-side is scanner-by-scanner engineering, not a quick add. Defer to a later phase. |

**RVOL trend** is cheap regardless of scanner family — it's a plain N-day window over one numeric column (`rvol`), no membership tracking needed. Can be computed in the same scheduled job for any scanner.

### Recommended initial scope

Build the scheduled job + membership table for the **low-complexity family only**: Breakout Surge, Conviction Flow, and the Stage family. Same underlying pattern serves all of them for roughly the cost of one. Extend to the bundle scanners later, only if this proves valuable in practice — don't build that port speculatively.

## Date filter — "let users view any previous day's scan results"

Also raised in this discussion; shares almost all of its plumbing with the membership table above.

- **For the low-complexity scanners**: genuinely practical, small lift. Their fetchers already resolve to "the latest confirmed date" (see `fetchRecentDates()` in `scanEngine.ts`); swapping that for a user-selected date is a contained change — a date picker + threading the param + reusing the completeness gates already built this session (`.notNull('ema_20')` — see the pipeline-window data-completeness fixes, commit `9e69c59` and around it) so picking a date with incomplete indicator data shows a clear message instead of silently-wrong results.
- **For bundle scanners**: technically possible (the bundle already loads up to 45 days of history client-side in `loadDailyBundle()`), but requires refactoring the scan-evaluation pipeline to accept an arbitrary reference date instead of hardcoding "latest" throughout — touches the exact code that was just hardened against date-resolution bugs this session (the mid-pipeline blackout fix, the multi-day staleness fix). Do this carefully, not as a quick add, given how much correctness work already went into that path.
- Once the membership table exists for a scanner, "show me yesterday's list" for that scanner becomes a free read from the table — no separate engineering. Build the date filter and the trend-signal table together for the same scanner set.

## UI

- "NEW" badge/icon on qualifying rows in `ScanTable.tsx` / card views, for stocks that entered the scan's qualifying set within the lookback window. Style should be consistent with the existing VaNi Highlight (✦) badge treatment in `ScanCardShell.tsx` — don't invent a third visual language for scan-result badges.
- Date filter control on the scanner page, disabled/hidden for scanners not yet in the low-complexity set until they're extended.

## VaNi integration

`scanner.read_results`'s prompt/context needs to lead with the pre-computed findings instead of generic "shape of the result set" narration, e.g.:

> "Over the last 4 sessions, IWARE and JUSTDIAL have held Leading-zone status with rising volume each day — the clearest signs of follow-through. 8 stocks are new to the list today, including ABC and XYZ."

The three signal blocks (new/sustaining/rising-RVOL) should be computed facts handed to the LLM to phrase, not raw rows for the LLM to infer trends from — same "compute in code, narrate in prose" principle used everywhere else this session.

## Open questions for owner before build

1. Lookback window — is 4 sessions right for all three signals, or should it vary per scanner/signal?
2. Exact "sustaining" definition for Breakout Surge — literal scan-membership persistence (proposed, most accurate) vs a simpler zone/close-positive proxy?
3. Confirm initial scope: Breakout Surge + Conviction Flow + Stage family, or narrower (Breakout Surge only) for the first build?
4. Date filter: build alongside the trend-signal table for the same scanner set, or ship trend signals first and date filter as a separate follow-up?
