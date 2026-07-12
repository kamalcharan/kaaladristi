# Theme Session Record — 2026-07-12 (Glass UX resolution + dark-only launch lock)

Owner-facing record of the day's observations and decisions. Companion docs:
- `glass-ux-status.md` — the CANONICAL rules/decisions (read that first for any theme work)
- `theme-handover-2026-07-09.md` — the two earlier attempts' history

Branch: `claude/session-init-kbwxau` → merged to `main` 2026-07-12.

---

## Final state (what shipped)

**The app is dark-only for launch.** `LIGHT_MODE_ENABLED = false` in
`src/stores/themeStore.ts` (+ a mirrored flag in `index.html`'s FOUC script —
they are a sync pair). `resolveDark()` always returns true; the Settings Mode
toggle is hidden. Users' stored mode preferences still persist and resume
working when the flag flips. **Re-enabling light = flip both flags to true.**

Owner rationale (verbatim intent): after 5 sessions / 2 weeks, light mode
reached "much better" but not "confident enough to release." Dark is the
proven, praised mode — it ships alone.

## What this session fixed (all merged, all also benefiting dark)

| Commit | What |
|---|---|
| `f96a27ef` | Bug classes: 17 phantom CSS vars (75 sites — permanent `#0d1117` boxes, transparent panels, wrong display font) + 17 dark-fill sites triaged |
| `db50dcbb` | Header-system decision codified (16 bespoke headers are deliberate — do not re-litigate) |
| `f8855789` | 151 semantic color literals → tokens on the public path |
| `b539ead4` | `check:theme` → 4 hard gates (phantom vars, un-annotated dark fills, literal ratchet, ui/ cleanliness), runs inside `npm run build`; QA screenshot harness committed to `scripts/qa/` |
| `e58909c8`+`04bf08ef`+`a6d087ea` | Owner-calibrated light values: B-level muted text (82%), warm-ivory canvas (pick D), warm charcoal ink (pick B) |
| `9f1384d8` | Workspace Today redesign: editorial greeting, accent stat tiles, 1400 grid |
| `196c0d95` | Sector Rotation + Scanner tables: card containment, body/mono type split, VIX stat card |
| `5018a4a0` | Dark-only launch lock |

## Key observations (why light mode was hard — for future reference)

1. **The app was built dark-first for months.** Light mode was never a
   toggle; it was a retroactive audit of every color decision ever made
   (~880 hardcoded literals, 17 phantom vars, dark-assumed fills).
2. **Sessions 1–4 had no verification loop** — every fix was validated by
   asking the owner for a screenshot, one instance at a time. This session's
   Playwright harness (`scripts/qa/`) collapsed that to minutes and enabled
   4 calibration rounds in one day. **Never do theme work without it.**
3. **Fix bug CLASSES, not instances.** The phantom-var diff (used-vars minus
   defined-vars) found in one grep what two sessions of screenshot-hunting
   missed. The `check:theme` gates keep the classes dead.
4. **The plumbing was done days ago; the rest was design.** The calibration
   sequence — washed-out text → too monochrome → temperature clash →
   cold-ink strain — was a series of *design decisions nobody had made
   upfront*, surfaced one owner-reaction at a time. Locked-in results
   (do not regress; full values in `glass-ux-status.md` §3):
   - light muted text = 82% strength (60% washed out, 100% killed hierarchy)
   - light canvas commits to ONE temperature: warm ivory + warm gold blooms
   - ink matches paper: warm charcoal `#211d16` / `#6f6354`, never
     violet-toned text on the warm canvas
   - violet accent = interactive-only; data signals never wear it
5. **Why it still didn't reach "confident": derivation plateaus.** Deriving
   a theme through reaction loops converges asymptotically — each fix reveals
   the next-most-wrong thing, and "pleasing" has no checklist. Dark mode
   never had this problem because it was designed once, as a whole.

## The two honest paths for light mode (post-launch)

1. **Transplant, don't derive (recommended).** The owner already trusts a
   light design completely: ProKey's (the product the Glass UX standard was
   extracted from). Port its light values VERBATIM — ivory canvas, deep green
   accents, its exact text colors — as a theme. Mechanical port, zero taste
   iteration, one session.
2. **Wait for the demand signal.** Market-analytics products are a
   dark-normal category (TradingView, terminals). If beta users don't ask for
   light mode, it may never need finishing.

Do NOT resume light mode as another calibration loop — that method was
exhausted here.

## Deliberately deferred (unchanged from glass-ux-status.md §5)

Token renames to `--color-*`, font-mode axis, Button/StatCard/EmptyState
adoption, recharts→SVG, remaining ~725 literals (ratcheted down-only), the
Tech AI / Jade Thorn light palettes (never temperature-committed — they still
mix temperatures; apply the same recipe if their light modes ever ship).

**Pre-launch item still open:** error-state standardization — the raw
"Failed to load framework." / "backend may be offline" dead-ends on
Workspace, Correlation, Market Structure et al. Users hit these nightly
during the EOD-processing window.
