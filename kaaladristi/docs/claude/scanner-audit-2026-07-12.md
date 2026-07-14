# Scanner Audit — 2026-07-12 (current state · improvements · new-scanner roadmap)

> **Implementation log — 2026-07-14 (branch `claude/session-init-kbwxau`).**
> Consolidation + first new scanner shipped. Each item pushed with its migration:
> - **B1 — Fresh Breakouts retired** → merged into Breakout Surge (superset; its
>   only extras, an industry-leader gate + rvol>2, are recoverable via the
>   ScanFilterBar `industries` filter + rvol column). Handler/preset removed;
>   `migration 152` deactivates the `kd_scan_presets` row.
> - **B2 — VaNi Strength Watch retired** → it was Stage 2 Leaders filtered to the
>   top-conviction VaNi subset; Stage 2 Leaders already computes per-row
>   `vaniOpportunity` and carries a ✦ VaNi Highlight filter, so no capability lost.
>   Function/catalog/stage-family layout entries removed; `migration 153`.
> - **B3 — Smart Money gate softened.** `pct_accumulation` is low-skewed (median
>   industry ~15%, max ~67%), so the absolute `>60` gate fired for 0–1 industries
>   and left the tab chronically empty. Now `>55 OR top-decile by accumulation`;
>   on 2026-07-13 that yields 43 candidates → top 25 (was ~0). Frontend-only.
> - **C1 — Flower Pot Burst BUILT** (owner priority #1). Compression→release scan,
>   two phases (Coiling Setups watchlist + rare Bursts). Pure client-side TS with
>   its own on-demand 60-session fetch (no shared-bundle bloat, no pipeline/backfill
>   deploy). Thresholds **calibrated to live NSE data** — the spec's ATR15/ATR60<0.5
>   gate fired for 12/1,232 stocks (<0.35 → zero); calibrated 0.8 gate → ~4 coiling
>   today / 26 over 10 sessions / 37 over 22; bursts ~2×/month. `migration 154`
>   registers the tab. Deferred to a possible v2: DB-side `km_fpb_active` state
>   table for a persistent SETUP watchlist + Day-2 CRACKED/HOLDING tracking.
>
> **Owner deploy required on the VPS**: run migrations **152, 153, 154** (all target
> `kaala_dristi_db`) — until then the retired tabs stay visible and the FPB tab
> only flickers in from the static fallback before the DB preset list replaces it.
> The zone-vocabulary fix (§2.2) and the `rs_percentile` regression (§2.1) were
> resolved earlier this session.



Read-only audit of the scanner system. Grounded in: exact code conditions for
all 14 scans (`src/services/scanEngine.ts`), **live DB state as of trade date
2026-07-10** (via the read-only MCP connector), the matview parity work
(`SCAN_MATVIEW_IMPLEMENTATION.md`), the data-gap docs, and the owner's spec
documents in `docs/scanners/`. Owner decisions from this session are marked
**[OWNER]**.

---

## 1. Inventory — what exists today

**14 scanners in two architectures** (CLAUDE.md's "9" is stale):

| Family | Scanners | Architecture |
|---|---|---|
| Flow / Market / Price-action (7) | Strength Confluence, Weakness Confluence, Smart Money Loading, Fresh Breakouts, Quiet Accumulation, Distribution Warnings, Conviction Flow | **Bundle path**: downloads ~120–240k EOD rows to the browser and filters in JS — the slowness users feel. Fix exists: `km_scan_results` matview (migration 147, written + parity-verified **EXACT on all 7**) — **NOT yet deployed** (verified absent in DB) |
| Stage Analysis (6) + Breakout Surge | Stage 2 Leaders, Stage 2 Watch, VaNi Strength Watch, Stage 3 Watch, Stage 4 Leaders, VaNi Weakness Watch, Breakout Surge | **Direct-query path**: one latest-date DB query + JS post-filter — fast |

Universe: 7,949 active symbols (1,445 NSE / 6,504 BSE); ~5,340 EOD rows/day.
Weekly/monthly timeframes: bundle scans only; the direct-query scans always
run daily (they ignore the timeframe toggle).

## 2. 🔴 Broken right now — fix before building anything new

1. **`rs_percentile` NULL for every stock since 2026-06-19** (worked before;
   silent pipeline regression). Live consequences:
   - **VaNi Weakness Watch returns ZERO results every day** (filters
     `rs_percentile < 20`; verified 0 rows pass)
   - **Four scans are mis-ordered** (Stage 2 Watch, VaNi Strength Watch,
     Stage 3 Watch, Stage 4 Leaders sort by the NULL column → effectively
     random order presented as a ranking)
2. **Zone vocabulary split**: DB writes a 7-band `magic_rs_zone` scheme; the
   frontend `VALID_ZONES` knows 5. **2,538 stocks (47.5%)** carry
   `Neutral Bear`/`Neutral Bull` labels the UI blanks — and **Distribution
   Warnings silently misses** the Strong Bull → Neutral Bear slider, its most
   natural candidate class.
3. **Smart Money Loading is a near-empty tab**: industry gate
   `pct_accumulation > 60` cleared on only 11 industry-days in 120 (max was
   exactly 60.0 on the audited date). Users read empty as broken.
4. **VaNi Strength Watch code ≠ docstring**: promises "RS percentile > 80 +
   Alpha Edge, top 25"; code has neither gate and returns up to 50.
5. **Prices are not split/bonus-adjusted** (`km_corporate_actions` is EMPTY —
   0 rows; `adj_factor` never applied). Every multi-day derivative (SMA/EMA,
   52w high/low, returns, MagicRS, stage) is wrong across a split window.
   Scanners inherit this ceiling on trustworthiness.
6. Minor: Breakout Surge's "20-day high" is actually prior-20-**closes**
   (scanEngine ~line 920) — mislabeled, slightly looser than users assume.

## 3. Per-scanner strength assessment

| Scanner | Strength | Notes |
|---|---|---|
| Breakout Surge | ★★★★ | Best of roster: precomputed levels, ~549 candidates/day, clear premise, fast. Fix the closes-vs-highs label |
| Stage 2 Leaders | ★★★★ | Sound Weinstein logic on DB `stage` (715 S2 stocks); MagicRS-ranked; fast |
| Conviction Flow | ★★★½ | Delivery-surge premise genuinely differentiated (institutional footprint); tight gates |
| Stage 2 Watch | ★★★ | Good early complement — **ranking currently broken** (rs_percentile) |
| Stage 4 Leaders / Stage 3 Watch | ★★★ | Sound avoid/exit lists (S4 = 2,113 stocks = 40% of market in this regime) — **ranking currently broken** |
| Strength / Weakness Confluence | ★★½ | Thoughtful Wyckoff-OR-confluence design, but slow (bundle), opaque to users, hostage to the 77%-LOW_VOLUME flow artifact |
| Fresh Breakouts | ★★ | Near-duplicate of Breakout Surge + industry gate + rvol>2 |
| Quiet Accumulation | ★★ | Nice contrarian idea; fragile sniper-trend conditions, unexplainable rows |
| Distribution Warnings | ★★ | Good premise, hurt by the zone-vocabulary gap |
| Smart Money Loading | ★½ | Near-empty tab most days (gate too strict) |
| VaNi Strength Watch | ★★ | ~15/day is a good conviction size, but code ≠ promise; flag history too shallow to prove edge |
| VaNi Weakness Watch | ☆ | **Returns nothing, for 3+ weeks** |

## 4. User-value verdict

The roster is engine-out, not user-in. Users ask four questions — *what do I
buy now / what do I buy on a dip / what do I avoid or exit / what's about to
move* — and 14 tabs force them to reverse-engineer which tab answers which.
Three pairs overlap materially (Fresh Breakouts ≈ Breakout Surge; Stage 2
Leaders ≈ VaNi Strength Watch; Weakness Confluence ≈ Stage 4 / Distribution
Warnings). Nothing serves "buy the dip" or "about to move" (until FPB — §6).

## 5. Improvements, prioritized

1. **Fix the `rs_percentile` pipeline** (P0 — revives one dead scanner + four
   rankings; it worked until 19-Jun, so diff the nightly run around that date).
2. **Deploy the matview** (migration 147; parity already verified). Converts
   7 slow scans from a 200k-row browser download to one indexed query.
3. **Unify zone vocabulary** (7-band everywhere or an explicit DB→5 map) and
   add the Neutral-Bear slide to Distribution Warnings' accepted set.
4. **Merge overlapping tabs**: Fresh Breakouts → a filter toggle on Breakout
   Surge; VaNi Strength Watch → a "VaNi ✦" filter/badge on Stage 2 Leaders.
   14 tabs → ~9 stronger ones.
5. **Soften Smart Money's gate** (>55 or top-decile) or show "0 today · last
   hit <date>" so selectivity doesn't read as breakage.
6. **Make VaNi Strength Watch honest** (implement RS>80 + top-25, or fix the
   description).
7. **Populate `km_corporate_actions` from the NSE CA archive** — fixes the
   dividend gate for Waking Giants AND delivers `adj_factor` split adjustment
   (the deep data-integrity fix) in one ingest. Highest-leverage item.
8. Per-row "why am I seeing this" explanations — conditions are known at scan
   time; showing them costs nothing and kills the black-box feel.

## 6. New scanners — assessment & build order

### Build order **[OWNER 2026-07-12]**: Flower Pot Burst first, then Waking Giants (age gate reduced 20yr → 10yr)

### 6a. 🌸 Flower Pot Burst (`docs/scanners/FLOWER_POT_BURST_RULE.md`) — BUILD-READY
Volatility compression → volume death → explosive release → day-2 crack/hold.
Fills the unserved "what's about to move" job; zero overlap with the 14.
- **Data**: OHLCV/atr_14/rsi_14/magic_rs/stage/delivery_pct all populated
  (spec's "Needs Addition" list is stale — delivery_pct shipped long ago).
  Needs 3 rolling computations (ATR-15/60 compression, body compression,
  vol-death) + a small `km_fpb_active` state table.
- **Architecture**: build DB-side (matview/SQL pattern) — the browser bundle
  only loads ~30 sessions; FPB needs 60-day baselines.
- **Before shipping**: calibrate thresholds against actual distributions
  (house lesson: check percentiles first; nobody knows if SETUP fires on 5
  or 500 stocks/day until measured).

### 6b. 🏛 Waking Giants (`docs/scanners/WAKING_GIANTS_RULE.md`) — spec strong, Layer 0 is the blocker
Dormant 10-year-plus legacy companies + silent GL accumulation (Phase 1) +
daily/weekly RS-slope divergence push (Phase 2). Weekly cadence.
- **Technical phases ~80% computable today**: delivery_pct ✅, sma_150 ✅,
  weekly `magic_rs` **already exists** in `km_equity_weekly` ✅ (spec stale),
  monthly OHLC for candle patterns ✅. Needs: GL_acc_days rolling compute,
  3-yr-high backfill (where unadjusted splits bite hardest — see §5.7).
- **Layer 0 (fundamentals watchlist) = 0% data**: revenue CAGR, EBITDA, D/E,
  promoter holding/pledge, dividends, ASM/GSM — none exist in the platform.
- **v1 path**: CURATED watchlist (quarterly, owner-reviewed, LLM-assisted —
  the Custom Index Discover pattern already proves this) unblocks Phases 1–2
  immediately; fundamentals automation hardens it later.
- **Universe math at 10 years** (verified): `listing_date` exists in
  `km_equity_symbols` (populated 1,984 of 7,949); **501 active NSE stocks
  already pass the 10-yr gate** → after ₹200 Cr mcap + ₹1 Cr ADV + dormancy
  gates, lands near the spec's 100–150 watchlist size.

### 6c. Also recommended (from the audit, not yet spec'd)
- **Pullback in Leaders** — the unserved "buy the dip" job: stage=S2, close
  within ±2% of EMA20/SMA50, rvol<0.8 (dry-up), zone still Bull. All columns
  exist today; fastest ship of everything here.
- **RS-Rotation quadrant scanner** — already fully spec'd in
  `docs/claude/Rsspec.md` (Improving/Weakening quadrants none of the 14
  cover); needs only `magic_rs_roc`.
- **Astro-Technical Confluence** — Stage 2 / Bull-zone stocks during
  favorable astro windows (`km_astro_daily_signal`). The differentiator no
  competitor can copy; the pre-launch audit's #1 gap ("astro and stocks
  never fuse"). SEBI-safe framing required.
- **52-Week-High Approach** — within 5% of w52_high with delivery support;
  columns populated.

## 7. Data sourcing for Waking Giants Layer 0 **[OWNER: 10-yr age gate]**

| Gate | Source | Notes |
|---|---|---|
| Age ≥ 10 yr | ✅ own DB `listing_date`; backfill gaps from **NSE `EQUITY_L.csv`** (official securities master, has Date of Listing) | Free, hours |
| ASM/GSM exclusion | **NSE official** daily ASM/GSM lists | Free, small daily ingest |
| Promoter holding + pledge | **NSE quarterly SHP filings** (JSON endpoints; same session-cookie infra as bhav downloads). `NSE_FILINGS_INTELLIGENCE.md` §SHP already designs this | Free, ~2–3 days |
| Dividends (2-of-5-yr) | **NSE corporate-actions archive** → fills the EMPTY `km_corporate_actions` (+ adj_factor side-benefit, §5.7) | Free — do this regardless |
| Revenue CAGR / EBITDA / D:E | **yfinance** (already a dependency; `.NS` tickers) for the automated quarterly refresh; **Screener.in manual CSV export** as the owner's cross-check during quarterly review — do NOT scrape Screener (ToS liability for a commercial product); NSE XBRL results parsing is the proper long-term source | Free / gray-manual / heavy |

**Filings vocabulary** (for the roadmap): *NSE filings* = the umbrella channel
(everything under SEBI LODR). *Quarterly results* = the structured-numbers
filing (XBRL, within 45 days of quarter end) → feeds Layer 0. *Concalls* =
qualitative narrative filed as announcements days later → not needed for
FPB/WG v1, but transcripts are prime future VaNi material (LLM reading
"management commentary turned positive on a Giants-watchlist stock" —
see `PEAD_FRAMEWORK.md`).

## 8. Cross-cutting rules for both new scanners

1. **Atmospheric gate ships later**: both specs gate on daily `dc_score ≥ 65`
   + panchang overrides. Panchang exists; a materialized daily dc_score does
   NOT (risk engine is a prototype). Ship v1 without the gate — the specs
   treat it as a quality *tier*, so this degrades gracefully.
2. **SEBI language (D39)**: the specs' alert copy ("ENTER WITH CONVICTION",
   SL/target frameworks) cannot ship as UI strings. Logic yes; surfaced copy
   must be observational ("Compression release detected · historically
   followed by 48–96h continuation").
3. **Confidence tracking before conviction stars**: honor the specs' own
   minimums (30 signals WG / 50 FPB in `km_rule_confidence`) before any
   ★-rating is displayed.
4. **Threshold calibration first**: run distribution percentiles on every
   numeric gate before shipping (the `sniper_inst 0–40` lesson).

## 9. Recommended sequence

```
0. rs_percentile pipeline fix + matview deploy + zone-vocab unify   (repair the foundation)
1. NSE corporate-actions ingest (dividends + adj_factor)            (unlocks WG gate + split adjustment)
2. Flower Pot Burst (DB-side, thresholds calibrated, SEBI copy)     [OWNER: first]
3. Waking Giants v1 (10-yr gate, curated watchlist, no astro gate)  [OWNER: second]
   — Layer-0 ingests (SHP, yfinance financials) run in parallel with 2
4. Tab merges (§5.4) + Pullback in Leaders + Astro-Confluence
5. dc_score materialization → atmospheric gates on FPB/WG
```

## Appendix — empirical evidence (live DB, trade date 2026-07-10)

- 7,949 active symbols (1,445 NSE / 6,504 BSE); 5,337 EOD rows on date
- `rs_percentile`: 0 populated on every date since 2026-06-19 (last populated
  date verified: 2026-06-19; 570,792 rows populated earlier in 2026)
- Stage distribution: S4 2,113 · UNKNOWN 1,461 · S2 715 · S3 547 ·
  S2_CANDIDATE 291 · S1 210
- Zones: `Neutral Bear` 1,419 + `Neutral Bull` 1,119 = 2,538 (47.5%) outside
  the frontend's 5-zone vocabulary
- `flow_type`: LOW_VOLUME 4,132 (77%) — the volume-scale-discontinuity
  artifact; treat as neutral, never as a bearish signal
- VaNi flags (that day): s2 15 · surge 7 · breakout 10 · smart 20 · weak 49 ·
  distrib 2; `stage='S4' AND rs_percentile<20` → **0 rows** (Weakness Watch)
- Breakout Surge gate: 549 candidates; `km_corporate_actions`: **0 rows**;
  `listing_date ≤ 2016-07-12`: 829 active (501 NSE)
- BSE `delivery_surge_x` is now non-zero for many BSE rows (older
  "always 0 for BSE" note is outdated)
