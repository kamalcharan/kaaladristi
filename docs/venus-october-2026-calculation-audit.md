# Venus October 2026: calculation audit

Follow-up: `venus-visibility-comparison.md` now records exploratory visibility calculations made after installing Swiss Ephemeris into an isolated workspace directory. The original daily-sample audit below remains unchanged.

This is a read-only audit of repository Python and the user's exported planetary positions. No live database connection, data rewrite, UI change or new ephemeris calculation was performed.

## Result

The existing `generate_ephemeris.py:is_combust` predicate reproduces every supplied Venus combustion flag: 52 daily samples, 20 September through 10 November 2026, zero mismatches. Its Venus condition is the shortest longitude separation from the Sun being less than or equal to 10 degrees. The resulting inclusive sampled window is **18–30 October 2026**.

This establishes consistency with the repository formula, not independent validation of the astronomical positions or proof of which deployed generator originally wrote the rows.

| Daily sample | Sun–Venus separation | Existing formula |
| --- | ---: | --- |
| 15 October | 13.83° | Outside |
| 17 October | 10.88° | Outside |
| 18 October | 9.36° | Inside |
| 27 October | 4.93° | Inside |
| 30 October | 9.64° | Inside |
| 31 October | 11.17° | Outside |

Entry is bracketed by the 17–18 October samples; exit by 30–31 October. The exported rows contain dates, not sample timestamps. The current generator samples at 05:30 UTC / 11:00 IST, but that convention alone does not establish historical row provenance. Do not label the boundaries midnight or exact event times.

## Why 15–27 October is different

The audited Venus predicate does not produce that pair of boundaries. It does not include a direction or visibility calculation. Moreover, the absolute separation on 28 October (6.52°) is smaller than on 15 October (13.83°): a single constant, symmetric angular threshold that includes 15 October cannot end on 27 October.

No Venus visibility implementation producing 15–27 October was identified in the inspected backend generators. Those dates are currently reference rows introduced by migration 235, not outputs of a verified Venus calculation. A different method could produce different dates, but its implementation must be located or explicitly defined before assigning this range a calculated identity.

## Direction and visibility

The signed Venus-minus-Sun longitude changes from positive on 23 October to negative on 24 October. This is a longitude crossing bracket. It must not automatically become a west/east visibility label for the entire combustion period. Both sides occur inside the 18–30 October window.

Mercury's separate generator uses `swe.heliacal_ut` with location/observer parameters and explicit almanac overrides. It is not a Venus calculation and its calibration/overrides must not be copied to Venus as validation. Swiss Ephemeris is unavailable in this local Python environment; no fresh heliacal result or exact crossing timestamp is claimed.

The older general discovery code also filtered weekends and ignored the west condition. Migration 235's canonical Venus path corrects those issues; the generic path still exists for other, out-of-scope rules.

## Recommended data contract

1. Keep the established event as **Venus Combustion**, with method **Sun–Venus longitude separation ≤10°**, daily-sample precision, and 18–30 October for this dataset. Do not attach west or a market-direction claim.
2. Define disappearance/reappearance as separate visibility events if those are the intended meaning of west combustion. Record observer location, calculation parameters, engine version and calculated timestamps. Validate a dedicated Venus implementation before generating history.
3. Retain 15–27 October as unresolved reference evidence until its producing method is demonstrated. Do not tune a threshold to match it or replace it silently.
4. After review, amend method provenance explicitly and run the chosen generator across history and future dates. This audit itself does not update the database's `method_unverified` label.
5. Preserve every calendar day. Store any plus/minus one or two day market-observation window separately; decide whether that means calendar days or trading sessions at that layer.

## Reproduction

From `kaaladristi/App/backend`:

```powershell
python scripts/audit_venus_calculation.py tests/fixtures/venus_october_2026.json
```

The diagnostic extracts and executes only the actual pure predicate from `generate_ephemeris.py`, avoiding its imports, directory creation and generation side effects. The companion JSON records the source hash, predicate, all daily comparisons and mismatches. It uses supplied longitudes and does not generate or adjust them.
