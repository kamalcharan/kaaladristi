# Mercury data identity cleanup (migration 234)

Scope: database identities, a review calendar and protection against future
misclassified generation. No frontend files, astronomical algorithms or existing
event dates are changed. Production application is a separate step; this change
was tested against an isolated PostgreSQL-compatible PGlite instance, not the
live database.

## Identity decisions

| Stable legacy code | Canonical identity | Stored name |
|---|---|---|
| TRN-MER-MAN-TRN | mercury_sign_journey | Mercury Sign Journey |
| TRN-MER-RIS-W-BUL | mercury_turns_direct | Mercury Turns Direct |
| TR-MER-CMB-E-BEA | mercury_combustion | Mercury Combustion |
| TR-MER-RET | mercury_motion_retrograde | Mercury Retrograde |

IDs and legacy codes are compatibility aliases retained because chart, Almanac
and VaNi readers already reference them. Rather than moving rows to new rule IDs
and breaking those consumers, `km_astro_rule_event_map` supplies their canonical
identities. New consumers must use `event_type`, not parse MAN/RIS from a code.
The source snapshots also carry `event_type` and `identity_version`.

`mercury_manifestation` is reserved with definition_status=pending. The owner's
10 April, 3 August and 14 November 2026 dates are unverified references, stored
separately in `km_astro_event_reference`; they never become generated events.
Rise dates are not relabelled as manifestation. No calculation is invented.

## Review calendar

`km_mercury_event_calendar` is a live view, not another independently generated
dataset. It exposes existing sign, retrograde, combustion and station-direct
records, plus boundaries/intervals derived from those records:

- Turns retrograde at a recorded exact retrograde start.
- Direct periods between known exact retrograde ends and subsequent starts;
  no direct-state extrapolation outside coverage.
- Rise at the exact end of a visibility_v3 interval. An old fixed-angle
  combustion record is not automatically a visibility event.
- Morning/evening rise uses the stored conjunction subtype. Missing subtype
  stays unknown; no automatic inference from an old rule name.
- Original UTC timestamps plus explicit IST display values and precision flags.
  Missing times remain NULL; clipped/date-only boundaries do not create point
  events. Source_kind separates visibility-model calculations from almanac
  overrides and other stored generator records.
- Sign, traditional sign lord and motion **at the interval's start**, where
  covered by source periods. They do not describe an entire long interval.
  A sign can change while motion stays direct. No unnamed generic 'lord' field.

Periods use half-open timestamp membership. Date-only sign boundaries cannot
resolve intraday changes and retain date-only precision. Point rise and station
events remain distinct even on the same calendar day (24 July 2026).

## Preserving old research

Before changing the four identities, migration 234 archives their rule rows,
transit rows, related inference rows, evidence/confidence/pattern/signal rows and
the index.astro_now cache in private `km_mercury_identity_backup` JSON snapshots.
Active affected hypotheses (including paired hypotheses) become superseded.
Old derived scores/signals/patterns are removed and transit matched flags reset;
price returns and astronomical dates remain intact. Corrected factual rules have
neutral baseline hypotheses until new hypotheses are explicitly authored.
The original text/conditions remain in recovery snapshots, not active definitions.

The cleanup only invalidates these four rules and index.astro_now cache. Existing
nightly evidence jobs may recompute factual observations over the unchanged
windows; that does not validate the superseded hypothesis or Manifestation.
Rerunning the migration does not delete newly recomputed evidence or newly
authored hypotheses. Backup contents are preserved, not overwritten.

## Apply and review

1. In the usual SQL client, connected to `kaala_dristi_db`, run the complete
   `App/DBscripts/km_migration_234_mercury_event_identity.sql` transaction.
   Unknown snapshot types or missing source rules cause an exception and no
   cleanup is committed. If the client leaves an aborted transaction open,
   issue ROLLBACK and inspect the error before doing anything else.
2. Run `App/DBscripts/verify_234_mercury_event_identity.sql` and review results.
   The source-transit difference query must return no rows. Manifestation event
   count must be zero. July 24 must show distinct station/rise timestamps.
3. Deploy the two generator/discovery script changes plus lib/mercury_identity.py.
   The generator now requires the migrated identity contract before its existing
   delete-and-rebuild step. Generic discovery cannot recreate these four rules
   from their former meanings.
4. **No generator rerun is needed for this cleanup.** The view reads existing
   data immediately. A later deliberate generator reconcile is the pre-existing
   operation that replaces transit IDs; review this cleanup before doing that.

Frontend changes are intentionally deferred. Database-backed labels will change,
but hardcoded frontend labels, saved framework names, tooltips and Bayer lists
are not all fixed by a data-only migration. Do not treat this as UI completion.

Recovery: do not drop the backup table. It includes complete original rule,
inference, derived and cache rows. A rollback must be reviewed against any new
research/generation since application; blindly reinserting snapshots could
overwrite later work. Source dates were never deleted by this migration.

## Tests

From App/backend:

```text
python -m unittest discover -s tests -p test_mercury_identity.py
python -m py_compile scripts/generate_mercury_windows.py scripts/rule_discovery.py lib/mercury_identity.py
```

Install `@electric-sql/pglite` into an isolated test-tools folder and set NODE_PATH
to that folder's node_modules (no product dependency change). Then:

```text
node tests/mercury_identity_migration.cjs
```

The integration test executes the actual migration and checks stable IDs/dates,
identity separation, period context, provenance, grants, evidence invalidation,
idempotency, unknown-data rollback and missing-timestamp behaviour.
