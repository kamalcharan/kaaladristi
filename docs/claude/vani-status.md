# VaNi Implementation Status — Full Reference

> Moved verbatim from CLAUDE.md.

## VaNi Morning Brief — Implementation Status (June 2026)
`POST /api/vani/daily` — sequential per-item processing, panchang always card 1.

### Architecture
- **Card order**: panchang → confluences (priority) → astro rules (fill remaining). Max 3 cards.
- **LLM calls**: one call per item (max_tokens=150), sequential. Panchang, astro rules, and confluences each get a tailored user message.
- **Cache**: `_vani_cache` — in-memory Python dict, keyed by `item_key` (e.g. `panchang:2026-06-01`, `rule:astro_rule:CON-SUN-MER-TRN:2026-06-01`). 24h TTL. Cleared on restart. **Decision: in-memory is sufficient** — morning brief is ephemeral; no Redis, no DB cache needed. Closed.
- **Action routing**: each observation carries `action` + `action_target`; frontend navigates on click (`/rules/:id`, `/correlation/:a/:b`, `/panchang`).
- **Prompt iteration**: system prompt rule 8 forbids: potential, may, could, might, volatility, shift, strategy, communication. Panchang sentence 1 uses exact format template; sentence 2 is verbatim signal count.
- **Prompts centralised**: `_VANI_MORNING_BRIEF_SYSTEM` and `_VANI_CORRELATION_INSIGHT_SYSTEM` both live in `lib/ai_prompts.py` as named `Skill` entries in `SKILLS` registry. `pipeline2_api.py` references via `_AI_SKILLS['vani_morning_brief']` and `_AI_SKILLS['vani_correlation_insight']`.

### Still deferred
- Morning brief — screener top 3% feed (depends on screener session)
- Prompt quality iteration may continue — share raw log output after each backend restart to verify Qwen3 output

---

## VaNi Correlation Insight — Implementation Status (June 2026)
`POST /api/vani/correlation-insight` — JWT-auth, sync, permanent in-memory cache.

### Architecture
- **Endpoint**: `POST /api/vani/correlation-insight` in `pipeline2_api.py`
- **Cache**: `_corr_insight_cache: dict` — module-level, keyed by `corr_insight:{sorted_a}:{sorted_b}:{shape}`. Permanent until server restart (pair insight rarely changes). No TTL.
- **Request model**: `CorrelationInsightRequest` — `item_a`, `item_b`, display names, descriptions, shape, n_instances, hit_rate, avg returns, currently_active.
- **Prompt**: `vani_correlation_insight` skill in `lib/ai_prompts.py`. Returns `{"insight": "..."}`. 2–3 sentences, forbidden-word guard, returns `null` on violation (no fallback text).
- **Logging**: writes to `vn_interaction_log` via `_log_interaction`.
- **Frontend**: `CorrelationPage.tsx` left panel — `useQuery` with `staleTime: Infinity`, fires once `result` loads. Renders loading shimmer → insight card with accent left-border, ✦ VaNi label, cached/fresh badge, italic Fraunces text. Position: between Outcome Split and Walk mode CTA.
- **Helpers**: `resolveDisplayName(id)` and `resolveDescription(id)` pull from `CATALOG_MAP` for indicator/widget items, fall back to `fmtId` for astro rules.

### Pending — debug not yet confirmed
- **Fix 4 debug logs** are still in `CorrelationPage.tsx` (4 `console.log` lines before `return`). Remove after confirming insight fires.
- Confirm `POST /api/vani/correlation-insight` appears in backend logs after navigating to `/correlation/ema_20/sma_50`. The query has `enabled: !!result` — if `result` is undefined at mount, it never fires.

---

## CorrelationPage — Left Panel Structure (June 2026)
Top to bottom (after `result` loads):
1. **Pattern Confidence** — `<ConfidenceDial n_instances hit_rate />` (label rendered inside component)
   - Thresholds: Strong (n≥30, hit≥65%) · Good (n≥15, hit≥60%) · Moderate (n≥8 or hit≥55%) · Low (n<8)
   - `hit_rate` = `max(bullish, bearish) / resolved` — computed in page
2. **Stats 2×2 grid** — Total Instances · Resolved · 5D Avg Return · 22D Avg Return
3. **DataQualityPill** — EOD DATA · {days_covered} days · {year_from}–{year_to} · {coverage_pct}% — conditional on `result.coverage_pct != null`
4. **Outcome Split** — bull/bear proportional fill bar
5. **VaNi Insight** — loading shimmer → insight card (LLM-generated, fetched from `/api/vani/correlation-insight`)
6. **Walk mode CTA** — tier-gated
7. **Dismiss correlation** button

### Component files
| File | Purpose |
|---|---|
| `components/correlation/ConfidenceDial.tsx` | SVG clock arc, props: `n_instances` + `hit_rate` |
| `components/correlation/DataQualityPill.tsx` | One-line EOD data coverage pill |

---


### VaNi Confluence Shapes — CorrelationDrawer.tsx

| Shape | Visualization | Test status |
|---|---|---|
| `ZONE_CONFLUENCE` | Active callout + Gantt duration bars + 5D return histogram | **Tested** — triggered by default ICP templates |
| `EVENT_OVERLAP` | Dual SVG track timeline (teal/orange/purple) + stats row + instance list | **UNTESTED** — requires two simultaneous astro rule overlays as chart_overlays |
| `EVENT_IN_STATE` | Current state callout + conditional return table + event breakdown grid | **UNTESTED** — requires astro rule + magic_rs/order_flow/smart_money/breadth_roc overlay pair |
| `THRESHOLD_CROSS` | Falls through to plain InstanceList | **UNTESTED** — requires astro rule + rsi_14/rsi_9 overlay pair |

Backend `states[]`: `EVENT_IN_STATE` now returns `state` per instance (from `magic_rs_zone`, `flow_type`, `sniper_inst` level, or `breadth_roc` direction). Frontend shows fallback label "(backend state pending)" if `state` field missing.
