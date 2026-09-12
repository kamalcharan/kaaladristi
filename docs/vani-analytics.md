# VaNi usage analytics

Uses the existing PostHog initialization, `product=dristiq`, and account identity. No database migration or additional analytics key is required. Events are no-ops when PostHog is not configured. Existing VaNi interaction logs, feedback storage, Qwen/Haiku routing and caching are unchanged.

## Event dictionary

All events carry `analytics_version=1`, `page`, and `mode`. Intent-related events include `intent_id`; research companions include `period` (sessions) or `months` when applicable.

| Event | Meaning |
| --- | --- |
| `vani_panel_viewed` | The panel intersects the viewport, once per mounted companion. This may be its header on mobile, not an opened explanation. |
| `vani_intent_selected` | `source=automatic` for the default brief, `manual` for an explicit question click, `external` for a question launched from another control into chat. |
| `vani_reading_ready` | A response becomes available. Includes browser/server cache answers and deterministic empty-scanner answers. Does not establish that it was read. |
| `vani_reading_failed` | A request/response fails, or a research companion reports changed context. No raw error message is recorded. |
| `vani_retry` | User retries a research reading. |
| `vani_detail_opened` | User opens `explanation`, `evidence`, `intents`, or additional personal `connections`. |
| `vani_next_step` | User follows a supported research or personal link. Only destination type and area are sent. |
| `vani_feedback_submitted` | Existing feedback endpoint confirmed the vote was saved; `rating=helpful/not_helpful`. |
| `vani_feedback_failed` | Feedback could not be saved. A later successful retry is a separate submitted event. |

Modes: `current_flow`, `longer_term`, `market_structure`, `chat`. Sector details use `page=sector_detail`. Generic chat retains the existing VaNi page identifiers.

`duration_ms` on completion is time from the UI reading attempt to availability, including presentation delay on research companions. It is not server/model latency. Background query polling/refetching does not generate another completion for the same presentation. A deliberate repeat or research-context change is a new presentation. Generic chat completion is measured until its request callback. An automatic brief already in browser cache may report approximately zero.

## PostHog analysis to create after deployment

Filter to `product=dristiq` and `analytics_version=1`.

1. Reach: unique users with `vani_panel_viewed`, broken down by page/mode.
2. Active usage: unique users selecting an intent with source manual or external. Keep automatic openings out of this numerator.
3. Question usefulness: manual/external intent selected -> reading ready -> detail opened or next step, in the same session. Break down by intent and mode. These are behavioral proxies, not proof of understanding.
4. Personal follow-through: next step with area personal_connections; compare chart/sector inspection with bookmarks/positions navigation. A click to add positions is not a saved position.
5. Feedback: helpful vs not-helpful submitted votes, alongside feedback failure counts. Do not count failed submissions as votes.
6. Reliability: reading failures, retry usage, and presentation duration. Do not treat frontend ready events as LLM invocation or cache-hit counts; use existing server logs for Qwen/Haiku/cache analysis.
7. Return usage: weekly returning users with manual/external intent selections using the existing PostHog user identity. Compare this with the beta users who needed assistance.

These dashboard definitions are documented here; no hosted PostHog dashboard was created by the code change.

## Data boundaries

Explicit events allow only categorical dimensions and timing. They do not forward VaNi request/response bodies, stock names/IDs, saved positions, prices, quantities, account tokens or feedback log IDs. Destination links are classified before capture. Explicit VaNi events override the automatic current URL/path/referrer properties with a synthetic page route/redacted referrer. VaNi panel containers use PostHog's `ph-no-capture` class to exclude descendant DOM text from autocapture. Existing application-wide pageviews, identity, and any session-replay configuration are outside this change.

## Review after pulling

- With the existing PostHog key configured, open Current Flow, then Longer-Term Leadership. Confirm separate automatic selection events and their modes.
- Click a question twice (including a cached repeat): one manual selection and one ready event per click, with the normal loader intact.
- Expand VaNi explanation/evidence; confirm detail events without answer text.
- Follow a personal chart link or Add positions: confirm categorical destination and personal_connections area, with no symbol/URL query.
- Submit Helpful/Not helpful: only a confirmed server save creates feedback_submitted. Simulate a failed feedback request and retry.
- Block the VaNi endpoint and retry a research reading; check failure/retry events and functioning page controls.
- Test mobile: one question click in the sheet must create one selection, despite desktop and mobile copies sharing data.
- Test workspace/scanner chat and its automatic brief separately. Automatic readings must not inflate deliberate usage.
- With analytics disabled or blocked, VaNi must continue working.

Automated checks stub the analytics transport; synthetic QA data never reaches production PostHog.
