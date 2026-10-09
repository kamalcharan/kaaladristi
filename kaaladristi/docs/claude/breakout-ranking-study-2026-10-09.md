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

## Addendum 2 — the owner's rules, with the next day as confirmation

Owner: *"rs spike, tvol, just crossed 21 ema, gl cross, svd, sbd … we will know
svd, sbd only eod, which means they already ran for the day … all these
signals are open for interpretation for next day."*

Definitions (end-of-day, no lookahead): **RS spike** = MagicRS up ≥ 4.8 points
in one session (top 5% of one-day changes, Aug–Sep, measured); **TVOL** =
rvol ≥ 2; **EMA cross** = close crosses above `ema_20` (21 is not stored —
nearest available); **GL cross** = `gl_days_above = 1`; **SVD / SBD** = that
day's dot. NSE active non-ETF, mcap ≥ ₹100 Cr, setups 1 May → 29 Sep.
"Next day" classes: closes ABOVE the setup day's high / inside / BELOW its
low. Outcome: the 5 sessions after the next day's close, minus the same-date
universe median.

| setup | next day | H1 n / median / %pos | H2 n / median / %pos |
|---|---|---|---|
| every bar | held above high | 28,861 / −0.11 / 49.0 | 16,974 / −0.11 / 49.0 |
| | closed below low | 36,337 / +0.26 / 52.8 | 24,797 / +0.15 / 51.8 |
| SVD | **held above high** | 129 / **−2.45** / 36.4 | 87 / **−3.15** / 37.9 |
| | inside | 297 / −1.13 / 42.4 | 198 / −0.89 / 44.4 |
| SBD | held above high | 839 / −0.70 / 46.5 | 659 / −0.10 / 49.2 |
| | inside | 1,470 / −0.32 / 47.4 | 1,129 / −0.06 / 49.8 |
| RS spike | held above high | 2,162 / −0.74 / 45.5 | 1,737 / +0.22 / 51.3 |
| | inside | 3,605 / −0.63 / 45.5 | 2,671 / +0.02 / 50.1 |
| TVOL ≥ 2 | held above high | 2,535 / −0.02 / 50.0 | 1,931 / +0.12 / 50.6 |
| | inside | 7,959 / −0.18 / 48.4 | 5,920 / −0.03 / 49.7 |
| EMA cross | held above high | 2,609 / −0.20 / 48.4 | 1,462 / −0.17 / 48.8 |
| | inside | 5,847 / −0.30 / 46.8 | 3,931 / −0.24 / 47.3 |
| GL cross | held above high | 1,087 / −0.45 / 46.3 | 413 / −0.75 / 46.0 |
| | inside | 2,302 / −0.38 / 46.0 | 1,090 / −0.57 / 44.1 |

(Classes with n < 70 omitted from the conclusions.)

**Rules combined** (count firing the same day, capped at 3):

| rules | H1 n / next-day ≥+5% / ≤−5% / 5d-after median | H2 |
|---|---|---|
| 0 | 120,024 / 3.5% / 1.7% / +0.03 | 77,746 / 3.2% / 1.3% / 0.00 |
| 1 | 18,706 / 5.7% / 3.0% / −0.08 | 11,877 / 5.5% / 2.6% / +0.03 |
| 2 | 3,757 / 8.6% / 4.1% / −0.41 | 2,695 / 8.5% / 3.7% / −0.09 |
| 3+ | 2,503 / **11.8%** / 7.4% / **−0.76** | 1,937 / **13.9%** / 4.5% / **−0.31** |

**Findings.**
1. The rules find TOMORROW's movers: 3+ firing triples the next-day ≥+5%
   rate (11.8–13.9% vs 3.2–3.5%), both halves. The down tail rises with it;
   the up/down tilt is 1.6× in H1 and 3.1× in H2 — not stable.
2. **A next-day close above the setup high is NOT confirmation.** Across
   every bar it is followed by −0.11 against +0.15/+0.26 for a close below the
   low (five-day mean reversion). After an SVD it is the worst outcome
   measured: **−2.45 / −3.15, 36–38% positive** — chasing a confirmed SVD is
   a reliable loss.
3. Holding past the next day loses: 2+ and 3+ rules are negative 5 days after
   the next day, both halves.

**So the edge, if any, is inside day t+1** — whether the move continues is
decided in the first part of the next session, which end-of-day data cannot
see. These rules are a WATCH list for the next open, not a hold list.
Nothing built.

## Addendum 3 — NIFTY 50 RS = strength, MagicRS = timing

Owner: *"rs against nifty 50 becomes strength and magicrs becomes time to
pounce?"* The NIFTY 50 RS in the product is the **Rel N50** set
(`rel_*_n50` = stock return − NIFTY 50 return, derived in the matview; its
tooltip still says "Not currently populated", which looks stale). Rebuilt here
from `km_equity_eod.ret_22d/ret_66d` and `km_index_eod` (index_id 1).

- **Strength** = beating NIFTY 50 over BOTH 22 and 66 days.
- **Timing** = MagicRS crosses above its MagicMA that day (`magic_rs > magic_ma`,
  yesterday `<=`).
- NSE active non-ETF, mcap ≥ ₹100 Cr, setups 1 May → 9 Sep (so every event has
  a full 20-session window), excess vs same-date universe median, cliffs
  dropped. H1 = May–Jun, H2 = Jul → 9 Sep. ⚠ 20-session windows overlap: only
  ~6 independent periods.

| strength | timing | half | n | 5d median | 20d median | 20d mean | 20d %pos |
|---|---|---|---|---|---|---|---|
| **leader vs N50** | **MagicRS crossed up** | H1 | 833 | +0.15 | **+0.39** | +1.97 | 51.7 |
| | | H2 | 1,448 | +0.23 | **+1.27** | +4.47 | 55.5 |
| leader vs N50 | no cross | H1 | 39,650 | −0.06 | +0.27 | +2.32 | 51.2 |
| | | H2 | 37,125 | +0.20 | +0.70 | +3.05 | 53.0 |
| not leader | **MagicRS crossed up** | H1 | 1,317 | −0.34 | **−1.09** | +0.94 | 44.3 |
| | | H2 | 2,256 | −0.48 | **−0.88** | +1.41 | 45.1 |
| not leader | no cross | H1 | 37,399 | +0.06 | −0.18 | +1.57 | 49.0 |
| | | H2 | 65,528 | −0.07 | −0.38 | +1.82 | 47.9 |

**Findings (both halves agree on sign):**
1. **NIFTY 50 RS is real strength.** Leaders beat non-leaders by ~0.5–1.1
   pts over 20 sessions.
2. **A MagicRS cross on a NON-leader is a trap** — the worst cell, −1.09 /
   −0.88, 44–45% positive, WORSE than doing nothing (−0.18 / −0.38). This is
   the documented MagicRS weakness: a laggard crosses its own depressed mean
   without beating anything.
3. **Inside leaders the cross is a mild timing boost** (+0.12 H1, +0.57 H2 over
   leaders without it). Same sign twice, small, and H1 barely registers.
4. Best vs worst cell: ~1.5–2.1 pts over 20 sessions.

**So:** strength gates, timing refines — never the reverse. Re-run in
November for more independent periods. Nothing built.
