---
name: ux-flow-review
description: Review and improve UX — user flows, information architecture, task completion, onboarding, navigation, and usability — as distinct from UI craft (contrast, spacing, visual polish; see ui-craft-review for that). Use when a user says something is "confusing", asks where a feature should live, wants a flow/journey reviewed, describes users getting stuck or dropping off, or asks for a usability pass on a page or feature.
---

# UX Flow Review

UX is the *behavioral* layer: does the flow make sense, is the right
information in the right place at the right time, can a user complete the
task without getting lost. It is a different discipline from UI craft
(contrast, spacing, typography, "does this look/read well") — don't conflate
the two. If the complaint is "this is hard to read" or "text disappears in
some mode", that's `ui-craft-review`, not this skill.

## When to use this

- A flow, page, or feature is reported as confusing, or users are getting
  stuck/dropping off at a specific step.
- Deciding where a new feature or piece of information should live (IA
  question) — which page, which tab, near what other content.
- Reviewing an onboarding/setup wizard, a multi-step form, or any sequence a
  user has to complete.
- A "does this make sense" or "is this the right flow" gut-check before
  building something new.

## Method

1. **State the user's goal, not the feature's mechanics.** Before evaluating
   a flow, write one sentence: "the user is trying to ___". Every step you
   review gets judged against whether it moves the user toward that goal or
   away from it (a step that's technically correct but doesn't serve the
   goal is still a UX defect).

2. **Walk the actual flow, not the happy-path summary.** Trace every screen,
   click, and decision point a real user hits — including error states,
   empty states, and the back button — not just the intended straight-line
   path. Most real UX defects live in the states nobody demos.

3. **Apply a heuristic pass** (condensed from Nielsen's usability
   heuristics — search for a fuller persona/journey-mapping/research-
   synthesis skill if a task genuinely needs that depth):
   - **Visibility of system state** — does the user always know what's
     happening (loading, saved, error, which step they're on)?
   - **Match with the real world** — does the language/order match how the
     user actually thinks about the task, not how the database models it?
   - **User control & freedom** — can they back out, undo, or correct a
     mistake without starting over?
   - **Consistency** — does this flow behave like other flows in the same
     product (same verbs, same button placement, same terminology)?
   - **Error prevention > error messages** — could the flow make the mistake
     impossible instead of just detecting it?
   - **Recognition over recall** — is what the user needs visible, or do
     they have to remember it from an earlier screen?
   - **Minimal necessary steps** — is every step earning its place, or could
     two be merged / one removed without losing anything the user needs?

4. **Distinguish a flow problem from a content problem.** "The user didn't
   notice this" is often not a flow defect but a hierarchy/attention defect
   — that's UI craft's territory (`ui-craft-review`). Keep the two separate
   in your findings so fixes land in the right place.

5. **Write findings as: step → what breaks → who it breaks for → fix.** Not
   a general "this could be better" — name the exact screen/step, the
   concrete failure (not vague "confusing"), and a specific proposed change.

## What this skill does NOT cover

- Visual contrast, spacing, color, typography → `ui-craft-review`.
- Formal user research methodology (running actual interviews, persona
  synthesis from real data) — this skill is for reviewing/improving an
  existing flow with the judgment above, not for conducting primary
  research. If real research is needed, say so explicitly rather than
  fabricating personas or usability-test results.

## Further reference

This skill was distilled from a broader product-design skill collection
(persona generation, journey mapping, usability-test planning, research
synthesis) that isn't vendored in this repo. Search for an equivalent
published skill when a task genuinely needs formal research artifacts
(personas, journey maps as deliverables) rather than a review-and-
recommend pass.
