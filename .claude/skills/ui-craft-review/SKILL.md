---
name: ui-craft-review
description: Audit and fix UI-craft defects — contrast/eye-strain problems, text that goes invisible when the theme or mode changes (light/dark, multi-theme), hardcoded colors that bypass a project's design tokens, and inconsistent visual hierarchy/spacing/typography. Use when a user reports something is hard to read, eye strain, "text disappears in light mode", low contrast, or asks for a UI/visual polish pass — as distinct from UX work (flows, IA, usability; see ux-flow-review for that). Works on any component-based frontend (React/Vue/Svelte/plain CSS) that themes via CSS custom properties, not just this project.
---

# UI Craft Review

UI craft is the *visual execution* layer: contrast, spacing, type scale, color
tokens, hierarchy. It is a different discipline from UX (flows, information
architecture, usability) — don't conflate the two. If the complaint is about
a confusing flow, wrong information in the wrong place, or a broken journey,
that's `ux-flow-review`, not this skill.

This skill exists because of a real, reproducible bug class: a component
mixes a **theme-aware background** (`var(--card)`, `var(--bg)`, etc. — flips
when light/dark mode changes) with a **hardcoded literal text color**
(`color: '#e8e6e0'` — never flips). When the background goes light and the
text stays a fixed near-white, the text becomes unreadable. First caught on
a login screen where the input background correctly went light via
`var(--card)` but the input text stayed hardcoded near-white.

## When to use this

- User reports low contrast, eye strain, "can't read this", or "text is
  invisible" in some mode/theme.
- Before/after a light-mode (or any additional theme) rollout, to catch
  components that were only ever visually checked in the default theme.
- General UI polish pass: inconsistent spacing, weak hierarchy, "this looks
  AI-generated" tells (Inter-everywhere, purple-to-blue gradients on
  everything, cards nested in cards, gray text on colored backgrounds,
  identical rounded-square icon tiles above every heading).

## Step 1 — find the project's real theme tokens first

Do not guess semantic token names. Find where the app defines its
CSS custom properties (commonly a `globals.css` / `theme.css`, or a
JS file that calls `element.style.setProperty(...)` per theme). You need
the actual list of `--bg`, `--text-primary`, `--text-secondary`, etc. (names
vary per project) before proposing a fix — the fix is always "route the
hardcoded value through the token that already exists for this purpose",
never inventing a new one-off value.

## Step 2 — run the automated sweep

```bash
python3 .claude/skills/ui-craft-review/scripts/scan_theme_contrast.py <src-dir>
```

This is a regex heuristic, not a real parser: it flags files where a
`var(--bg|card|surface*)` background appears *and* a literal hex/rgb
`color:` also appears, then classifies that literal as light/mid/dark by
relative luminance. It reports **candidates**, not confirmed bugs — false
positives are expected (e.g. white text intentionally fixed over an
always-colored badge is correct, not a bug, because that background never
theme-flips). Triage each hit by reading the component: does the
background *at that point* actually change with the theme? If yes, the
text color must be a matching semantic token, not a literal.

`--json` gives structured output if you want to pipe it somewhere.

## Step 3 — fix pattern

Replace the literal with the semantic token that matches its role, not the
token that happens to produce a similar-looking color today:

- Primary/heading text → `var(--text-primary)` (or project equivalent)
- Secondary/label text → `var(--text-secondary)`
- Muted/meta text → `var(--text-muted)`
- Faint/decorative text → `var(--text-faint)` — and if this token itself is
  a flat opacity of primary text, check whether that flat opacity holds up
  in BOTH modes (a flat 25% alpha that reads fine on near-black can fall
  under WCAG's 3:1 floor on a light background — this project's own
  `globals.css` documents exactly that fix, worth reading as a model).
- Borders/dividers/glows derived from a brand accent → prefer
  `color-mix(in srgb, var(--accent) N%, transparent)` over a hardcoded rgba,
  so the tint follows the accent if the theme changes it.
- A color that's genuinely meant to stay fixed regardless of theme (e.g.
  dark text on a button that's always a bright brand-gold gradient) is NOT
  a bug — leave it. The test is always "does the surrounding surface change
  with the theme", not "is this a literal".

## Step 4 — contrast quick-reference (WCAG)

- Normal text vs. its background: **4.5:1** minimum (AA).
- Large text (≥24px, or ≥19px bold) and UI component boundaries: **3:1**.
- Compute relative luminance: `L = 0.2126*R + 0.7152*G + 0.0722*B` (linearized
  channels — see the script for the exact formula) and contrast ratio
  `(L1 + 0.05) / (L2 + 0.05)` with L1 the lighter of the pair.
- When in doubt, don't eyeball it — compute it, or ask the user to check the
  live page in both modes.

## Further reference

This skill was distilled from a handful of third-party UI/design skill
collections (a design-system/token-architecture toolkit, a deterministic
AI-slop/accessibility detector, and a "Refactoring UI"-style craft
bundle) that aren't vendored in this repo. For deeper craft judgment
calls this skill's lightweight scanner doesn't cover — spacing rhythm,
type pairing, motion — search for an equivalent published skill/plugin
rather than assuming one is bundled here.
