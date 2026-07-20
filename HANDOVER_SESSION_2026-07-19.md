# Session Handover — 2026-07-19

Branch: `claude/ready-to-start-l3vzs1` (merged to `main` at end of session).
Scope: launch-readiness sprint — landing page, payments hardening, onboarding,
tours, and polish fixes. **22 commits, all frontend build + theme gates green.**

---

## 🚨 CRITICAL — manual owner/deploy actions before this is live

The code is merged, but several steps are **manual** and NOT done yet. Deploy in
this order:

1. **Rebuild + redeploy the frontend** (all the UI work is frontend-only).
2. **Restart `pipeline2_api` on the VPS** — activates: landing spotlight
   endpoints, payment webhook-signature enforcement, `/reconcile`, the daily
   tier-expiry sweep job, and the `ema_20` spotlight chart field. One restart
   covers everything.
3. **Run these migrations in psql/pgAdmin** (in order):
   - `km_migration_164_forgot_password_token_leak.sql` — **SECURITY**: closes a
     live account-takeover hole (forgot-password returned the reset token in
     its response). Run this regardless of anything else.
   - `km_migration_165_force_reonboard_theme.sql` — sets `onboarded=false` for
     ALL users so they're forced through the new Theme onboarding step.
     **Run this AFTER the frontend is redeployed** (else resumed users hit an
     onboarding without the theme screen).
   - (`km_migration_163_pricing_gst_beta_default.sql` was already run — it was
     renamed from a mis-numbered 160; the SQL is already applied. Don't re-run.)
4. **Razorpay dashboard**: confirm a webhook is registered at
   `https://<domain>/api/payments/webhook`, active, subscribed to
   **`payment.captured`**, with the secret matching `RAZORPAY_WEBHOOK_SECRET`
   in `.env`. After the signature fix, a missing/mismatched secret means the
   webhook **rejects all events** (reconcile is only a fallback). Also enter
   your **GSTIN** in Razorpay settings if you want Razorpay to issue GST
   invoices (the Invoice *API* can't mint GST invoices — Dashboard only).
   Keys are already live in `.env`.

---

## What shipped this session

### Landing page (all decisions in the session are implemented)
- **Vikuna Black palette sync** — landing + login now match the app.
- **"Today on DristiQ" proof band** — a public, depersonalized chart-of-the-day.
  Backend `GET /api/landing/spotlight` (+ `/reveal`, JWT). **Regime-gated**: a
  NIFTY 500 breadth/ROC read picks a masked top **Conviction Flow / Stage 2**
  stock when participation is healthy, or a masked top **Stage 4 + Lagging RS**
  laggard when it's deteriorating (owner chose option b), else the index view.
  Regime NEVER appears in copy — it only drives selection. Chart shows EMA20 +
  Magic RS band (the DristiQ look) with zero identity leakage.
- **"Login to view"** CTA → deep-links, after login/onboarding, to that stock's
  **Study** page (`services/spotlight.ts`, one-shot intent).
- **Astro cycle teaser** ("Releasing soon") + full **SEBI disclosure** in footer.

### Payments — P0 hardening (all done)
- Webhook **signature verification enforced** (was commented out).
- **Server-side expiry**: daily 00:15 IST scheduler sweep demotes lapsed
  trial/annual (never touches beta/admin). `km_config.tier_expiry_demote_to`.
- **Reconcile** endpoint + UI recovery card for paid-but-webhook-missed.
- **Pricing model = yearly-only**: Trial ₹199/14d + Annual ₹4,999/yr, **GST
  shown upfront** (`+18% GST · ₹total`), breakdown stored per payment
  (`user_subscriptions.base/gst/total_paise`). Free + Quarterly removed.
- **No subscriptions** — annual is a one-time GST-inclusive **order** (owner
  decision); expiry sweep handles lapse. `create-order` handles trial+annual;
  webhook `payment.captured` activates both. Razorpay Plans no longer needed.
- New signups default to **`beta`** tier; PricingCards shows a founding-member
  banner + "Free in Beta" during beta.
- Cleaned stale pricing copy in `InlineGate` + `AccountPage`.

### Onboarding & auth
- **Login → Vikuna Black**; **invite gate removed** (open registration).
- **Onboarding completes only at the final step** (was at framework build) — so
  abandoning forces the user back; `icp_mode` is the resume signal.
- **Mobile number now required + validated** (`lib/phone.ts`) in onboarding +
  Account. No OTP (WhatsApp community is the human gate — owner decision).
- **NEW Theme step** (final onboarding step) reusing `ThemeSettings` — every
  user picks a theme before entering. Migration 165 forces existing users back.
- **Password-reset token leak fixed** (migration 164); forgot-password copy made
  honest (reset is admin-assisted until email infra exists).

### Tours / UX polish
- **Workspace explainer walk** (driver.js spotlight, tab-aware, gold "guided
  walk" popover). Engine: `hooks/useTour.ts`, `config/tours/workspaceTour.ts`.
- **Page-intro tours for all 24 non-admin pages** via a central registry
  (`config/tours/registry.ts` + `components/ui/PageTour.tsx` in the Layout
  topbar). Centered intro cards; admin/ops pages excluded.
- **Sidebar**: "View" parent heading flattened to top-level items.
- **Scanner**: export/view controls kept on the filters row (saves a row).
- **Bookmark toggle race fixed** — was resetting on scanners (load vs optimistic
  toggle clobber in `bookmarkStore`).

---

## Pending — decided but NOT built
- **Explainer spotlights (anchored) for flagship pages** (Scanner/Pulse/Study) —
  registry supports anchors; long-tail pages use centered cards for now.
- **Astro cycle** real overlay → becomes the pricing event for the astro tier.
- **Astro premium tier** (Core vs Core+KaalaDristi) — at astro-cycle launch;
  existing yearly holders grandfathered.

## Pending — needs email infrastructure (deferred)
- **Email verification** on signup (no transactional email exists in the stack).
- **Proper self-serve password reset** (currently admin-assisted).
- **Renewal reminder** email before annual expiry (one-time order = no auto-renew).
- **GST invoice** self-generation (breakdown is stored; needs email to send).
- **Google auth** — owner interested; would sidestep email-verify + reset
  entirely for Google users. "Do later."

## Pending — public-launch flips (config, at launch not beta)
- `km_profiles.tier` default `beta` → `free`.
- **Beta→paid migration** with **20% founding-member discount** (owner decision).
- Plan prices fully DB-driven (still partly in the frontend `PricingCards` array).

## Pending — needs an owner decision (nothing built)
- **PLG instrumentation** (`km_product_events`) — flagged repeatedly as the
  cheapest high-leverage next step (funnel is currently unmeasured).
- Free-tier shape at launch · scanner "new today" badges
  (`docs/claude/scannerenhancement.md`) · VaNi Morning Brief to email/push ·
  shareable chart snapshots (referral).

## Dropped (owner decisions)
GST refund window · in-app cancel · mobile OTP · quarterly plan · Razorpay
subscriptions/plans.

---

## Migration numbering note
CLAUDE.md said "next = 153" but the repo already had files through 162.
This session added **163** (pricing, renamed from a mis-numbered 160), **164**
(password-reset), **165** (force re-onboard). **Next migration = 166.**
Always `ls App/DBscripts/km_migration_*.sql | sort` before picking a number.
