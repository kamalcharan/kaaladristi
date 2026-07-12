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
