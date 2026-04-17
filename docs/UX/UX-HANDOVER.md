# Kāla-Drishti — UX Rework Handover

**From:** UX design session (moderated by Charan)
**To:** Claude Code, implementation
**Accompanying artifacts:** 4 locked HTML mockups
- `dashboard-LOCKED.html`
- `scanner-LOCKED.html`
- `industry-transition-LOCKED.html`
- `vani-drawer-v2.html`

---

## 1. Why this rework exists

V1.0 shipped. Investor demos happened. The product's analytical substance was real, but the UX didn't read as agentic — it read as a dashboard with smart widgets. Investor feedback, verbatim:

- *"Looked too much like a generic dashboard / not differentiated."*
- *"Didn't feel 'intelligent' — felt static/manual."*
- *"Too much data, not enough narrative/guidance."*
- *"Hard to understand what to do with the information."*
- *"Systemic UX issue, not screen-specific."*

The brief from Charan, in his words: *"we will slowly look to bring out an agentic UI — unparalleled UX."* The reference point chosen was **ContractNest / VaNi** — nudge, handhold, expressive agentic UI, but without turning everything into LLM calls. *"Intelligent Agentic UX, not a kind 100% Agentic AI."*

The user this UX is designed to protect: **the disciplined swing trader in planning mode, end-of-day** (ranked #1). Then the new-to-astro skeptic (#2). Then the returning user (#3). Then finally the rattled intraday trader (#4). This ranking matters — it's why the product is calm and slow, not adrenalised.

---

## 2. The core reframe — what "agentic UX" means for this product

The biggest mental shift from V1.0 → V2, articulated across the design session:

> **"Dashboard says — here is the data, here are the charts. Agentic UI says — I have laid it out for you so you understand better."**
> — Charan

The arrangement itself is the intelligence. The user isn't handed raw panels at equal weight and asked to reconstruct what matters — the system has already decided what stands out today, foregrounded it, and quieted the rest. Explanation is not the agentic move; **composition is.**

A second, equally important principle:

> **"UX is not about explaining (let chat do it). UX is about making user understand easily towards adoption."**
> — Charan

Screens carry posture and headlines. **Chat carries explanation.** The page must be legible at a glance — not through paragraphs, but through arrangement, colour, hierarchy, glyphs, sparklines, and one-line headlines. When the user wants to go deeper, they ask VaNi. Every screen should pass the test: *"Could this have shown me the same insight without the prose?"*

And a third that locks the product position:

> **"This is not sell/buy recommendation — this is all about identifying opportunities and helping understanding the data towards better decision making."**
> — Charan

Every sentence VaNi produces, every chip, every badge, every trail of stats must honour this line. "Observation over action." "Conditions today favor preservation behavior." Never "buy." Never "sell." Never "you should."

---

## 3. The design language, named

These patterns emerged through the iterations and should be treated as the product's vocabulary. Re-use them consistently across screens:

### 3.1 The Headline
Each significant unit (industry row, Dashboard item) carries a one-line, deterministic-rule-generated **headline** that names what's distinctive about it today. Example: *"Something is cooking in Textiles — 3.4× delivery volume surge over 5 days."* The headline is the hero; numbers support it, never lead.

- **Rule-based, not LLM-based.** Consistency is what teaches the user. Same condition → same sentence, every day.
- Built as a library of *trigger → headline template* pairs. Each industry/item evaluates all applicable triggers and picks the top-ranked one.
- Kicker line above the headline names the trigger category (*"Something is cooking," "Just came into focus," "Holding leadership," "Diverging — watch carefully,"* etc.)

### 3.2 VaNi Opportunity
A gold filter toggle + gold badge on qualifying rows. Meaning: *"this item passes today's configured opportunity policy."* Policy is admin-configurable — e.g., *"flag when SMA crossing + RSI>70 + MagicRS just flipped positive + ATR still has room."* The rule is invisible to the user; the flag is what they see.

- Policy adapts to risk — when breadth ROC turns down, the bar gets higher, fewer flags appear. The user doesn't see the tightening; they just see fewer flags.
- Appears identically across Scanner rows, Industry Transition industry cards and expanded stock rows, Dashboard items.

### 3.3 VaNi Watchlist + Ping mechanic
Product-level watchlist (not user-level). VaNi runs the Opportunity policy at EOD and commits qualifying stocks to **today's watchlist**. During market hours, VaNi pulls 15-minute data (ICICI Breeze) and watches those names specifically.

Three row states:
- **Pinged** — green left border, "Ready to cook" chip, subtle pulse. Something moved.
- **Warming** — indigo left border, "Warming" chip. Starting to shift, not yet actionable.
- **Quiet** — muted, hidden by default with "show N quiet names" affordance.

The ping is subtle: orb pulses harder, count badge appears on the Watchlist filter. **No modal. No toast. No interruption.** User notices if they're looking; they're not torn away if they're not.

### 3.4 Logic chips
Under any synthesized sentence in chat, a row of tiny mono-font chips names the rules and data sources. Example: `[Magic RS leaderboard] [km_industry_eod · Financial Conglomerates] [dc_inference · 2026-04-24]`. Clickable in chat, informational only on screens. These are the trust-building breadcrumbs.

### 3.5 The Action Island
Persistent rounded pill fixed at bottom-center. Format: `[pulsing dot] VaNi is [doing something] · [current scope in italic] | [primary CTA]`. Examples:
- *"VaNi is watching 8 setups · 1 just pinged"* | *Review the ping*
- *"VaNi is tracking 6 rotating industries · 4 opportunities inside"* | *See all opportunities*
- *"VaNi is reading the tape · Capital Protection day 3"* | *Start planning tomorrow*

This is the live heartbeat — the product owns the bottom of the screen with VaNi's current state.

### 3.6 The stats-as-evidence pattern
Lead with the insight (headline). Back it with a tight row of numbers (score, deltas, benchmark-comparison). Numbers are evidence, not the primary scan unit. Applied consistently across Industry Transition rows and Dashboard items.

### 3.7 Sparklines for trajectory
Tiny SVG sparklines show rotation direction at an industry level, price trajectory at a stock level, historical distribution (bar chart) for base-rate claims. Replace sentences like "it rose" with a visible line going up. Recovered from V1.0 where the 6-day percentile trajectory was computed but thrown away.

### 3.8 Context strip
Top-right of every list-heavy screen: small chips showing *Regime · Astro window · User scope.* Reminds the user what world they're in without eating screen real estate.

### 3.9 Headline kickers
Small mono-font labels above any headline that type-tag it: `✦ Opportunity · industry`, `✦ Opportunity · stock`, `◆ Heads-up · 6 days ahead`, `Holding leadership`, `Diverging — watch carefully`. Gold for opportunity, indigo for informational, amber for caution.

---

## 4. Theme — carried forward from V1.0, tuned for legibility

V1.0's theme was dark-only with `kaaladristi` as the default. The investor feedback included *"hard to view"* — primarily a legibility issue, not a palette problem. The mockups use the kaaladristi theme base with targeted legibility fixes:

**Colour tokens (CSS variables used in mockups):**
```
--bg: #0b1120          (base, lifted from V1.0's #030712 for less eye strain)
--card: #131c31
--card-soft: #182340
--border: rgba(255,255,255,0.07)
--border-strong: rgba(255,255,255,0.14)

--text-primary: #f1f5f9
--text-secondary: #cbd5e1   (upgraded from V1.0's #94a3b8 for body text)
--text-muted: #94a3b8
--text-faint: #64748b

--gold: #d4a84b         (signature accent; regime names, VaNi Opportunity, leadership markers)
--indigo: #818cf8       (VaNi's signature; reasoning, chat, logic chips)
--bull: #10b981         (bullish, positive, strength)
--caution: #f59e0b      (warming, holding, partial alignment)
--bear: #ef4444         (bearish, weakness, against-regime)
```

**Typography:**
- **Fraunces** (serif, 400/500 weights) — display + headlines. Gives the product a settled, authoritative voice. Italic used for emphasis within headlines.
- **Inter** — body UI, labels, buttons.
- **Geist Mono** — numeric values, tickers, logic chips, dates.

**Why serif headlines:** ContractNest uses Inter everywhere; that's an operational tool. Kāla-Drishti is for a calm end-of-day planning session. Fraunces signals *reading a quiet analyst's note,* not *running a trading cockpit.* This is deliberate tonal positioning.

**Resolved V1.0 theme conflicts:**
- `accent-violet` in V1.0 did double duty (VaNi gradient + "mixed" market impact). Split: `--mixed: #a855f7` for the semantic meaning; VaNi keeps indigo.
- `risk-red` in V1.0 was overloaded (bearish + stale data + destructive UI). In V2: risk-red reserved for bearish market state only; stale data and destructive UI use distinct hues.

**Animations:**
- Fade-up on mount (staggered 50–250ms delays across sections)
- VaNi orb `breathe` (4s ease-in-out infinite)
- Pulse dots on live states
- Ping-pulse (box-shadow ring) on pinged rows

---

## 5. Screen-by-screen handover

### 5.1 Dashboard — `dashboard-LOCKED.html`

**The mindset that drove this screen:**

V1.0 Dashboard showed all panels at roughly equal weight — regime, indices, outlook, rotation, leadership, breadth. The user had to scan and decide what mattered. Charan's critical line:

> *"Top 2–3 percentile things can be shown on dashboard — actionable rather than showing something because we need to show something?"*

This reframed Dashboard entirely. The question stopped being *"what data should we show?"* and became *"what did VaNi find today worth the user's attention?"* Some days that's a specific opportunity; some days it's a regime warning; some days it's a ping. Dashboard is **triage, not overview.**

**Structure:**

1. **Day header** — date, *"Today's Read"*, regime pill inline. No briefing strip (there's no last-visit timestamp stored in V1.0 — flagged in section 8 below as a backend dependency to add).
2. **What stands out · VaNi's read of today** — 3 actionable items. Each with kicker + headline + evidence trail + sparkline + score. Priority items carry gold orb + gold kicker.
3. **Ambient context** — four glance cards: breadth, momentum, rotation count, leadership count. Value + one-line read each. Background only.
4. **Secondary row** — six-day outlook (compact version, links to Planetary Intel) + Panchangam card.

The three actionable items in the mockup:
- **Textiles — industry-level opportunity** (*"Something is cooking. 3.4× delivery volume surge..."*)
- **GRANULES — stock-level ping** (*"GRANULES just pinged. RSI ticked 61 → 68 intraday..."*)
- **Thursday Saturn–Mars — forward-looking heads-up** (*"6 of 8 historical occurrences closed negative..."*)

These three types demonstrate the range: industry-level, stock-level, forward-time. The Dashboard's ranking logic should be able to elevate any type into the top slot on any given day.

**Charan's confirmation on direction:** *"market breadth and breadth momentum to it"* — user wants these added to the ambient context strip. The glance-card pattern already supports this; add two more cards for Market Breadth Score and Breadth ROC using the same shape.

**What's gone from V1.0:** IndexWatchlist tiles block, SectorRotationStrip, MagicRS leaderboards as primary panels, big breadth charts. These move to deeper surfaces or shrink into glance-cards. Dashboard must not be a port of V1.0 widgets; it must be a new composition.

**Ranking algorithm for "what stands out":**

Not specified in detail by Charan; proposed approach for Claude Code to implement:

```
For each candidate item today, compute an attention priority:
  - Industry opportunities (Headlines triggered by Industry Transition's rules)
  - Stock pings (VaNi Watchlist entries that triggered intraday)
  - Stock opportunities (Scanner rows passing today's Opportunity policy)
  - Forward-looking heads-up items (high-confidence dc_inference events within next 7 days)
  - Regime changes (if regime classification flipped today)
  - Leadership shifts (top-10 MagicRS composition changes day-over-day — requires backfill)

Rank by composite score incorporating:
  - Confidence (base rate × historical frequency)
  - Recency (today > this week > upcoming)
  - User relevance (if watchlist exists — currently none in V1.0)

Top 3 surface to Dashboard. Tie-breaker: opportunities outrank heads-up items.
```

### 5.2 Scanner — `scanner-LOCKED.html`

**The mindset that drove this screen:**

V1.0 Scanner was six preset tabs and a filtered list — user picked a thesis, got 25 rows sorted by Magic RS. Investor feedback: *"felt like a filtered list, not agentic."*

The V2 reframe: Scanner's presets already work; what was missing is **context**. The engine has access to regime, rotation, watchlist membership — but Scanner ran in its own bubble. Fix: make Scanner *know what the rest of the system knows*, arrange rows accordingly, and add VaNi's two judgment mechanics (Opportunity + Watchlist).

**Structure:**

1. **Headline + context strip** — *"Scanner · thesis search"* + regime chip + Mars-Ketu + watchlist count.
2. **Preset bar (6 tiles)** — same six presets as V1.0, but with **regime-aware relevance**: tiles glow gold when today's regime favors that thesis, dim when it doesn't. In the mockup, Quiet Accumulation and Distribution Warnings glow; Fresh Breakouts is dimmed (breakouts typically underperform in Capital Protection).
3. **Sub-filters row:**
   - Exchange tabs (Combined / NSE / BSE) — unchanged from V1.0
   - **VaNi Opportunity filter** (gold) — shows only rows passing today's opportunity policy
   - **VaNi Watchlist filter** (indigo, with live ping dot) — shows only VaNi's 15-min-tracked list
4. **Stack headers + stock rows** — when Watchlist filter is on (the demoed state), rows show live intraday states (pinged / warming / quiet). Pinged row has a green left border, "Ready to cook" chip, RSI tick metadata ("61 → 68"). Warming rows are subtler. Quiet rows hidden by default.
5. **Action Island** — *"VaNi is watching 8 setups · 1 just pinged"* + *Review the ping* CTA.

**Two filters, not one:**

VaNi Opportunity and VaNi Watchlist are **distinct filters**, not the same thing:
- **Opportunity** = identified at EOD, applies to any preset's matches. *"This setup is fresh and has room."*
- **Watchlist** = Opportunity stocks committed to 15-min intraday tracking. *"VaNi is actively watching these for movement."*

A stock can have an Opportunity badge without being on today's Watchlist (if the Watchlist was closed before it was identified). A stock can be on the Watchlist without currently showing Opportunity (if it was flagged at EOD and the policy tightened since).

**Fix the V1.0 inconsistencies while you're here:**
- Add `VaNiTrigger` (sparkle) to Scanner's StockCard — V1.0 had them on Industry Transition but not here.
- Add industry context inline to each card (industry name + rotation arrow). Charan: *"scanner we can add 'industry' in the card."* — this is the clean way to separate Scanner (stock-first) from Industry Transition (industry-first) without them clashing.

### 5.3 Industry Transition — `industry-transition-LOCKED.html`

**The mindset that drove this screen — two iterations:**

**First attempt:** I built it as an industry-first list with sparklines and VaNi Opportunity badges. Charan pushed back with an image (Sector Rotation Analysis) and a critical insight:

> *"we have all this data, but... we have an industry and its statistics — 5D score, 22D score etc etc — but what it tells also — which industry got into focus, which industry shows biggest opportunity... questions... most in the industry saw 3.4X delivery volume surge in last 5 days — what is cooking?"*

The reframe: industries aren't database rows, they're **stories**. Each industry has a character today. Scanner could be about matching a thesis; Industry Transition is about reading what the market is telling you at the sector level. Different industries tell different stories — fresh focus, quiet accumulation, mature leadership, early fatigue. The UX job is to surface that character.

**Second attempt (locked):** Each industry row leads with a **headline** that names its character. Stats trail below as evidence. Sparkline visualises the rotation. Score on the right.

**Structure:**

1. **Headline + context strip** — *"Industry Transition · What each industry is actually doing right now."*
2. **Control bar** — category tabs (All / Rotating In / Leading / Rotating Out) with both industry and stock counts, benchmark selector (Compare vs NIFTY 50 / 500 / sectoral), VaNi Opportunity filter.
3. **Data freshness chips** (NSE green, BSE amber when lagged) + summary line.
4. **Industry cards** — each with:
   - Industry name + category pill + opportunity count
   - **Headline** with kicker (gold for opportunity, indigo for informational)
   - Stats strip: Score 5D, vs 22D, 1D%, 5D%, 22D%, vs N50 · 5D, RSI 14, EMA 20/50 status
   - Sparkline (5-day rotation trajectory)
   - Percentile score block (large number + 5-day delta)

**The four demo headlines demonstrate the range:**

1. **Textiles & Apparels** — *"Something is cooking"* — 3.4× delivery volume surge, price still quiet. Volume-surge trigger fires when avg delivery volume across members > 2× normal in 5D. **Opportunity-level (gold).**
2. **Minerals & Mining** — *"Just came into focus"* — score jumped 47 → 72 in 5 days. Fresh-rotation trigger. **Opportunity-level (gold).**
3. **Power** — *"Holding leadership"* — strong on all horizons, EMAs aligned, RSI 72 not exhausted. Mature-leadership trigger. **Informational (indigo).**
4. **IT Services** — *"Diverging — watch carefully"* — 5D positive but today red while Nifty green. Early-fatigue trigger. **Caution (amber sparkline).**

**Headline trigger library (to be built in backend):**

Each industry evaluates all applicable triggers and picks the top-ranked one for its headline. Proposed triggers:

| Trigger | Condition | Kicker | Tier |
|---|---|---|---|
| Volume surge | avg delivery vol across members > 2× 20D-normal in 5D | "Something is cooking" | Opportunity |
| Fresh focus | 5D score > 22D score by > 20, percentileChange >= 15 | "Just came into focus" | Opportunity |
| Quiet accumulation | Σ members in Wyckoff ACCUMULATION > 40%, 5D price change < 3% | "Quiet accumulation building" | Opportunity |
| Mature leadership | industry_rank top-quartile, all EMAs aligned, RSI 60-75 | "Holding leadership" | Informational |
| Overheating | RSI > 78, 22D% > 20%, 5D flattening | "Overheating — trend mature" | Caution |
| Early fatigue | 5D positive vs benchmark, today's move contradicts | "Diverging — watch carefully" | Caution |
| Fresh weakness | percentileChange <= -15, members crossing below SMA 50 | "Weakness establishing" | Informational |
| Breaking down | industry_rank bottom-quartile + rank dropping | "Breaking down" | Caution |

Each trigger ranked by urgency × specificity. If multiple trigger, pick most urgent. If none trigger, industry gets a neutral row without a headline (just stats + sparkline).

**Benchmark selector:**

User can change "Compare vs NIFTY 50" to NIFTY 500, NIFTY MIDCAP, or a sectoral index. The vs-benchmark columns (both headline reference and stats strip) recompute. This was Charan's explicit ask: *"how are they performing vs Nifty500, Nifty 50 or any other sectorial index, user can select."*

**Note on cross-screen clash:** V1.0's Industry Transition and Scanner were both stock-lists-with-industry-context and clashed. V2 separates them decisively:
- **Scanner** = stock-first. Industry shown as context per row.
- **Industry Transition** = industry-first. Stocks are a drill-in (expanded panel below each industry card — shown expanded in the first card of the mockup).

### 5.4 VaNi drawer — `vani-drawer-v2.html`

**The mindset that drove this screen:**

Mid-session Charan asked a sharp question: *"when dashboard has given so much explanation, what will chat has to do?"* This forced a real answer.

Chat exists to do what the screens structurally cannot:

1. **Personal context reasoning** — Dashboard is impersonal. Chat reasons about *the user* (their positions, their watchlist, their thesis) + system state. Example: *"I'm long BAJFINANCE from 7,200. Does today's read change my plan?"*
2. **Cross-temporal reasoning** — Dashboard is a snapshot. Chat traverses history. *"Show me past Capital Protection regimes for weak-RS names."*
3. **Explanatory deepening** — Dashboard compresses; chat expands. *"Why does narrowing leadership matter so much under Capital Protection?"*
4. **Cross-screen synthesis** — *"Given the six-day outlook and the weakness list, which of my watchlist names look most at risk?"*
5. **Teaching mode** — for the skeptic. *"Walk me through what RSS zones mean."*

Charan locked: *"All of the above, balanced."*

**Two phases of one drawer, not two drawers:**

- **Just opened** — context-aware opening line + Hub (intent menu grouped into four sections)
- **In conversation** — user messages + VaNi responses with data cards, logic chips, follow-up suggestions

The demo toggle at top-left of the mockup is for review only — in production, there's one drawer that transitions from Hub to Conversation when the user picks an intent or types a question.

**Structure:**

1. **Header** — VaNi orb (breathing), name, scope line (*"Reading Dashboard · Capital Protection day 3"*), reset button, close button.
2. **Context bar** (gold-tinted) — *"Context: Dashboard · 17 Apr · watchlist 8 · 1 open position"*. Visible in both phases. This is the line that makes VaNi feel grounded rather than floating.
3. **Phase 1 — Opening + Hub:**
   - **Opening read** — 2-3 sentences, context-aware. In mockup: *"I'm watching 8 setups today. GRANULES just pinged. Your BAJFINANCE position is in today's weakness list. What would you like to look at?"*
   - **Hub intents**, 4 groups:
     - **About your situation** (gold left border, personal) — position-aware questions.
     - **Compare to the past** — historical reasoning questions.
     - **Go deeper on today** — explanation questions tied to today's state.
     - **Learn the system** — teaching-mode for skeptics.
   - Intents reference actual page content — "Why is GRANULES pinging," "Explain the Textiles 3.4× surge" — so the drawer feels linked to what's on screen.
4. **Phase 2 — Conversation:**
   - User messages (right-aligned, timestamped)
   - VaNi responses (indigo orb + body) with:
     - **Job badge** at top naming the job ("Your context + system context", "Reasoning across time")
     - Narrative text in varied-weight Inter
     - Inline **data cards** (black-surface, tight rows) showing the data supporting the claim
     - **Logic chips** naming rules and sources
     - **Follow-up suggestions** (dashed-border panel) — scripted prompts for the user's next likely question
5. **Input bar:**
   - Free-text textarea
   - Scope chips: `@ scope`, `◆ my positions`, `⧖ history`
   - Send button
   - Hint line: *"VaNi reads conditions and explains data — not recommendations."*

**Language rules for VaNi:**

- First person: *"I'm watching,"* *"I found,"* *"I noticed."* VaNi has agency.
- Observational verbs: *reads, watches, notices, tracks.* Never *suggests, recommends, advises.*
- *"Historically"* framing for base-rate claims: *"Historically in Capital Protection, leadership names hold up."*
- Explicit anti-recommendation line when the answer touches action: *"None of this is a recommendation to act."* Baked into responses that reason about user positions.
- Logic chips on every claim: source is traceable.

**Context-aware opening read construction (for backend):**

The opening line is composed from a template filled with live context:

```
[If watchlist has pings] "I'm watching N setups today. SYMBOL just pinged — you'll see it at the top of your dashboard."
[If user has open positions overlapping today's state] "Your POSITION is in today's [weakness list / leadership list / rotating industry]."
[Final prompt] "What would you like to look at?"
```

Always 2–3 sentences, never more. Template slots fill from live data. If no pings and no overlapping positions, opening line simplifies to just today's scope.

---

## 6. The patterns that should now propagate

Three patterns emerged as load-bearing across multiple screens. Treat these as reusable components:

### 6.1 Headline + evidence pattern
Every major list/card unit leads with a kicker + headline + evidence trail. Proven on Industry Transition rows, Dashboard items. Should also appear on Planetary Intelligence (when that screen is redesigned — e.g., day cells with headline tooltips).

### 6.2 VaNi Opportunity / Watchlist filter pattern
A gold filter + gold badge on rows. Proven on Scanner and Industry Transition. Should also appear anywhere a list surface could benefit from "VaNi's picks" — e.g., Inference DB could show *"Events VaNi is watching for the coming week."*

### 6.3 Live state tiering (pinged / warming / quiet)
Proven on Scanner Watchlist view. Generalisable to any time-sensitive list — e.g., a Planetary Intelligence "active windows" view could tier events as active / approaching / quiet.

---

## 7. Implementation priorities for Claude Code

Recommended build order (not strict, but the dependencies run this way):

### Tier A — backend extensions required
Without these, the frontend can't be fully agentic:

1. **Watchlist infrastructure**
   - `km_user_watchlists` table (user_id, symbol, added_at)
   - Or JSONB `watchlist` column on `km_profiles`
   - Hook: `useUserWatchlist()`
2. **Last-visit timestamp**
   - `last_dashboard_at TIMESTAMPTZ` on `km_profiles` (updated on Dashboard mount)
   - Or localStorage fallback if user-specific is overkill
3. **VaNi Opportunity policy engine**
   - Configurable rule storage (admin-authored)
   - EOD job: evaluate policy across equity universe, produce today's Opportunity set
   - Regime-aware policy tightening (when breadth ROC flips negative, tighten thresholds)
4. **VaNi Watchlist + 15-min tracking**
   - ICICI Breeze integration for 15-min intraday data
   - Today's Watchlist = EOD Opportunity set + previous day's Watchlist carry-over rules
   - Intraday state machine: quiet → warming → pinged, driven by RSI ticks, RVOL surges, volume divergence flags
5. **Headline trigger engine** (for Industry Transition)
   - Trigger library as code (the table in §5.3)
   - Per-industry evaluation at EOD
   - Produces: {industry, headline, kicker, tier, supporting_stats}

### Tier B — frontend wiring against existing data
Reachable with current V1.0 hooks (per Claude Code's inventory):

6. **Close V1.0 navigation islands:**
   - SevenDayStrip cells → Planetary Intelligence on that date (needs `?date=` param on calendar)
   - SectorRotationStrip industry rows → Industry Transition pre-filtered
   - IndustryTag on stock rows → filter to that industry
   - Calendar event pills → Inference DB row for that event
   - These are fixes to the "screens are islands" problem Claude Code flagged.
7. **Wire existing VaNi insight hooks:**
   - `usePanchangInsight`, `useBreadthInsight`, `useBreadthRocInsight` — already exist, not currently used on Dashboard. Render where appropriate.
8. **Add VaNiTrigger to Scanner StockCard** — consistency fix.
9. **Replace Dashboard with v3 composition.**
10. **Add Market Breadth and Breadth Momentum** as glance cards on Dashboard (Charan's explicit ask).

### Tier C — Scanner reshape
11. Regime-aware preset relevance (gold tiles for preset fits today's regime)
12. Two-stack arrangement (aligned vs fighting) when no filter active
13. VaNi Opportunity filter
14. VaNi Watchlist filter with live states

### Tier D — Industry Transition reshape
15. Industry-first layout
16. Headline trigger engine integrated
17. Benchmark selector
18. Sparkline (recover the computed-but-dropped data)
19. Stats strip + inline stock drill-down

### Tier E — VaNi drawer upgrade
20. Free-text input (V1.0 is scripted-intent only)
21. Context-aware opening read from Dashboard state
22. Job badges on responses
23. Inline data cards inside responses
24. Follow-up suggestion panel
25. Scope chips on input (@scope, my positions, history)

### Tier F — theme conflicts
26. Split `accent-violet` — `--mixed` gets its own hue
27. Disambiguate red — reserve risk-red for market state, distinct destructive red
28. Text colour upgrade — `--text-secondary` from `#94a3b8` → `#cbd5e1`

---

## 8. What's NOT addressed in this handover

Three screens are not yet designed:

- **Planetary Intelligence** (calendar surface)
- **Inference DB** (authoring surface — the odd one out; CRUD done well is the bar, not agentic)
- **Chart / stock detail** (referenced from every screen but not redesigned in this session)

These should be approached in a subsequent design session using the design language locked here — Headlines, Opportunity/Watchlist, Logic chips, Action Island, stats-as-evidence, sparklines.

Also not addressed:

- **Morning-return flow** — the "9:15 AM next day" session where yesterday's thesis meets overnight changes. Discussed in the user journey but not mocked.
- **"What would change your mind?" rail** — invalidation triggers on stock detail page. Discussed, not built.
- **Onboarding / first-run experience.**
- **Settings, profile, subscription management.**
- **Mobile** — mockups are desktop-only. Mobile adaptation needs a separate design pass.

---

## 9. Product stance — keep this in the UX

Embed these lines across the product where natural:

- *"Conditions · Context · Comprehension"* — product's three-word stance
- *"VaNi reads conditions and explains data — not recommendations."* — in drawer input hint
- *"A deterministic read of market conditions — to help you understand the day, not to tell you what to do with it."* — candidate sub-headline for Dashboard or About page
- *"Nothing here is a recommendation — this is what the data is saying."* — close of VaNi's synthesized reads where the topic touches action

Never drift toward buy/sell language. Rule #10 from the V1.0 LESSONS_LEARNED.md stands: *internal IDs can be directive (`power_buy`), UI must be observational (`Strength Confluence`).*

---

## 10. A note on the working methodology

This session ran as a design-discussion first, build-second process. Charan explicitly called this out mid-session — and corrected me twice when I drifted into premature building. The rhythm that worked:

1. Understand the current screen factually (via Claude Code briefs — preserved in the session history)
2. Discuss intent and desired behaviour
3. Build a visual
4. React, iterate, lock
5. Move to next screen

Each locked screen was genuinely debated before being accepted. The mockups are not suggestions; they are **confirmed designs.** Treat them as spec, not inspiration.

Questions or ambiguity: return to the source screen file, check what's actually there visually, and build against that rather than interpreting this document abstractly. The HTML is the ground truth; this document is context.

---

*End of handover.*
