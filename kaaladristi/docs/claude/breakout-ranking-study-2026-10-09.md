# Breakout ranking study — 2026-10-09

**Question (owner, 2026-10-09):** BBOX and MOBIKWIK ran 7–10% today after
earlier moves. What do we miss to pick stocks like these?

**Context.** Both were already on screen before today's move: Breakout Surge
listed both on 6 and 7 Oct (209 and 199 names those days); BBOX also entered
Stage 2 on 6 Oct. MOBIKWIK's first Golden Line close (5 Oct) was not on any
screen — `gl_event` needs a volume dot within ±5 calendar days, the dot came
with the +20% day on 6 Oct, and the 5 Oct bar was relabelled BREAKOUT
afterwards. So the hypotheses tested were: (1) ranking Breakout Surge by how
many signals agree would have floated names like BBOX; (2) an early
"crossed the Golden Line, no volume yet" watch would have caught MOBIKWIK.

**Nothing was built. Nothing changes because of this.** Read-only, via the
`kaala-postgres` MCP.

## Envelope

| | |
|---|---|
| Source | `km_equity_eod`, NSE active non-ETF, rebuilt from bars (the saved scanner lists start 2026-08-20, only 34 sessions) |
| Breakout Surge rule | `pct_chng > 0 AND pct_from_breakout > 0` — the matview arm verbatim |
| Window | 2026-05-01 → 2026-09-30, **105 sessions** (~21 non-overlapping 5-day periods) |
| Horizon | 5 sessions; excess = forward return − same-date universe median, per event |
| Events | 30,663 Breakout Surge events |
| Cliffs (0.55× / 1.80×) | **37 dropped** |
| No exit bar (survivorship) | **91**, excluded and reported here |
| Coverage | `rvol` complete from May; `stage` complete only from **August** (tested on H2 only) |
| Split | H1 = May–Jul, H2 = Aug–Sep |

## 1. "More signals agree" ranks the WRONG way

Agreement count = Strong Bull zone + MagicRS rising (5d) + volume dot (SVD/SBD)
+ rvol ≥ 3.

| signals agreeing | n | median excess | mean excess | % positive |
|---|---|---|---|---|
| 0 | 4,441 | **+0.75** | +2.38 | 55.5 |
| 1 | 8,813 | +0.23 | +1.16 | 51.9 |
| 2 | 11,830 | +0.14 | +1.22 | 51.0 |
| 3 | 3,047 | **−0.41** | +0.79 | 47.3 |
| 4 | 2,405 | −0.18 | +1.31 | 48.8 |

Every mean is positive while the medians turn negative — trap 2 again. **A
confluence ranking would have put the worst cohort on top. Refused.**

## 2. Signal by signal, both halves

| signal | half | with: n / median / %pos | without: n / median / %pos | verdict |
|---|---|---|---|---|
| rvol ≥ 3 | H1 | 3,762 / **−0.44** / 47.1 | 13,166 / +0.19 / 51.5 | **stable negative** |
| | H2 | 3,004 / **−0.28** / 48.4 | 8,066 / +0.49 / 53.3 | |
| day ≥ +5% | H1 | 4,159 / **−0.34** / 48.2 | 14,324 / +0.20 / 51.5 | **stable negative**, smaller in H2 |
| | H2 | 3,001 / +0.16 / 50.8 | 9,052 / +0.39 / 52.7 | |
| volume dot | H1 | 2,152 / −0.08 | 16,331 / +0.13 | no effect |
| | H2 | 1,676 / +0.36 | 10,377 / +0.34 | |
| Strong Bull zone | H1 | 10,144 / −0.13 | 5,127 / +0.11 | flips — no effect |
| | H2 | 5,577 / +0.29 | 4,346 / +0.11 | |
| zone NULL (young listing) | H1 | 3,212 / **+0.68** / 54.8 | — | **stable positive** |
| | H2 | 2,130 / **+0.95** / 56.0 | — | |
| MagicRS rising 5d | H1 | 14,972 / −0.02 | 679 / +0.68 | can't discriminate — 95%+ of breakouts have it |
| | H2 | 9,947 / +0.23 | 293 / +0.61 | |
| Stage S2 | H2 only | 3,798 / **+0.70** / 54.4 | 8,255 / +0.16 / 51.3 | promising, **unconfirmed** (one half) |

**Loud breakouts lose, quiet ones win.** High relative volume and a big day
both underperform the rest of Breakout Surge in both halves. MOBIKWIK
(rvol 18.5, +20%) is the shape that mean-reverts **on average**; it was the
exception, not the template. Same direction as the 2026-09-23 SVD finding
(SVD requires `pct_chng > 9`, median −1.80 pts).

## 3. The early Golden Line watch would have lost

At the crossing bar (`gl_days_above = 1`), judged only on what was known that
evening (a dot in the PRIOR 5 sessions, no lookahead):

| group | half | n | median | mean | % pos |
|---|---|---|---|---|---|
| crossed, no dot yet | H1 | 3,607 | **−0.32** | +0.52 | 47.1 |
| | H2 | 1,737 | **−0.66** | +0.51 | 44.4 |
| crossed, dot already known | H1 | 817 | **−0.69** | +0.62 | 45.9 |
| | H2 | 402 | **−0.69** | +1.49 | 46.3 |
| Breakout Surge, everything else | H1 | 17,034 | +0.16 | +1.13 | 51.2 |
| | H2 | 11,440 | +0.40 | +1.74 | 52.6 |

**Refused.** A Golden Line crossing underperforms the market for the next five
sessions in both halves, with or without volume.

## 4. The stored Golden Line breakout label uses future data — and still flips

`gl_event = 'BREAKOUT'` is rewritten over a trailing 7-day window using dots
up to 5 days AFTER the bar (`compute_gl_events_for_date`). That is correct for
a live list (the event becomes visible when it is confirmed) but it means the
STORED history knows the future.

| stored label at the crossing bar | half | n | median | % pos |
|---|---|---|---|---|
| labelled BREAKOUT (later dot) | H1 | 460 | **−0.85** | 45.7 |
| | H2 | 359 | **+0.65** | 52.4 |
| crossed, never labelled | H1 | 3,964 | −0.33 | 47.0 |
| | H2 | 1,780 | −0.74 | 43.3 |

Even with hindsight it flips sign between halves. ⚠ **Any backtest, chart
marker or VaNi fact built on stored `gl_event` history is lookahead-biased.**
Measure from `gl_days_above = 1` plus PRIOR dots, as above.

## Decided NOT to do

- No "signals agree" ranking — it ranks the worst cohort first.
- No early Golden Line watch — negative in both halves.
- No change to Breakout Surge membership.
- No Stage-2 ranking yet — it has one half of history. **Re-run in mid-November**
  when stage covers Aug–Oct, splitting Aug–Sep vs Oct–Nov.

## Worth a follow-up, measured not assumed

- **Quiet over loud.** Within Breakout Surge, `rvol < 3` and `pct_chng < 5`
  beat their complements in both halves (~0.5–0.8 pts over 5 days). A sort or
  a highlight, not a gate, once Stage 2 is confirmed alongside it.
- **Young listings** (no MagicRS zone yet: < 145 bars) beat the rest in both
  halves (+0.68 / +0.95). Check it is not one IPO cohort before using it.
- Effect sizes are small: Breakout Surge as a whole sits at +0.16 / +0.40
  median excess. None of these would have reliably picked BBOX or MOBIKWIK.

## Addendum, same day — starting from the +5% days themselves

Owner: *"I miss most running 5% and above, there is something I am missing."*

**Recall.** 20 Aug → 8 Oct, NSE active non-ETF, mcap ≥ ₹100 Cr: **2,833** days of
+5% or more (~86 a session). **455 (16%)** were on a signal screen the evening
before — 435 of them Breakout Surge, 34 Golden Line Breakout. (The saved
daily lists cover the matview presets only, so Stage / Discovery / Flow
membership is not counted; true recall is somewhat higher.)

**Lift of day-before signals for a next-day ≥ +5%** (May → 7 Oct, next-day
moves beyond ±25% dropped as data errors):

| signal (evening before) | H1 n / P(≥+5%) / lift | H2 n / P(≥+5%) / lift |
|---|---|---|
| base rate | 145,107 / 4.05% / 1.00 | 106,254 / 3.80% / 1.00 |
| SVD dot | 430 / 14.4% / 3.56 | 315 / 19.7% / 5.18 |
| today ≥ +5% | 5,889 / 13.4% / 3.30 | 4,198 / 14.6% / 3.85 |
| SBD dot | 2,376 / 12.9% / 3.18 | 2,009 / 13.9% / 3.66 |
| rvol ≥ 2 | 12,651 / 7.8% / 1.93 | 10,326 / 8.2% / 2.17 |
| Breakout Surge | 16,161 / 7.1% / 1.75 | 10,162 / 8.2% / 2.17 |
| 8+ volume spurts in 22 sessions | 2,891 / 6.7% / 1.65 | 3,868 / 6.6% / 1.74 |
| within 5% of 52-week high | 11,159 / 5.4% / 1.34 | 8,954 / 6.3% / 1.65 |
| Stage S2 | — | 21,146 / 5.4% / 1.43 |
| rvol < 0.9 | 97,931 / 3.3% / 0.82 | 71,570 / 2.9% / 0.76 |
| MagicRS falling 5d | 68,792 / 3.4% / 0.84 | 51,454 / 3.1% / 0.81 |

Stable in both halves. **But the same signals raise the next-day ≤ −5% rate
almost as much** — they predict a BIG move, not an UP move. Ratio of
P(≥+5%) to P(≤−5%), by company size, pooled:

| signal | <₹500 Cr | 500–2k | 2k–10k | 10k+ |
|---|---|---|---|---|
| base | 1.63 | 2.24 | 2.48 | 2.32 |
| Breakout Surge | 1.82 | 1.99 | 2.08 | 2.11 |
| rvol ≥ 2 | 1.56 | 1.57 | 1.70 | 1.76 |
| SBD dot | 2.43 | 1.77 | 2.34 | 2.00 |
| SVD dot | 1.41 | 1.13 | 1.59 | 2.67 |
| near 52-week high | 1.67 | 1.96 | 2.42 | 1.91 |
| **today ≥ +5%** | 1.88 | **2.66** | **2.67** | **3.10** |

Only "today ≥ +5%" tilts the odds toward UP beyond the base ratio, and only
above ₹500 Cr (continuation). Everything else moves both tails together.

**What is missing is not a signal we failed to combine:**
1. **Direction is not in the end-of-day data.** The evening before, a +5%
   runner and a −5% faller look the same. Our screens find the
   about-to-move; the runners remembered are the winning half.
2. **Most +5% days come from nowhere** — 84% were on no signal screen the day
   before. The move starts and ends inside one session, and we see the day
   after the close (filings: a mid-session filing is a tomorrow fact for us).
   OPTIEMUS was caught at 09:45 by a 15-minute MagicRS/SVD turn, not by EOD.
   `km_equity_15m` is schema-only.
3. **One real tilt:** after a +5% day, a stock above ₹500 Cr is ~2.7–3.1×
   more likely to add another +5% than to give back 5%, against ~2.3× base.

Nothing built.
