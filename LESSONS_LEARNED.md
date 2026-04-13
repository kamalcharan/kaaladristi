# Lessons Learned

## Volume Scale Discontinuity (2026-04-13)

Always verify RVOL and TVOL consistency before trusting flow signals. When they diverge significantly (RVOL near-zero, TVOL normal) suspect a volume scale discontinuity in source data.

- **RVOL** uses a 50-day average — long enough to span a data source change boundary
- **TVOL** uses a 20-day average — short enough to stay within one scale period
- When RVOL < 0.1 and TVOL > 0.5 on the same row, the RVOL is unreliable
- Symptoms: false `LOW_VOLUME` flow classifications, false `VACUUM_DOWN` flags
- Guard added in migration 031: NULL out RVOL-dependent signals when scale mismatch detected
