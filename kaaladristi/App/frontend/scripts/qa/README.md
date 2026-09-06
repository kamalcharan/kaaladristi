# Theme QA screenshot harness

Ground-truth visual verification for theme work (see
`docs/claude/glass-ux-status.md` §4). Renders the REAL app against a running
`npm run dev` server with stubbed auth + data — no backend needed.

```bash
npm run dev &                       # vite on :5173
node scripts/qa/qa-screenshots.mjs                          # all routes × dark+light × 3 themes
node scripts/qa/qa-screenshots.mjs --themes=kaaladristi --modes=light --routes=/workspace,/catalog
node scripts/qa/qa-catalog-tabs.mjs                         # Catalog sub-sections (static content)
```

- Chromium path: `PW_CHROMIUM` env (defaults to the Claude sandbox path).
- Output: `screens/<theme>/<mode>/<route>.png` next to the script.
- Auth is stubbed via localStorage `kd_session`; the stubbed `km_profiles`
  row's `theme`/`mode` fields drive the axis under test.
- Verification rule: pixel-diff against a pre-change baseline. Dark mode must
  stay at ~0.0% delta on untouched pages. No theme fix is "done" without a
  harness diff or an owner screenshot.

## Mobile (phone-viewport) harness — scanners

Added 2026-09-06 while making the scanner pages usable on a phone. Same
stubbing approach as above, but with REAL-SHAPED scan rows (one live
`km_scan_results` row cloned twelve ways, `qa-mobile-fixtures.mjs`) and the
active `kd_scan_presets` (`fixtures/presets.json`) so the tab strip, filter
bar, table and cards actually render instead of settling into empty states.

```bash
npm run dev &
node scripts/qa/qa-mobile.mjs --width=390 --view=table --tag=before   # phone, table view
node scripts/qa/qa-mobile.mjs --width=390 --view=cards --tag=before   # phone, cards view
node scripts/qa/qa-mobile.mjs --width=1600 --view=table --tag=before  # desktop baseline
# ...make the change...
node scripts/qa/qa-mobile.mjs --width=1600 --view=table --tag=after
node scripts/qa/qa-diff.mjs scripts/qa/screens-mobile/before-1600-table \
                            scripts/qa/screens-mobile/after-1600-table  # % pixels changed per route
node scripts/qa/qa-overflow.mjs --width=390                            # what pokes past the right edge
```

- `qa-mobile.mjs` prints `docWidth` vs `vw` per route. On a phone the two
  are equal ONLY when nothing forces the layout viewport wider than the
  device — a page that would make a real phone zoom out reports both as the
  same larger number (e.g. `398` on a 390 device), so compare against the
  `--width` you asked for, not against each other.
- `qa-overflow.mjs` lists the OUTERMOST elements whose right edge exceeds the
  device width, with their inline style. Chips inside a horizontal scroll strip
  and the table inside its scroll box show up here by design; a static `div`
  is the thing to fix.
- `qa-diff.mjs` needs no npm packages — Chromium decodes both PNGs onto
  canvases and counts differing pixels.
- Output: `screens-mobile/<tag>-<width>-<view>/<route>.png`, full-page.

### The session token must look like a JWT

`services/auth.ts` `tokenExpired()` (2026-07-25) treats an unparseable token
as expired and clears the session. The harness's old `'harness-token'` had no
`.`-separated payload, so every route bounced to the landing page — the
harness had been silently broken since that change. All three scripts now seed
a header.payload.signature token with a far-future `exp`; the signature is
never verified client-side.

Also seed `kd_tour_page-<tourId>_<userId>` for any route with a Guided Walk
(`hooks/useTour.ts`), or the tour overlay covers the screenshot.

### Full-page captures misdraw the fixed sidebar — do not read the rail from them

`fullPage: true` re-lays the page out at the document size for the capture,
and during that pass the fixed sidebar paints at its 260px mobile width
(`w-[260px]`) instead of the 220px `md:` width, covering the first ~35px of
whatever sits beside it — on /scanner that is the category rail's labels.
The live DOM is fine (nav 220px, label at 234, `elementFromPoint` returns the
label); a plain viewport screenshot shows the rail intact. Judge anything
adjacent to the sidebar from a viewport capture, and treat the full-page
sidebar edge as unreliable.

