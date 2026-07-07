# Dark/Light Theme — Status & Resume Notes (paused 2026-07-07)

Owner: "this will complete only when page by page things are resolved."
All code is on branch `claude/handover-document-2026-07-06-k57iv6`.
DO NOT merge to main until the owner clears the page-by-page QA and says so.

## Done
- **Phase 1 — machinery** (merged to main, PR #173, pre-hold):
  themeStore `mode: dark|light|system` + localStorage persistence +
  OS-follow listener + `data-mode` on <html>; Dark/Light/System pills in
  Settings → Theme; kaaladristi theme UI label renamed **DristiQ**;
  authStore setTheme type fix.
- **Phase 2 — sweep** (feature branch, commit 7885588): all 386
  `rgba(255,255,255,*)` inline styles + ~64 Tailwind white classes across
  88 files converted to semantic tokens (text tiers by alpha; hairlines/
  fills → `color-mix(in srgb, var(--text-primary) N%, transparent)`).
  Whites on accent/gradient backgrounds deliberately kept. Canvas draw
  code resolves vars via getComputedStyle. TradingChart re-creates on
  theme/mode change. applyTheme now sets --card-deep/--surface-dim/
  --kd-panel/--card-alt. Scrollbars + --border-strong derive from text.
- **Phase 3 — DristiQ light palette** (feature branch, commit 6711224):
  bg #f4f6fb, cards white, slate text, contrast-corrected accents
  (indigo #4f46e5, gold #a87e2c, amber-700 warnings). DARK_ONLY_THEMES
  now empty — all 3 themes × all 3 modes.

## Verified so far (headless Chromium, both modes)
TradingChart (+astro band tooltip), PatternsTab, UsersView, ThemeSettings
— on jade-thorn AND kaaladristi light. Dark mode pixel-consistent.

## REMAINING — owner page-by-page QA (the completion gate)
Walk each page in light mode (all 3 themes ideally, DristiQ minimum):
Workspace canvas (real framework + widgets), Dashboard V3, Scanner,
Chart view, Catalog (+DeepDive), Sector Rotation, Visual Pulse (index +
equity), Intraday, Inference, Rule Eval, Panchang, Correlation page,
Pricing/Account, Login/Landing, ProfileSetup (VaNi orb screens are
brand-dark by design — decide keep-dark or adapt).
Known judgment-call risks: canvas-based widgets not yet exercised
(VisualPulseChart, Magic RS subchart), gradient panels designed dark,
screenshots/images, chart series colors on light (SMA yellows may be
faint), VaNi purple-brand elements.
Fix protocol: owner screenshots anything wrong → patch on this branch →
re-verify → only then PR + merge (owner's explicit go).
