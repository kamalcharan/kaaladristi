# Kāla-Drishti — AI Layer Configuration

This document defines the AI/LLM integration for the Kāla-Drishti platform.
All AI features are **opt-in**, driven entirely by environment variables.

---

## Feature Flag

```
AI_ENABLED=false          # master switch — set true to enable
AI_MODEL=claude-haiku-4-5 # any Anthropic model ID
ANTHROPIC_API_KEY=sk-ant-…
```

When `AI_ENABLED=false` (default), every AI endpoint returns
`{"insight": null, "ai": false}` — the UI silently shows nothing.
No API key is required to run the product.

---

## Architecture

```
Browser  →  pipeline_api.py (FastAPI, port 8100)
                └── lib/ai_client.py     (Anthropic SDK singleton)
                └── lib/ai_prompts.py    (skill registry — all system prompts)
```

The frontend **never** calls Anthropic directly. API keys stay server-side.
React Query adds a 24h client-side cache; the backend adds a per-process
in-memory cache (keyed by date) so the same insight is never generated twice.

---

## Skills

All system prompts live in `App/backend/lib/ai_prompts.py`.
Each skill is registered in the `SKILLS` dict with a key, system prompt, and
`max_tokens` cap.

| Skill Key               | Endpoint                        | Status      | Output |
|-------------------------|---------------------------------|-------------|--------|
| `panchang_insight`      | `GET /api/ai/panchang-insight`  | Live        | 2 sentences |
| `day_risk_narration`    | `GET /api/ai/day-risk` (Phase 2)| Placeholder | 2 sentences |
| `historical_proof`      | `GET /api/ai/proof` (Phase 2)   | Placeholder | 2 sentences |

---

## Tone & Safety Rules (applied to all skills)

These rules are baked into every system prompt via `_RULES` in `ai_prompts.py`:

- **Educational only** — no investment advice, no predictions
- **Forbidden words**: buy, sell, target price, guaranteed, certain
- **Preferred vocabulary**: "elevated caution", "favorable window",
  "structural stress", "risk is heightened", "increased volatility",
  "consolidation likely", "historically correlated with"
- **Format**: exactly 2 sentences per response to keep UI compact

---

## Skill: Panchangam Insight (`panchang_insight`)

**Trigger**: `PanchangamCard` component loads for a given date.
**Input** (user message built in `pipeline_api.py`):
```
Panchangam for YYYY-MM-DD:
Tithi: N. Name (Lord: X)
Nakshatra: Name Pada N (Lord: X)
Yoga: Name
Vara: Name (Lord: X)
Moon Sign: Name
Special Events: Purnima / Amavasya / Ekadashi / Sankranti / None
What is today's market risk context?
```
**Output**: 2-sentence market risk context rendered below the Panchangam table
with a ✦ "AI Insight" label.

---

## Adding a New Skill

1. Open `App/backend/lib/ai_prompts.py`
2. Define `_MY_SYSTEM = _IDENTITY + "..." + _RULES`
3. Add to `SKILLS`: `"my_skill": Skill(system=_MY_SYSTEM, max_tokens=200)`
4. Add endpoint in `pipeline_api.py` following the `panchang_insight` pattern:
   - Read env flags via `get_client()`
   - Check in-memory cache
   - Build user message from DB data
   - Call `client.messages.create(model=AI_MODEL, max_tokens=skill.max_tokens, system=skill.system, ...)`
   - Cache and return `{"date": ..., "insight": ..., "ai": True}`
5. Add a React Query hook in `frontend/src/hooks/useDashboardExtras.ts`

---

## Model Recommendations

| Use case              | Recommended model     | Rationale                      |
|-----------------------|-----------------------|--------------------------------|
| Short insights (≤200 tok) | `claude-haiku-4-5` | Fast, cheap ($1/$5 per 1M)     |
| Structured analysis   | `claude-sonnet-4-6`   | Better reasoning, moderate cost |
| Deep factor reports   | `claude-opus-4-6`     | Best quality, higher cost      |

Default is `claude-haiku-4-5` — change via `AI_MODEL` in `.env`.
