# DristiQ — Product View

## What is it?

DristiQ is a market intelligence platform for Indian traders that fuses two independent engines:

- **Panchāṅgam Engine** — Vedic astronomical time cycles (Tithi, Nakṣatra, Yoga, Vāra, Pakṣa) mapped to historical NSE/BSE market behavior
- **Technical Engine** — Classical market indicators: RSI, breakouts, MagicRS (relative strength vs NIFTY 500), volume patterns, institutional flow detection

When both engines point in the same direction — that is the signal worth attention.

Non-advisory. No buy/sell calls. Like a weather report — shows conditions, trader makes the call.

---

## 1 — Landing Page

Public-facing, unauthenticated. Positions the product.

### Sections

| Section | Content |
|---|---|
| **Hero** | "Where Bharat's ancient sky meets the modern market." Current Śaka year, Panchāṅgam tithi live. Two CTAs: `Explore Beta` (→ login) and `Read the thesis` (scroll). |
| **Non-advisory disclaimer** | Explicit: not investment advice. Atmospheric data only. |
| **§ 01 — The Insight** | The thesis: time governs price. Panchāṅgam is not belief — it is a calendar of atmospheric conditions. Not a signal, an atmosphere. |
| **§ 02 — The Layer** | Four instruments: (A) Panchāṅgam Atmosphere Engine — 5 cycle axes; (B) Astro-Technical Confluence — when both engines agree; (C) Astro Calendar 2026+ — key windows forward-mapped; (D) Code Tagging Intelligence — 4,200+ scrips pattern-flagged. |
| **§ 03 — VaNi** | AI intelligence layer (VaNi = *Vāṇī*, voice of knowledge). Generates factual, educational, non-predictive explanations in astronomical terms. Example: "Mercury combust with elevated Mars — historically correlated with sharp intraday reversals." |
| **§ 04 — The Reader** | Three personas: Technical Trader (adds atmospheric layer to existing RSI/breakout workflow), Astro-Aware Investor (Panchāṅgam mapped to data, not belief), Risk-First Trader (waits for conditions, DristiQ shows the picture). |
| **Origin CTA** | Invite-only beta. Email capture / sign-up prompt. |
| **Footer** | Stack credits, philosophy note, non-advisory restatement. |

---

## 2 — User Features (authenticated, non-admin)

Four views visible to all logged-in users.

### ◉ Dashboard (`/dashboard`)

The daily read. Go/no-go conditions at a glance.

- **Regime badge** — Accumulation / Expansion / Distribution / Capital Protection (4-tier composite)
- **Panchāṅgam card** — Today's Tithi, Nakṣatra, Yoga, Vāra, Pakṣa. VaNi AI interpretation below.
- **Astro Signal badge** — Net market impact for today's planetary configuration
- **Six-day astro outlook strip** — Mon–Sat forward window, color-coded by net signal
- **Astro Intelligence panel** — Active transits, 7-day expanded outlook with rule-matched signals
- **Market Breadth chart** — EMA-based breadth score across NSE universe (% of stocks above trend)
- **Breadth ROC oscillator** — Momentum of breadth (expanding vs contracting participation)
- **Nakshatra-Vara signals** — Today's active Vedic time-rule matches with outcome labels
- **Confluence dot grid** — Visual intersection of astro + technical signals per index
- **Index watchlist** — NIFTY 50, Bank Nifty, NIFTY 500, Midcap, Smallcap — price, MagicRS zone, flow type
- **Sector rotation strip** — Which sectors are rotating in / leading / rotating out

### ⊙ Scanner (`/scanner`)

Six preset scans across ~1,380 NSE equities. All logic runs client-side.

| Preset | Logic |
|---|---|
| Power Buy | Strong MagicRS + rotating-in / leading industries |
| Power Sell | Weak RS + rotating-out / lagging industries |
| Smart Money Loading | High accumulation + rising institutional flow + RS recovery |
| Fresh Breakouts | 20-day highs + RVOL > 2 in top-quartile industries |
| Quiet Accumulation | Non-top industries with rising accumulation (contrarian) |
| Distribution Warnings | Ex-Strong Bull degrading + distribution signals |

Each result card shows: symbol, price, % change, MagicRS zone, RSI, RVOL, flow type. Tap → detail modal. VaNi Opportunity flag surfaced on qualifying stocks.

### ⊞ Market Structure (`/market-structure`)

Macro view of the NSE universe.

- Market breadth detailed chart (full history)
- Breadth ROC chart (momentum oscillator)
- Industry rotation heatmap — all industries ranked by MagicRS
- Confluence heatmap — astro + technical convergence by index

### ☽ Planetary Intel (`/planetary-intel`)

Astronomical event calendar for traders. Two sections:

- **Active Backdrop** — Macro events spanning > 7 days (planetary transits, retrogrades, sign changes). Shows date range + impact label.
- **Events** — Daily / short events ≤ 7 days (eclipses, exact conjunctions, turning dates). Shows exact date + impact label.

Click any event to expand its narrative / inference. Month selector: current + 2 months ahead.

---

## 3 — Admin Features (admin role only)

Visible in the Admin sidebar section. Full platform access.

### ◎ Markets (`/markets`)

All NSE indices and equity symbols. Manage active/inactive flags. View vendor codes, index constituents, sector assignments.

### ⇌ Industry Transition (`/industry-transition`)

Industry rotation panel — tracks rank movement over 5-day windows. Rotating In / Leading / Rotating Out columns. Tap industry → top 10 stocks by MagicRS.

### ⊘ Manipulation Watch (`/manipulation-watch`)

Pump/dump detection. Flags stocks with abnormal RVOL, price divergence, volume-price mismatch patterns.

### ☿ Panchang (`/panchang`)

Daily Vedic panchāṅgam detail — Vara, Nakṣatra, Tithi, Yoga, Pakṣa, D/L/NL match, Ekadashi, Purnima, hemisphere event. Full history table. VaNi interpretation panel.

### ◌ Visual Pulse (`/pulse/:indexId`)

Full-screen sensory dashboard for a single index or equity. Maps each technical indicator to a real-world metaphor:

| Indicator | Metaphor |
|---|---|
| RSI | Cell signal tower (1–5 bars) |
| MagicRS | Ocean wave (height = relative strength) |
| Order Flow | River current (direction + intensity) |
| Institutional flow | Sonar / radar pings |
| Volume | Crowd / stadium density |
| SuperTrend | Wind flag |
| DOT signals (SVD/SBD/SYD) | Stacked traffic lights |
| Astro inference | Sky / celestial backdrop |

Equity Visual Pulse (`/pulse/equity/:equityId`) adds: MagicRS subchart with zone bands, multi-timeframe RS change pills, pump/dump banner, scan presence card, industry context card.

### ✎ Inference DB (`/inference`)

DC (Dasha Cycle) inference rule browser. Read/edit `dc_inference` table entries. Rule text, lookup values, market impact mappings.

### ⊛ Rule Eval (`/rule-eval`)

Manual rule evaluation tool. Run a Vedic rule against historical dates, see match count and outcome distribution.

### ⇝ Risk Transmission (`/transmission`)

Risk propagation view. 4-dimension composite score: Structural (Saturn/Jupiter), Momentum (Mars), Volatility (Moon/nakshatra), Deception (Mercury/Venus). Regime output: Accumulation → Capital Protection.

### ↺ Backtest (`/history`)

Historical backtesting interface. View `km_rule_signals` — matched dates, actual market returns, confidence scores. Fill `km_rule_confidence` table from results.

### ◈ Settings (`/settings`)

Admin-only platform config. Sub-pages:
- **Index Catalog** — 93 NSE indices, active flags, vendor codes
- **Equity Catalog** — ~1,380 equities, index membership, sector
- **Commodity Catalog** — commodity symbols
- **Market Data Hub** — EOD data status per exchange per date
- **Pipeline Dashboard** — daily sync job status, run history

### ▦ Data Pipeline (`/data-pipeline`)

Live pipeline monitor. Health grid (per-job status), job queue, manual run trigger panel.

### ⊟ Panchang Admin (`/admin/panchang`)

Edit and populate `km_daily_panchang` and `km_astro_calendar` entries. Add/edit/delete astro calendar events with impact classification.

### ⊠ Rule Engine (`/rules`, `/rules/:id`)

Vedic astro-market rule registry.

- **Rule list** — All active rules from `km_astro_rule_master`. Filter by rule type, scope, outcome.
- **Rule detail** — Full conditions JSONB, confidence stats (`km_rule_confidence`), last 50 signal instances (`km_rule_signals`), discovery controls.

Rule types: `nakshatra_vara`, `planet_transit`, `planet_state`, `planet_conjunction`, `vedh`, `tithi_alone`, `compound`, `eclipse`.

---

## Role Summary

| Feature group | Public (landing) | User (logged in) | Admin only |
|---|---|---|---|
| Landing page, thesis, VaNi intro | ✓ | ✓ | ✓ |
| Dashboard (regime, panchāṅgam, breadth, watchlist) | — | ✓ | ✓ |
| Scanner (6 presets) | — | ✓ | ✓ |
| Market Structure | — | ✓ | ✓ |
| Planetary Intel | — | ✓ | ✓ |
| Markets, Industry Transition, Manipulation Watch | — | — | ✓ |
| Panchang, Visual Pulse, Inference DB, Rule Eval | — | — | ✓ |
| Risk Transmission, Backtest | — | — | ✓ |
| Settings, Data Pipeline, Panchang Admin, Rule Engine | — | — | ✓ |
