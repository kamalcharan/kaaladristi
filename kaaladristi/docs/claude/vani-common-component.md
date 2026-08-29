# VaNi — Common Component Consolidation (2026-08-29)

Started as a Breakout Surge question ("we're going to use VaNi in many
places, we need a common UX") and turned into a real cross-page audit.
Captured here rather than in `breakout-surge-vani-poa.md` since none of the
files touched are Breakout-Surge-specific.

## What was found

Two independent backends:
- **"Skills" system** (`ai_prompts.py` → `GET /api/ai/<skill>`) — React
  Query `useQuery`, auto-fetches + caches on page load. Powers Dashboard /
  Panchang / Breadth cards and ChartView's instrument insight.
- **"Intents" system** (`vani_intents.py` → `POST /api/vani/ask`) — React
  Query `useMutation`, fires only on click. Powers the global drawer
  (`VaNiChatPanel.tsx`, opened via `Layout.tsx`'s "Ask VaNi" pill), entity
  questions (`VaNiTrigger.tsx`, one on every scanner row), and scanner
  questions.

Four rendering surfaces on top of those two backends (before this pass):
1. `VaNiInsight.tsx` — the good one: indigo tint, left accent bar, "✦ VaNi
   · वाणी" header, loading state, optional chip-highlighting, `VaNiFeedback`
   wired in via `logId`. Fed by the Skills system. Used on ChartView +
   Dashboard/Panchang/Breadth.
2. `VaNiChatPanel.tsx` (the drawer) — conversational, rotating intents
   (merges page-level `scanner.*` + entity-level `equity.*` into one list),
   feedback per message. Fed by the Intents system.
3. `VaNiTrigger.tsx` — a small "✦" launcher for #2, entity-scoped.
4. `RuleInsightCard.tsx` (inside `OverlayExplainPopover.tsx`) — a fourth,
   bespoke card: its own header, its own skeleton-loading treatment, and a
   **different accent color** — `--vani: #9d8ff9` (`globals.css:11`) vs.
   `VaNiInsight`'s `--indigo: #9b8cff` (`globals.css:70`, aliased as
   `--accent-indigo`). Two near-identical purples depending which card
   you're looking at.

ChartView also hand-rolled its own collapse/expand wrapper around
`VaNiInsight` (`maxHeight` + fade gradient + a "Read full VaNi analysis"
toggle) locally in `ChartView.tsx` — the same thing built and then deleted
for the Breakout Surge preview earlier this session (see
`breakout-surge-vani-poa.md` v8→v10).

## What changed

Owner's call: **one component (`VaNiInsight`) for every "VaNi's take, shown
inline" surface** — its prop contract (`insight`/`isLoading`/`logId`) is
already generic enough not to care which backend produced the text.

- `VaNiInsight.tsx` gained two new optional, additive props:
  - `collapsible` + `collapsedHeight` (default 130) + `fadeTo` (default
    `var(--bg)`) — promotes ChartView's hand-rolled collapse wrapper into
    the shared component. Off by default; every other existing usage
    (Dashboard/Panchang/Breadth) is unaffected.
  - `cached` — a small "⚡ cached" badge, promoted out of
    `RuleInsightCard.tsx`'s own header (it already had `data.cached`
    available from `useRuleInsight`, just rendered locally before).
- `ChartView.tsx` — replaced its local `readExpanded` state + hand-rolled
  `maxHeight`/gradient/button trio with
  `<VaNiInsight ... collapsible collapsedHeight={130} />`. Net removal of
  ~10 lines and one piece of component state; visually identical.
- `RuleInsightCard.tsx` — rewritten from a full bespoke card down to a thin
  wrapper: fetch via `useRuleInsight`, keep the rule-insight-specific tag
  stripping (`<explanation>`/`<how_to_use>`/`<caveat>` → plain text — this
  is real data shape, not styling, so it stays), then hand the cleaned text
  to `<VaNiInsight insight={...} isLoading={...} cached={data?.cached} />`
  for all rendering. Its old skeleton-bar loading treatment is gone,
  replaced by `VaNiInsight`'s own spinner — a deliberate part of "one
  common component," not a regression.

## What was found but NOT touched — flagged for the owner

**`--vani` is not a stray token — it's a second, widely-used brand accent.**
Before touching `RuleInsightCard.tsx`, a grep for `var(--vani)` across the
app found it live in `VaNiMorningBrief.tsx` (~20 occurrences),
`StoryMode.tsx`, `ThesisTab.tsx`, `MoveQualityCard.tsx`, `RotationGraph.tsx`,
`TradingChart.tsx` (on-candle annotation bubble), and
`OverlayExplainPopover.tsx`'s own popover chrome (separate from
`RuleInsightCard`, which sat inside it). That's a much bigger footprint than
the "one stray leftover" this doc originally assumed when proposing the
consolidation — reconciling `--vani` and `--indigo`/`--accent-indigo` into
one token would mean touching 8+ files and dozens of occurrences, a
separate, larger decision than "migrate one card component." Not attempted
here. `RuleInsightCard.tsx` itself now correctly uses `VaNiInsight`'s
`--indigo` treatment (the one file actually in scope for this pass); every
other `--vani` usage is untouched and still live.

## What stays deliberately different, and why that's not an inconsistency

Trigger/placement varies by page type on purpose:
- **Single-instrument pages** (Chart) — VaNi's read is central to the page,
  so it auto-fetches via the Skills system and shows inline, no click
  required.
- **List/scanner pages** — stay on-demand via the drawer (owner's call
  earlier this session, see `breakout-surge-vani-poa.md` v10) rather than
  firing an LLM read per visitor per visit.
- **Chart overlay/rule clicks** — contextual, click-triggered, anchored near
  the click point (`OverlayExplainPopover`'s floating chrome) — a different
  *container* because of where it's invoked from, but the content block
  inside is now `VaNiInsight`, same as everywhere else.

## Verification

`npm run typecheck` — clean. `npm run build` — clean, theme-standard ratchet
unchanged (371 hex + 276 rgba). No live API access from this environment to
visually confirm ChartView's collapse behavior is pixel-identical to before
— the prop values (`collapsedHeight={130}`, default `fadeTo`) were copied
directly from the code being replaced, so it should be, but worth a glance
on deploy.
