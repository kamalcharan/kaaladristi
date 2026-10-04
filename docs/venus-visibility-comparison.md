# Venus: October 2026 comparison

Calculated locally on 4 October 2026. Database and UI were not changed.

| Method / source | Start boundary | End boundary | Meaning / status |
| --- | --- | --- | --- |
| Owner reference | 15 October | 27 October | Recorded reference; producing method has not been established |
| Existing Python angular rule | 18 October | 30 October | Inclusive daily samples with Sun–Venus longitude separation ≤10°; matches all 52 supplied samples |
| Visibility model, standard observer | 12 October, 18:16 IST | 30 October, 05:57 IST | Calculated last evening visibility / first morning visibility at Ujjain; exploratory |
| Visibility model, existing Mercury parameter set | 14 October, 18:00 IST | 28 October, 06:10 IST | Same Venus calculation with Mercury's observer/atmosphere parameters; sensitivity comparison only, not validated for Venus |

The visibility rows describe boundary events: last evening visibility and first morning visibility. They are not inclusive whole-day combustion flags. Displayed minutes are model output, not observed precision. Weekends and holidays were not excluded.

The Mercury-parameter case falls one calendar day before the reference start and one day after the reference end. This is proximity, not proof that it is the reference's generating method. No parameters were fitted to the Venus reference and no manual date overrides were applied.

## Reproducibility

- Engine: Swiss Ephemeris 2.10.03, Python package pyswisseph 2.10.3.2.
- Ephemeris: explicitly selected Moshier; `FLG_MOSEPH | HELFLAG_HIGH_PRECISION` (260).
- Location: Ujjain, longitude 75.7885°, latitude 23.1793°, altitude 494 m. This reuses the Mercury project's location as a comparison assumption, not an established Venus reference location.
- Search begins 1 September 2026; event types 2 (last evening visibility) and 1 (first morning visibility). Results checked to lie in September–November and in chronological order.
- Standard case atmosphere: 1013.25 hPa, 15°C, 50% relative humidity, extinction coefficient 0.25; observer age 36, Snellen ratio 1.
- Mercury-parameter case atmosphere: 1013.25 hPa, 25°C, 40% relative humidity, extinction coefficient 0.24; observer age 36, Snellen ratio 3.25.
- Timezone: IST / UTC+05:30. No market-session adjustment.

See `venus-october-2026-visibility-comparison.json` for raw results and `kaaladristi/App/backend/scripts/compare_venus_visibility.py` for the read-only diagnostic. Run with a Python environment containing pyswisseph. The dependency was installed only into a workspace temporary folder; production dependencies were not changed.

Event definitions and parameter meanings follow the [Swiss Ephemeris programming reference](https://www.astro.com/swisseph-download/doc/swephprg.2.10.htm).

## Decision

Keep angular combustion and visibility boundaries as distinct event identities. Do not replace the verified angular window with a selected visibility model solely because its dates are closer to a reference. Validate the intended location/visibility convention and multiple Venus periods before selecting a production model. Keep the ±1–2-day market observation window separate from calculation uncertainty and astronomical event timestamps.
