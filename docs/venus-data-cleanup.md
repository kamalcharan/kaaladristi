# Venus data identity cleanup

Migration 235 follows Mercury migration 234. This changes database identities and backend generators only; no UI changes. It has not been applied to production by this task.

## Calendar dates and precision

Planetary records include every calendar day, including weekends and exchange holidays. No trading-calendar filter or next-session shift is applied. A market-analysis window of plus/minus one or two days belongs in the interpretation layer and must not rewrite the astronomical date.

Daily samples support sampled periods and brackets between consecutive dates, not exact transition times. Point records use the bracket's upper date as their storage label; consumers must retain and display the bracket and precision. Missing daily samples prevent refresh rather than silently removing historical events.

## Identities

| Legacy rule | Canonical identity |
| --- | --- |
| BAY-R03-VEN-RET | Venus Retrograde |
| TRN-VEN-RIS-W-BUL | Venus Turns Direct |
| TRN-VEN-RIS-E-BUL | Venus Turns Retrograde |
| TR-VEN-CMB-W-BUL | Venus Combustion, using the recorded combustion flag |
| CON-MER-VEN-BEA | Mercury–Venus proximity below 5 degrees |
| CON-MER-VEN-CD-BEA | Proximity below 5 degrees with Mercury direct and Venus retrograde |
| CON-VEN-MER-BEA | Inactive alias of the general proximity rule |

The calendar also exposes direct motion, sign journeys with the sign lord, and crossing brackets. A station is not a visibility rise. Venus Rise and Venus Combustion in West remain unresolved definitions, with no generated events. The owner's 15–27 October references remain unverified. Market-direction claims are not carried into canonical event bias.

## Checks against the supplied October 2026 samples

- General proximity: 3–10 October, including both Saturdays.
- Mercury direct / Venus retrograde proximity: 4–10 October.
- Longitude crossing: bracketed between 6 and 7 October; exact time unknown.
- Venus retrograde transition: upper sample date 4 October, a Sunday.
- Recorded combustion flag: 18–30 October, starting on Sunday. This does not establish western visibility or validate an almanac combustion method.

## Apply and verify

1. Apply `kaaladristi/App/DBscripts/km_migration_235_venus_event_identity.sql` after migration 234. The transaction populates the canonical calendar and reconciles legacy transit readers; a Python run is not needed for this step.
2. Run `kaaladristi/App/DBscripts/verify_235_venus_event_identity.sql` and inspect/export its results. The alias/timestamp count should be zero and the invalid-motion query empty.
3. Deploy the updated backend before running any older Venus, Bayer, or discovery generator. Those writers now use the same database refresh function.

If source coverage is shorter than existing transit history or has missing samples, the migration aborts. Report that error and restore the required source coverage before retrying; do not remove the guard. Issue `ROLLBACK` if the SQL client leaves the failed transaction open.

Original rules, transits and affected derived records are archived in `km_venus_identity_backup`. Corrected period starts can change transit IDs; unchanged starts preserve IDs. The duplicate alias has no generated rows. Affected old research and cached astro readings are invalidated, while unrelated rules are preserved. Repeating the migration/refresh without source changes preserves newly generated evidence. Backup access is restricted to backend/admin roles, rather than public client roles. Recovery must account for subsequent writes; do not blindly restore archived rows.

## Validation

`backend/tests/venus_identity_migration.cjs` executes the actual SQL in isolated PGlite using the supplied ephemeris fixture. It checks weekend retention, conjunction motion, bracket precision, alias removal, backups, permissions, idempotency, invalidation, missing-sample rejection and transactional rollback. The Mercury migration regression test remains separate. Python helper tests run from `kaaladristi/App/backend` with `python -m unittest discover -s tests -p 'test_*identity.py'`.

Future UI work must read canonical identity and precision instead of interpreting legacy code suffixes as direction or visibility.
