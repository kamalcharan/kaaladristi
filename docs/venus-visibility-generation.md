# Generated Venus visibility calendar

52 full Tara Asta periods overlapping 1 January 1990 through 31 December 2030 were generated locally. Each period supplies an Asta point, an Udaya point and a period row (156 calendar rows). Boundary periods retain their full timestamps rather than being clipped at January 1. Weekends and holidays are included.

## Apply

1. Migration 235 must already be applied.
2. Run `kaaladristi/App/DBscripts/km_migration_236_venus_visibility.sql`.
3. Run `kaaladristi/App/DBscripts/verify_236_venus_visibility.sql` and share results.

The generated SQL includes the calculated records. No Python execution on the deployed backend is necessary to populate this range. Nothing has been applied to the live database by this task. A repeat application preserves identical rows; conflicting overlapping dates or parameters abort the transaction instead of silently introducing another calculation method. If the client leaves a failed transaction open, issue ROLLBACK before proceeding.

## Read contract

- `km_venus_visibility_windows`: one calculated period with model provenance.
- `km_venus_visibility_calendar`: `venus_tara_asta`, `venus_tara_udaya`, `venus_tara_asta_period`.
- `km_venus_calendar`: common fields from the existing daily calendar plus the visibility calendar. This is the unified data entry point for future consumers. The UI has not been switched to it in this data-only work.

Use the two point types for markers, or the period type for a band; do not count the period and its endpoints as three separate episodes. Existing legacy angular-combustion and station rules are unchanged and must not be relabelled as visibility. Old unresolved references are not imported into the calculated calendar. No manual overrides or alternate Drik dates are generated.

## Method

Version `venus_visibility_ujjain_v1`: Ujjain 75.7885 E, 23.1793 N, 494 m; IST; Swiss Ephemeris 2.10.03, explicit Moshier engine; high-precision visibility flag. Atmosphere [1013.25 hPa, 25 C, 40% RH, 0.24 extinction]; observer [age 36, Snellen ratio 3.25, no optical parameters]. These are the unchanged parameters selected after the reference comparison, not a claim to reproduce Drik's method exactly.

Both cycles are calculated: last morning visibility to first evening visibility, and last evening visibility to first morning visibility. Technical cycle names are stored as provenance without complicating the user-facing event names. Times are model estimates, not observed precision. The market's plus/minus one or two day interpretation window is not part of these calculations.

Reproduce from backend with pyswisseph 2.10.3.2 installed:

```powershell
python scripts/generate_venus_visibility.py --from-year 1990 --to-year 2030 --json-output venus-visibility.json --sql-output venus-visibility.sql
```

The SQL template is `scripts/venus_visibility_schema.sql`; edit that source and regenerate rather than hand-editing calculated timestamps. JSON output is also committed as `docs/venus-visibility-1990-2030.json`. Runtime dependencies were installed in an isolated local temporary directory; production dependencies were not changed. Future model changes need an explicit replacement migration, not an unreviewed rerun with different parameters.

Validation covers actual migrations 235 and 236 together in isolated PostgreSQL/PGlite: row counts, repeatability, read-only application grants, stable event keys across DB timezones, rejection of conflicting model provenance, and existing identity regressions. Reference-date comparisons are documented separately in `venus-drik-reference-validation.json`.
