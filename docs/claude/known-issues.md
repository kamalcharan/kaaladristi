# Known Issues — Full Debugging Notes

> Moved verbatim from CLAUDE.md.

### ⚠ NEEDS REVIEW — VaNi Correlation Cache + Delete Flow (CorrelationPage)
- Detected: 2026-06-02
- Status: **Broken — needs fresh session to debug end-to-end**
- Problem 1: Admin "clear cache" button calls `DELETE /api/vani/correlation-insight/{a}/{b}/{shape}` on backend + `queryClient.removeQueries` + resets `refreshCount`/`vaniTriggered`. But subsequent "Ask VaNi" still returns cached response in ~1s without LLM call — backend logs confirm no LLM hit.
- Problem 2: After delete, UI was auto-triggering VaNi (should be manual-only). Fixed by resetting `vaniTriggered=false` on delete. But cache problem persists.
- Suspected root cause: React Query observer not destroyed cleanly by `removeQueries` when query is still mounted; or backend `_corr_insight_cache` dict not being evicted correctly (shape mismatch in URL encoding?).

### How VaNi Correlation Caching Works (current design)
- **Backend**: `_corr_insight_cache: dict` — module-level Python dict, keyed by `corr_insight:{sorted_a}:{sorted_b}:{shape}`. Permanent until server restart. No TTL.
- **Backend DELETE**: `DELETE /api/vani/correlation-insight/{item_a}/{item_b}/{shape}` — sorts pair alphabetically, builds same key, calls `_corr_insight_cache.pop(key, None)`. Returns `{'deleted': 1}` if found.
- **Frontend cache**: React Query with key `['corr-insight', itemA, itemB, result?.shape, refreshCount]`, `staleTime: Infinity`. Only fires when `vaniTriggered && !!result`.
- **Force refresh**: `refreshCount` incremented in query key — backend receives `force_refresh: true` in body when `refreshCount > 0`, skips cache lookup. (NOT currently used in delete flow.)
- **Manual-only trigger**: `vaniTriggered` state — starts `false`, set `true` only on "Ask VaNi" button click. Delete resets it to `false`.
- **Review needed**: Trace full delete → re-ask cycle with backend logs open. Confirm shape value in DELETE URL matches shape in POST cache key. Confirm `removeQueries` with partial key `['corr-insight', itemA, itemB, result?.shape]` actually removes all variants.

### Volume Scale Discontinuity (km_index_eod)
- Detected: 2026-04-13
- Affected: index_id = 1 (NIFTY 50), possibly others
- Symptom: Pre-2026-03-25 volume ~500K/day vs post-2026-03-25 ~400M/day
- Impact: RVOL near-zero for pre-discontinuity dates causing false LOW_VOLUME and VACUUM_DOWN signals
- Workaround: RVOL < 0.1 AND TVOL > 0.5 guard in compute_flow_intelligence()
- Root cause: Unknown — possibly data source change or index reconstitution. Needs investigation.
- Status: Guard applied in migration 031. Root cause investigation pending.

---
