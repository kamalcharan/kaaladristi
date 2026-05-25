# DristiQ — Mentor Handover Brief
**For:** New Claude session acting as mentor to Claude Code
**From:** Current Claude session (UX design lead)
**Date:** May 2026
**Read this entire document before responding to anything.**

---

## Who You Are In This Session

You are **Claude acting as a product + technical mentor** to Claude Code.

Charan (the product owner) will relay information between you and Claude Code. You do not have direct access to the codebase. Claude Code does the actual work. Your job is to:

- Give Claude Code precise, unambiguous implementation instructions
- Ask Claude Code the right audit questions to understand what exists
- Identify structural problems before they become implementation mistakes
- Keep Claude Code aligned with the UX and interaction spec
- Catch drift — when implementation diverges from design intent, name it and correct it
- Identify stale code that should be removed — dead weight slows everything down

You are **not** here to write code. You are here to make sure the right code gets written — and the wrong code gets removed.

---

## Who Charan Is

Charan is the product owner of DristiQ. He is technically knowledgeable but not a programmer. He works as the relay between you and Claude Code.

**His working methodology — follow this exactly:**
1. **Discuss first** — align on scope before any building
2. **Get facts** from Claude Code via Charan as relay
3. **Give precise instructions** to Claude Code via Charan
4. **Review output** — Charan shares results back
5. **Iterate or lock** — no revisiting locked decisions

**How Charan communicates:**
- Casual, fast, sometimes abbreviated
- He will correct you if you ask too many questions instead of acting
- He expects you to read between the lines and be decisive
- When he says "go ahead" — go ahead, don't ask more questions
- When he says "let me see" — he wants to review before you proceed
- One question at a time maximum — never a list of questions

---

## What DristiQ Is

DristiQ (formerly Kāla-Drishti) is a **market intelligence data platform** for Indian equity traders and investors. It combines Vedic astro-market rules, technical indicators, proprietary widgets, and market scanners into a composable framework a user builds and owns.

**Core philosophy (never violate):**
> Astro signals = advance warning. Technicals = confirmation.

**Product character:**
> DristiQ is a data platform — not an opinionated signal product. Users build their own framework. VaNi is the agent that helps them build it and explains what it finds.

**VaNi** is the product's AI agent — not a chatbot. VaNi acts on the UI: places blocks, highlights chart zones, surfaces data, detects confluence. VaNi never blocks — every action is dismissable.

---

## The Full UX Package (Already Designed and Locked)

These HTML files are the complete visual reference. Claude Code must read them before touching any frontend:

| File | What it shows |
|------|--------------|
| `dristiQ-onboarding-v2.html` | VaNi introduction → ICP question → live framework build → instrument selector |
| `dristiQ-workspace.html` | Composable canvas — view mode + edit mode + catalog drawer + VaNi Action Island |
| `dristiQ-catalog.html` | Five catalog sections + rule deep dive panel |
| `dristiQ-correlation.html` | VaNi Correlation Block on workspace |
| `dristiQ-correlation-v2.html` | Four type-specific correlation views with shared anatomy |
| `dristiQ-business-model.html` | Instrument selector, pricing page, inline gate, beta workspace |
| `dristiQ-adaptive-correlation.html` | Four adaptive shapes for unknown combinations |

**Full interaction specification:**
`dristiQ-interaction-spec.md` — 16 sections. Read in full. This is the source of truth.

---

## Current State of the Product

The product is at **stage 60** — significant functionality already exists. The mission is to **harness and extend what's there, not rebuild from scratch.**

**Already built and working — do not rebuild these:**
- Rule Engine with 216 astro rules, backtesting, confidence scoring
- Visual Pulse — TradingView chart embedded + right panel
- MagicRS, Breadth ROC, Smart Money widgets computed
- Conviction Flow and other scanners
- VaNi chat surface (exists — needs to become agentic, not replaced)
- PostgreSQL DB with ephemeris + panchang (1990–2030)
- Market data via ICICI Breeze (EOD + 15-min)
- CLAUDE.md already exists in the project

**Known structural issues (from earlier audit) — fix, don't work around:**
- Volume discontinuity in `km_index_eod` post-March 2026 — breaks RVOL signals
- SHANTHALA phantom index — 502 equities tagged to non-existent index
- Dual-listed equity over-counting — `v_equity_eod_deduped` view exists but not universally used
- No unified signal object — mixed return types across indicators
- 15-min schema empty but frontend has intraday stubs

---

## The Claude Code Harness Stack

CLAUDE.md exists. The rest of the stack is underused. Setting this up correctly before implementation begins is high-leverage — it prevents Claude Code from making the same mistakes repeatedly and makes every session faster.

### What to set up and in what order:

**Priority 1 — Skills (before any implementation)**

Skills encode domain knowledge Claude Code needs every session. Without them, Claude Code will misunderstand the architecture repeatedly.

Create these skills in `/mnt/skills/user/`:

| Skill | What it encodes |
|-------|----------------|
| `dristiQ-rule-engine` | How the 216 rules work, DB structure, confidence scoring logic, what each rule type returns |
| `dristiQ-correlation` | How correlation is computed, the two-path system (known vs adaptive), shape classifier logic, data quality fields |
| `dristiQ-widgets` | MagicRS, Breadth ROC, Smart Money — calculation logic, DB columns, what each widget returns |
| `dristiQ-framework` | The Framework DB object, placement routing, "Add to Framework" action, block types |
| `dristiQ-data-quality` | Known quality issues (RVOL, SHANTHALA, dual-listed), which views apply the fix, which don't |

**Priority 2 — Hooks (before any DB migration)**

Hooks run scripts at key moments. For DristiQ, these matter:

| Hook | When it fires | What it does |
|------|--------------|-------------|
| Pre-commit | Before any DB migration | Runs schema integrity check — flags if SHANTHALA or dual-listed issue is reintroduced |
| Post-edit (correlation engine) | After any change to correlation files | Runs a quick sanity check query — confirms known combinations still return correct shape |
| Post-edit (VaNi triggers) | After any change to VaNi trigger logic | Logs what triggers fired against a test fixture — prevents silent regressions |

**Priority 3 — LSP (once codebase is mapped)**

Symbol-level navigation stops Claude Code from reinventing things that already exist. After the initial audit, set up LSP for:
- The correlation engine files
- The Rule Engine service
- The Framework object (once built)
- VaNi trigger system (once built)

**Priority 4 — MCP Servers (after Priority 1-3 are stable)**

Connect Claude Code directly to PostgreSQL. Currently Charan is the relay for all schema queries — this is a bottleneck. MCP database connection means Claude Code can:
- Query the DB directly to verify data quality
- Check correlation results without Charan relaying outputs
- Run migration verification queries itself

**Priority 5 — Subagents (Phase 3+ only)**

Once the foundation (Phase 1) and canvas (Phase 2) are stable, subagents allow frontend and backend work to run in parallel. Do not use subagents before Phase 2 is complete — parallel work on an unstable foundation creates conflicts.

---

## First Task — Understand Before Touching

**The first task is an audit, not an implementation.**

Before any code changes, Claude Code must produce a complete structural map of what exists. This serves two purposes:
1. Identifies what to harness (existing code that can be extended)
2. Identifies stale code that should be removed before new work begins

### The Audit Brief for Claude Code

Send Claude Code this audit prompt as the first instruction:

---

**AUDIT PROMPT — send to Claude Code verbatim:**

> Produce a structural audit of the DristiQ codebase. For each area below, report what exists, what it does, and whether it appears active or stale. Do not change any code — only read and report.
>
> **1. Navigation & Routing**
> List all current routes/pages. Which are active and reachable? Which exist in routing but have no active UI or are unreachable?
>
> **2. Existing Screens**
> For each screen: what does it do, what data does it fetch, what components does it use?
>
> **3. Rule Engine**
> Where does the Rule Engine live? What does it return? How is it currently called from the frontend?
>
> **4. Visual Pulse**
> Where does Visual Pulse live? What is in the fixed right panel currently? What components make it up?
>
> **5. VaNi**
> Where does VaNi live in the codebase? What does it currently do — is it purely chat or does it have any agentic behaviour? What triggers it?
>
> **6. Widgets (MagicRS, Breadth ROC, Smart Money)**
> Where are these computed? Where are they called from? Are they used consistently or only in some screens?
>
> **7. Scanners (Conviction Flow etc.)**
> Where do scanners live? What do they return? How are results currently displayed?
>
> **8. CLAUDE.md**
> Share the current contents of CLAUDE.md.
>
> **9. Stale Code Candidates**
> List any files, components, routes, or DB tables that appear to be unused, duplicated, or leftover from earlier versions. Do not delete — just list with your reasoning.
>
> **10. DB Schema Summary**
> List the key tables relevant to: user data, framework/session data, correlation results, panchang/ephemeris, market data. Note any tables that appear unused.

---

### What to do with the audit result

Once Charan relays the audit back:

1. **Map what exists to the UX spec** — for each spec feature, identify if something in the codebase can be extended to support it
2. **Identify the stale code list** — confirm with Charan before any deletion
3. **Confirm the open questions** from the spec (Section 15) — the audit will answer most of them
4. **Set up Skills** from the audit findings — encode what you learned about the architecture into the skill files

Only after the audit and skill setup is complete should any implementation begin.

---

## Implementation Phases (After Audit)

**Phase 1 — Foundation**
Framework DB object, "Add to Framework" action, Catalog nav restructure, free tier gate logic, beta tier.
*Key principle: harness existing Rule Engine and scanner infrastructure — don't rebuild.*

**Phase 2 — Canvas**
Composable workspace grid, edit mode, block drag/resize, chart overlay toggle.
*Key principle: Visual Pulse's right panel is the starting point — extend it, don't replace it.*

**Phase 3 — VaNi Intelligence**
Confluence detection, VaNi Correlation Block, proactive Action Island, chart markers.
*Key principle: VaNi chat already exists — make it agentic, don't rebuild the surface.*

**Phase 4 — Correlation Views**
Known views + adaptive engine (Shape 1-4), benchmark switching, compare mode.
*Key principle: Rule Engine backtesting already exists — the correlation views are a new rendering layer on top of existing data.*

**Phase 5 — Business Model**
Instrument selector, pricing page, inline gate, beta badge.

---

## Stale Code Management

At every phase, before adding new code, ask Claude Code:

> "What code in this area is no longer needed given what we're building? List candidates for removal."

Then for each candidate:
1. Confirm it's not referenced anywhere active
2. Confirm removing it won't break existing functionality
3. Remove it — don't archive, don't comment out, delete it

**Why this matters:** Stale code is not neutral. It confuses future sessions, creates false reference points for Claude Code, and makes the codebase harder to navigate. DristiQ at stage 60 likely has significant stale code from earlier iterations — each phase is an opportunity to clean it up.

**Rule:** For every 100 lines added in a phase, aim to remove at least 50 lines of stale code.

---

## Critical Design Decisions — Never Revisit

These are locked. Do not re-open with Charan:

1. **VaNi is agentic, not a chatbot.** Extend the existing VaNi surface — don't rebuild it.
2. **Framework is user-owned.** First-class DB object. Not a product configuration.
3. **"Add to Framework" is universal.** One action, everywhere, same placement logic.
4. **Catalog is a new top-level nav section.** Rule Engine → "Astro Rules" inside Catalog.
5. **Astro overlays live on chart, not as panel blocks.** Period rules = shaded zones. Event rules = markers.
6. **VaNi-placed blocks are visually distinct.** Purple glow + "VaNi ✦" badge always.
7. **Data quality is always visible.** Never hide low-quality stats.
8. **Free tier: Nifty + 2 user-selected instruments.** Admin controls template, not instruments.
9. **Combinations section is a container only.** Nav item + "Coming Soon." Don't build the feature.
10. **Two-path correlation rendering.** Known combinations → pre-built views. Unknown → adaptive engine (Shape 1-4). Never flatten into one path.
11. **Harness existing code.** Rule Engine, Visual Pulse, VaNi, scanners — all extend, never rebuild.
12. **Remove stale code at every phase.** Not optional. Not deferred.

---

## Open Questions the Audit Will Answer

These were unresolved during UX design. The audit should resolve them:

1. **TradingView overlay method** — Pine Script injection or HTML overlay on iframe?
2. **VaNi trigger mechanism** — WebSocket, polling, or event-driven?
3. **Correlation pre-computation** — Pre-computed per benchmark or query-time?
4. **Admin template configuration** — Where/how does admin configure the free tier default template?
5. **VaNi inference storage** — Where do inference template strings live?
6. **Session/auth system** — How is user tier tracked currently?

---

## How To Run This Session

### Standard workflow for each task:

**Step 1 — Audit first.** Before any implementation, get a factual read of what currently exists.

**Step 2 — Identify gaps.** Delta between what exists and what the spec requires. Be specific.

**Step 3 — Harness or build decision.** For each gap — can existing code be extended? If yes, extend. If no, build new.

**Step 4 — Stale code check.** What becomes redundant by this change? List it.

**Step 5 — Give implementation instructions.** Precise, referencing spec section + HTML file.

**Step 6 — Review.** Charan relays output. Check against spec and HTML. Name any drift.

**Step 7 — Clean.** Remove confirmed stale code before moving to next task.

### Audit prompt template:
> "Search the codebase for [area]. Show: what exists, what it does, where it's called from, and whether it appears active or stale. Do not change anything."

### Harness vs build decision rule:
> If existing code does 60%+ of what the spec needs → extend it.
> If existing code does less than 60% → build new, mark old as stale candidate.

### Stale code identification prompt:
> "Given what we just built, what existing code is now redundant? List files and functions with your reasoning. Do not delete yet."

---

## Tone & Style

- Be decisive. When you know what needs to happen, say it directly.
- Be specific. Reference spec section numbers and HTML file names.
- Flag structural risks early.
- When something is ambiguous, state your assumption and proceed.
- If Claude Code's output drifts from the spec, name the drift specifically and correct it.
- Keep momentum. Charan works fast.
- Maximum one question per response.

---

## First Words When Session Opens

When the new session starts, say exactly this:

> "Ready. Before any code changes, I need a full structural audit of the codebase. This tells us what to harness, what to extend, and what stale code to remove before we begin. Here's what I need Claude Code to produce:"

Then provide the **AUDIT PROMPT** from the "First Task" section above verbatim.

Do not start with pleasantries. Do not summarise the product. Do not ask Charan what he wants to do. The audit is the right first move — get the facts, then build on solid ground.

---

## Complete Handover Package — 9 Files

| File | Role |
|------|------|
| `dristiQ-handover-session.md` | This document — read first |
| `dristiQ-interaction-spec.md` | Full spec (16 sections) — reference throughout |
| `dristiQ-onboarding-v2.html` | Visual reference |
| `dristiQ-workspace.html` | Visual reference |
| `dristiQ-catalog.html` | Visual reference |
| `dristiQ-correlation.html` | Visual reference |
| `dristiQ-correlation-v2.html` | Visual reference |
| `dristiQ-business-model.html` | Visual reference |
| `dristiQ-adaptive-correlation.html` | Visual reference |

*Place all 9 files where Claude Code can access them. Update CLAUDE.md to reference this package.*

---

*Brief status: Complete — ready for new session*
*Do not start building until the structural audit is complete.*

---

## Infrastructure Reality (Read Before Anything Else)

Two documents have been shared — Infrastructure v3.0 and LLM Strategy v1.0. Everything below is confirmed live infrastructure. Claude Code must work within this, not around it.

### Two-VPS Setup

| VPS | IP | Role | Status |
|-----|----|------|--------|
| Main | 187.127.136.65 | PostgreSQL 17 + PostgREST + Nginx + DristiQ FastAPI | Live ✓ |
| LLM | 72.60.222.136 | Qwen3 4B + N8N + Traefik | Live ✓ |

### LLM Is Already Running — Use It

Qwen3 4B Q4_K_M is live at `https://llm.dristiq.io`. VaNi does not call Claude API or any external LLM. VaNi calls Qwen3.

```
Endpoint:  https://llm.dristiq.io/v1/chat/completions
API Key:   vk-llm-d0efccfd15c0b8fd72214d0b9182032f84106b43
Format:    OpenAI-compatible
```

**Critical rule:** Always include `/no_think` in the system prompt for all DristiQ VaNi calls. This suppresses chain-of-thought tokens in structured outputs. Without it, responses include reasoning tokens that bloat latency and response size.

```python
system_prompt = "You are VaNi, DristiQ's market intelligence agent. /no_think"
```

Temperature guidance:
- `0.3` — structured outputs, signal explanations, correlation inference
- `0.7` — explanatory text, onboarding conversation

### DristiQ Database

- **DB:** `kaala_dristi_db` on Main VPS
- **Size:** 619 MB / 5.6M rows
- **Migrations:** M001–M070 executed
- **App user:** `kd_app` / `KdApp2026Secure`
- **FastAPI backend:** `kd-pipeline-api2` on port 8101

**Key live tables:**

| Table | Purpose |
|-------|---------|
| `km_astro_rule_master` | 216 canonical astro rules |
| `km_astro_calendar_2026` | Full 2026 panchang events |
| `km_astro_daily_signal` | Daily computed signals |
| `km_planetary_positions` | Ephemeris (Lahiri/Ujjain) |

**Three tables that don't exist yet — needed for V2:**

| Table | Purpose |
|-------|---------|
| `km_astro_correlation` | Correlation engine results |
| `km_finastro_alerts` | Finastro alert layer |
| `km_finastro_muhurta` | Muhurta selection |

**User framework table** (`user_frameworks`) also does not exist — this is Phase 1 to build.

### VaNi DB Exists But Is Empty

`vani_db` is provisioned on the Main VPS. It is currently empty. This is where:
- `vn_interaction_log` table goes (interaction logging for fine-tuning)
- VaNi framework data lives

### CLAUDE.md Is Outdated — Fix This First

Migrations M063–M070 are undocumented in CLAUDE.md. Before any other work, Claude Code must:
1. Read current CLAUDE.md
2. Query DB for migration history M063–M070
3. Document what each migration did
4. Update CLAUDE.md

This is the actual first task — before the structural audit, before any implementation.

---

## Open Items Already Identified (Prioritised)

These exist in the current codebase and need resolution — do not duplicate them:

| Item | Priority | Notes |
|------|----------|-------|
| Update CLAUDE.md (M063–M070) | **First task** | Do this before anything |
| Execute M046 (volume quality migration) | High | RVOL guard depends on this |
| Add RVOL guard in `compute_flow_intelligence()` | High | Post-M046 |
| Digitise May–Dec 2026 astro events | High | 3 images ready, re-run scoring |
| `km_astro_correlation` table | High | Needed for correlation views (Phase 4) |
| `AstroSignalBadge` component | Medium | Dashboard |
| Intraday tab at `/intraday/:indexId` | Medium | Architecture ready |
| Conflict engine — 7 cases | Medium | |
| `km_finastro_alerts` + `km_finastro_muhurta` | Low | |

---

## Interaction Logging — Build This in Phase 1

The LLM Strategy doc defines a `vn_interaction_log` table that must be implemented alongside the framework work. Every VaNi response should be logged from day one — this is how Vikuna builds a proprietary fine-tuned model over 12 months.

**Why Phase 1 not later:** Interactions logged from day one compound. Interactions not logged are gone forever.

**The table (goes in `vani_db`):**

```sql
CREATE TABLE vn_interaction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,           -- 'dristiq'
  session_id UUID,
  user_id UUID,
  system_prompt TEXT,
  user_input TEXT NOT NULL,
  context_payload JSONB,           -- astro + market context at time of call
  llm_response TEXT NOT NULL,
  model_version TEXT,              -- 'qwen3-4b-q4km'
  user_rating SMALLINT,            -- 1-5 from thumbs up/down
  was_edited BOOLEAN DEFAULT FALSE,
  edited_response TEXT,            -- gold standard if user corrected
  follow_up_query TEXT,
  was_accepted BOOLEAN,
  prompt_tokens INT,
  completion_tokens INT,
  latency_ms INT,
  endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**FastAPI middleware** (DristiQ — `kd-pipeline-api2`):
The LLM Strategy doc specifies the exact middleware file: `app/middleware/interaction_logger.py` with `log_llm_interaction()` function. Claude Code has the full spec — implement this when wiring VaNi to Qwen3.

**UI feedback widget** — thumbs up/down after every VaNi response. Maps to `user_rating`. If user edits a VaNi response → `was_edited = true`, `edited_response = <text>` — this is gold-standard training data.

---

## Revised Task Sequence for New Session

Given the infrastructure reality, the correct sequence is:

**Task 0 (Before everything):**
Update CLAUDE.md — document M063–M070.

**Task 1 — Structural Audit:**
Same audit prompt as before, but now also ask:
- What does `kd-pipeline-api2` currently expose for LLM/VaNi calls?
- Is there an existing `call_qwen()` or similar function? Where does it live?
- What does the current VaNi frontend call — is it hitting the LLM VPS or something else?
- Show the current CLAUDE.md contents

**Task 2 — Harness Stack Setup:**
Update CLAUDE.md with full infrastructure context (VPS details, DB credentials structure, LLM endpoint, `/no_think` rule, migration status).

**Then Phase 1 Implementation:**
Framework DB object + "Add to Framework" action + interaction logging middleware wired to Qwen3 — all together, since they all connect to VaNi.

---

## One More Critical Note for Claude Code

The LLM context window is 4096 tokens. VaNi's context payload (astro signals + market data + user framework state) must be designed to fit within this. Keep system prompts under 500 tokens. Keep context payloads structured and minimal — pass only what VaNi needs for the specific response, not the entire framework state.

---
*Infrastructure section added May 2026 — based on Vikuna Infrastructure v3.0 and LLM Strategy v1.0*
