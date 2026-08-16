# Scanner matview parity harness

Verifies that the `km_scan_results` materialized view (migration 147) still
reproduces the live client-side bundle scanners in `scanEngine.ts` — the
check that must pass before (and after) repointing the frontend at the
matview. The 2026-07-10 proof used throwaway scratchpad scripts that were
never committed; this harness is the committed replacement.

**Zero transcription drift by construction**: `build.mjs` bundles the REAL
`src/services/scanEngine.ts` with esbuild, aliasing only its `./postgrest`
import to `postgrest-shim.mjs`, which translates the query-builder calls to
SQL over the read-only MCP endpoint (`mcp-db.dristiq.com`, the repo's
`.mcp.json` connector). Production logic runs unmodified against live data.

## Run

```bash
cd scripts/qa/scan-parity
export KD_MCP_BASIC=...        # base64 "claude:<password>" — same as .mcp.json
node build.mjs                 # rebuild after any scanEngine.ts change
node run-parity.mjs                        # verbatim production behavior
PARITY_LIFT_SYMBOL_CAP=1 node run-parity.mjs   # with data-visibility caps lifted
```

Each run writes `parity-report-<mode>.json` and prints a per-preset table:
membership (onlyJS/onlyMV), rank order (rankΔ), and vani_flag (vaniΔ).

The two modes exist because production truncates its own input data
(`km_equity_symbols` LIMIT 8000 vs 10k+ active rows; `km_industry_eod`
LIMIT 1000 vs ~3.4k needed — found 2026-08-15). The verbatim run shows what
users currently see; the cap-lifted run isolates LOGIC parity, which is the
repoint-safety signal.

## Reading the results

- Rank swaps among rows with EQUAL sort keys are expected: JS keeps
  nondeterministic insertion order on ties, the matview tiebreaks by
  `equity_id`. Verify by checking the sort-key values before calling drift.
- Run only when the matview and the EOD tables describe the same trade date
  (the harness aborts otherwise). Don't run mid-pipeline.

Findings from the 2026-08-15 audit: `docs/claude/scan-matview-audit-2026-08-15.md`.
