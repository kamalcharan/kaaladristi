# Mercury Vertical Slice — Findings + Dry-Run Cleanup Plan

**Date:** 2026-07-10 · **Mode:** investigation + dry-run only — **no writes executed by this task**
**Data source:** live `kaala_dristi_db` query results supplied manually by owner (MCP connector not connected); code paths verified statically at branch `claude/ready-for-task-xh6bih`.
**Backup on record:** `kaala_dristi_db_main_20260710.dump` (3.4 GB, off-VPS copy confirmed) — still: every write below requires explicit sign-off in a follow-up task.

---

## ⚠ Risk flags — read before any SQL below

1. **Never hard-DELETE from `km_astro_rule_master`.** `km_rule_transits` and `km_rule_patterns` both have `ON DELETE CASCADE` to it (migrations 064:16,51; 132:32) — deleting one master row silently wipes all its windows and pattern studies — while `km_rule_confidence` (062:56) has NO cascade, so the same delete errors halfway. All deactivation below is `UPDATE` of flags only.
2. **Existing early-adopter frameworks may go silently blank.** ~40 users may have non-Mercury overlays (e.g. `astro_group:Panchak`, `astro_group:MajorTransit`) saved in `user_frameworks`. The group overlay path filters `catalog_visible=true` (`astroOverlayService.ts:249-253`), so hiding those rules makes existing overlays render **nothing, with no message** (the known silent-empty gap). This is a product decision, not a bug — but decide it consciously (Variant B below softens it).
3. **Sky Regime (free-tier flagship) is verified SAFE** from all proposed changes — `PlanetRegimeStrip.tsx:80-89` selects by hardcoded `rule_code IN (ALL_CODES)` with no `is_active`/`catalog_visible` filter.
4. **Confidence scoring ignores `is_active`** (`confidence_scoring.py:613-615`) — deactivated rules keep getting nightly-scored. Harmless, but don't be surprised by fresh `last_computed_at` on inactive rules.

---

## 1. Mercury end-to-end status — **PRODUCTION-READY NOW; generator re-run NOT needed**

The live data refutes the worst-case Axis-B fear for Mercury. Evidence:

- **Windows: generated through 2030.** All main Mercury rules have windows to 2030-12 (e.g. `TR-MER-RET` 130 windows → 2030-12-25, `TRN-MER-MAN-TRN` 609 → 2030-12-31, `TR-MER-CMB-E-BEA` 332 → 2030-12-20). The one-shot generators **were** run.
- **Signals: discovery ran through 2030.** `km_rule_signals` rows exist to 2030-12 for the discovery-covered rules (e.g. `TR-MER-CMB-E-BEA` 4,652 rows; `CON-SUN-MER-TRN` 1,548).
- **Confidence: recomputed TODAY.** Every Mercury confidence row has `last_computed_at = 2026-07-10 19:00 IST` — the nightly job is live, exactly as the plumbing report predicted.
- **5 windows active today** across 4 rules (`TR-MER-CMB-E-BEA` ×2, `TR-MER-RET`, `CON-SUN-MER-TRN`, `TRN-MER-MAN-TRN`) — astronomically coherent (retrograde inferior-conjunction cluster) and a strong live demo for Catalog + chart overlay.

### Per-rule verdicts (21 Mercury rules live — 6 more than repo seeds implied)

| Status | Rules | Notes |
|---|---|---|
| ✅ Ready | `TR-MER-RET`, `TRN-MER-MAN-TRN`, `TR-MER-CMB-E-BEA`, `CON-SUN-MER-TRN`, `TRN-MER-RIS-W-BUL`, `TR-JUP-MER-RET-BUL`, `TR-MER-VEN-RET-BUL`, `TR-VEN-MER-ALN-BEA`, `CON-MER-VEN-BEA`, `CON-MER-VEN-CD-BEA`, `CON-VEN-MER-BEA`, `BAY-R02-MAR-MER-SPD`, `BAY-R27-MER-SPD`, `DN-{MON,TUE,WED,THU,FRI}-MER-*` | Windows to 2030, signals populated (where discovery covers the type), confidence fresh today |
| 🔴 Broken-visible | **`CON-NEP-MER-BUL`** | `data_source='unavailable'`, **0 windows, 0 signals, no confidence row — yet `is_active=true AND catalog_visible=true`**: it is a live silent-empty overlay in Catalog right now. Deactivate + hide (W2). |
| 🟡 Dead-but-hidden | `VOL-MOO-MER-D9-VOL` (0 windows), `SP-ARI-JUP-MER-BEA` (5 windows, all expired 2024) | Already `catalog_visible=false`; deactivate for hygiene (W2). |
| 🟠 Data-quality caution | `DN-TUE-MER-BEA` **100.00%** (n=113), `DN-MON-MER-BUL` **0.00%** (n=109), `DN-WED-MER-BUL` **0.00%** (n=108), `TRN-MER-RIS-W-BUL` **0.00%** (n=59) | Degenerate 0%/100% confidence at n>50 is almost certainly a hypothesis/matched-derivation artifact, not a real edge. In Catalog these render as "Strong 100%" (overclaiming) and "0%" (looks broken). **Recommend hiding the five `DN-*-MER-*` day-rules + reviewing `TRN-MER-RIS-W-BUL`'s hypothesis before launch** (W4, optional). |

Notes: `scored_windows=0` on `TR-MER-RET`, `TRN-MER-MAN-TRN`, `CON-SUN-MER-TRN`, `DN-*-VOL`, `BAY-*-SPD` is **by design** — these are observational/turning/volatility rules with no directional hypothesis; the chart tooltip already handles them ("observational — no directional claim"). `signal_rows=0` on `TR-MER-RET`/`TRN-MER-MAN-TRN`/`TRN-MER-RIS-W-BUL` matches the discovery skip-list (`rule_discovery.py:175-195`) — their windows come from the generator, which is fine for every user surface (overlays/Catalog/brief cards read transits, not signals).

**Verdict: the Mercury slice is provably clean end-to-end today** — rule definitions ✓, windows ✓ (to 2030), signals ✓ (where applicable), confidence ✓ (fresh today), Catalog visibility ✓ (except the one broken-visible rule), chart overlay data ✓ (5 bands renderable today). No generator re-run required. The only pre-launch fixes are the three flag UPDATEs in W2 and the owner call on the degenerate-confidence day rules.

---

## 2. catalog_visible cleanup — dry-run result

**Mercury-only variant: 29 rules would be hidden** (live count from preview query).

Live-data surprises the static analysis missed (flagged per the task's ask):

1. **The live DB is much richer than the repo**: 20 Venus rules exist (vs 2 in repo seeds) — `REL-VEN-*` (6), `TR-VEN-CMB-W-BUL` (the "Venus combust" rule the TradingChart owner-note referenced), `TR-VEN-SHA-BEA`, `TR-SAT-VEN-RET-BEA`, `VOL-SAT-VEN-RET-BEA`, `TRN-VEN-RIS-E/W-BUL` — and they carry **`MajorTransit` tags live**, so they are currently VISIBLE. The plumbing report's "Venus is hidden by migration 133" inference was **wrong on live data** (live tags diverge from repo seeds). Venus is closer to launch-ready than reported: 1,527 windows, 587 scored.
2. **The 6 `MAR-GAN-*` (Gandanta) rules are visible with ZERO windows ever** (`last_window=null`) — **the gandanta generator was never run.** These are 6 live silent-empty overlays today. They get hidden by W1 regardless of variant — flag them for either a generator run or permanent retirement post-launch.
3. **`REL-VEN-MAR-SHR-BUL`** — visible, last window expired 2026-01-30, 0 live windows: stale-visible, hide.
4. **Genuinely fresh non-Mercury rules that W1 will hide** (the "worth a second look" set): `TRN-MAR-MAN-TRN` (31 live windows), `TRN-JUP-MAN-TRN` (13), `TRN-SAT-MAN-TRN` (7), `TR-SAT-RET` (5), `TR-JUP-RET` (4), `BAY-R06-MAR-1635` (31), most Venus rules. These are healthy — hiding them is purely the launch-scope decision, not data hygiene. **Sky Regime keeps using them either way** (hardcoded codes), so hiding costs only Catalog/browse discoverability + any saved user group-overlays (risk flag 2).

**Two variants for sign-off** (pick one in the follow-up task):
- **Variant A — strict Mercury-only** (the task's ask): hide all 29. Cleanest story: one planet, provably correct.
- **Variant B — Mercury + healthy MajorTransit almanac** (`TRN-{MAR,JUP,SAT}-MAN-TRN`, `TR-{SAT,JUP,MAR}-RET`): hide 23, keep the 6 almanac rules visible so existing MajorTransit group overlays don't blank and Catalog shows the sky's big regimes. My recommendation is **B** — it preserves early-adopter frameworks at near-zero risk (these 6 are exactly the freshest non-Mercury rows in the preview).

---

## 3. Blank/orphan cleanup — dry-run result

| Category | Live finding | Recommendation |
|---|---|---|
| Orphaned `km_rule_signals` / `km_rule_transits` rows (rule deleted/missing) | **Counts not yet confirmed** — the 3a sample query errored (`s.signal_type` doesn't exist; use `s.date`) and the batch output for the counts didn't come through. Corrected queries in §5-V1. | If counts come back 0: nothing to do. If >0: DELETE is safe **for true orphans only** (no cascades emanate from these child tables) — but run V1 first. |
| 56,277 of 65,124 signals unscored (`actual_market_return IS NULL`) | **Mostly explainable, not garbage**: signals span 1990→2030 — future-dated rows *cannot* have returns yet, and pre-history rows predate NIFTY close data. | **Do NOT delete.** These are the discovery pre-computation working as designed. Exclusion-in-queries is already the de-facto behavior (scoring/UIs filter by date). No action. |
| `km_rule_patterns` — 33,318 rows | Read by admin PatternsTab/PatternStudyButton + pattern scripts; grants fixed in migration 137. | **Keep.** Admin-only surface, actively used, no user-facing exposure. Exclude-not-delete as a principle; no action needed. |
| Broken-visible rules (0 windows but visible) | `CON-NEP-MER-BUL` + 6× `MAR-GAN-*` | Flag-hide via W1/W2 (UPDATE, not DELETE). |

**General principle adopted (per consumer trace):** `km_rule_signals` is read by 4 frontend files + the VaNi brief; `km_rule_transits` by 7 frontend files including free-tier Sky Regime. Nothing gets DELETEd on a hunch; flags and date-filters do the work. The only DELETE candidate is the true-orphan set, gated on V1 counts.

---

## 4. Single-active-rule decision — **Mercury CONFIRMED, with one scope challenge**

From the cross-group comparison (query 1f):

| Group | Rules | Windows | Active now | Future | Scored |
|---|---|---|---|---|---|
| **Mercury** | **21** | **4,672** | **5** | **503** | **770** |
| Venus | 20 | 1,527 | 1 | 164 | 587 |
| Bayer (Venus-pair) | 2 | 12,989¹ | 1 | 1,405¹ | 11 |
| Mars | 10 | 608 | 1 | 65 | 139 |
| Jupiter | 2 | 102 | 1 | 16 | 31 |
| Saturn | 5 | 84 | 1 | 11 | 3 |

¹ `BAY-R14-VEN-LON` is a longitude rule emitting thousands of near-daily micro-windows — volume ≠ quality; its 11 scored windows tell the real story.

**Mercury is unambiguously the most production-ready**: most rules, deepest scored history (770), most active-today windows (5), full future coverage, fresh confidence. Venus is the surprise runner-up (richer live than the repo suggested) but carries 6 REL-* relationship rules of unverified provenance — right choice for slice #2, not #1. Saturn, despite the plumbing report's "covered" label, is thin in practice (84 windows, 3 scored).

**The challenge, stated plainly:** the task asked for "Mercury `is_active=true`, everything else in-scope `is_active=false`". Verified consequences of mass-deactivation: it also hides rules from Catalog (double gate with `catalog_visible`), removes non-Mercury rules from the VaNi brief's signal-count line and the Astro Market-Book endpoints (`pipeline2_api.py:1012,1152,1252,1444` all filter `is_active`), and stops Discovery refreshing them. Sky Regime survives (verified). That is all *acceptable* for a Mercury-only launch — but `is_active=false` buys almost nothing that `catalog_visible=false` doesn't already deliver user-facing, while destroying the (live, working) background scoring continuity for the other curated groups you'll want for slice #2. **Recommendation: scope launch visibility with `catalog_visible` (W1), deactivate only provably-broken rules (W2), and skip the blanket `is_active=false`** — the blanket statement is included below as W3 anyway, clearly marked, in case you want the harder line.

---

## 5. Exact SQL — FOR REVIEW ONLY, none executed. Run in this order.

### V1 — Pre-write verification (read-only; run first, paste results before sign-off)

```sql
-- Orphan counts (corrected: no signal_type column)
SELECT COUNT(*) AS orphan_signals FROM km_rule_signals s
LEFT JOIN km_astro_rule_master r ON r.id = s.rule_id
WHERE r.id IS NULL OR r.is_deleted;

SELECT COUNT(*) AS orphan_transits FROM km_rule_transits t
LEFT JOIN km_astro_rule_master r ON r.id = t.rule_id
WHERE r.id IS NULL OR r.is_deleted;

-- Row counts the writes below MUST match (abort if they differ)
SELECT COUNT(*) AS w1_expect_29 FROM km_astro_rule_master
WHERE NOT is_deleted AND catalog_visible = true AND NOT (tags && ARRAY['Mercury']);

SELECT COUNT(*) AS w2_expect_3 FROM km_astro_rule_master
WHERE rule_code IN ('CON-NEP-MER-BUL','VOL-MOO-MER-D9-VOL','SP-ARI-JUP-MER-BEA');
```

### W1 — Hide non-Mercury from Catalog (Variant A; expect **29 rows**)

```sql
BEGIN;
UPDATE km_astro_rule_master
SET catalog_visible = false, updated_at = now()
WHERE NOT is_deleted
  AND catalog_visible = true
  AND NOT (tags && ARRAY['Mercury']);
-- verify before COMMIT: should return 29
-- SELECT COUNT(*) FROM km_astro_rule_master WHERE ...same WHERE...; → must be 0 after UPDATE
COMMIT;
```

**Variant B instead** (keep the 6 healthy almanac rules visible; expect **23 rows**):

```sql
BEGIN;
UPDATE km_astro_rule_master
SET catalog_visible = false, updated_at = now()
WHERE NOT is_deleted
  AND catalog_visible = true
  AND NOT (tags && ARRAY['Mercury'])
  AND rule_code NOT IN ('TRN-MAR-MAN-TRN','TRN-JUP-MAN-TRN','TRN-SAT-MAN-TRN',
                        'TR-MAR-RET','TR-JUP-RET','TR-SAT-RET');
COMMIT;
```

### W2 — Deactivate + hide the 3 broken/dead Mercury rules (expect **3 rows**)

```sql
BEGIN;
UPDATE km_astro_rule_master
SET is_active = false, catalog_visible = false, updated_at = now()
WHERE rule_code IN ('CON-NEP-MER-BUL','VOL-MOO-MER-D9-VOL','SP-ARI-JUP-MER-BEA');
COMMIT;
```

### W3 — OPTIONAL blanket deactivation (the literal task ask — recommended AGAINST, see §4)

```sql
-- Only if the hard Mercury-only line is chosen. Sky Regime unaffected (verified);
-- kills VaNi-brief signal counts + Market-Book coverage for non-Mercury groups.
BEGIN;
UPDATE km_astro_rule_master
SET is_active = false, updated_at = now()
WHERE NOT is_deleted AND is_active = true AND NOT (tags && ARRAY['Mercury']);
-- Mercury stays active — no complementary UPDATE needed (all 21 already is_active=true;
-- W2 then re-deactivates its 3 broken rows, so run W3 BEFORE W2 if chosen).
COMMIT;
```

### W4 — OPTIONAL: hide the degenerate-confidence day rules pending hypothesis review (expect **5 rows**)

```sql
BEGIN;
UPDATE km_astro_rule_master
SET catalog_visible = false, updated_at = now()
WHERE rule_code IN ('DN-MON-MER-BUL','DN-TUE-MER-BEA','DN-WED-MER-BUL',
                    'DN-THU-MER-VOL','DN-FRI-MER-VOL');
COMMIT;
```

### W5 — CONDITIONAL: true-orphan deletion (ONLY if V1 counts > 0, and only after eyeballing samples)

```sql
-- No cascades emanate from these tables; still, run inside a transaction and check counts.
BEGIN;
DELETE FROM km_rule_signals s
USING (SELECT s2.id FROM km_rule_signals s2
       LEFT JOIN km_astro_rule_master r ON r.id = s2.rule_id
       WHERE r.id IS NULL OR r.is_deleted) dead
WHERE s.id = dead.id;
DELETE FROM km_rule_transits t
USING (SELECT t2.id FROM km_rule_transits t2
       LEFT JOIN km_astro_rule_master r ON r.id = t2.rule_id
       WHERE r.id IS NULL OR r.is_deleted) dead
WHERE t.id = dead.id;
COMMIT;
```

---

## 6. Ordered execution plan (follow-up task, after sign-off)

| # | Action | Verify before proceeding |
|---|---|---|
| 1 | Run **V1** | Orphan counts known; W1 count = 29 (or 23 for Variant B); W2 count = 3. Any mismatch → stop, re-investigate. |
| 2 | Decide **Variant A vs B** (owner) + whether **W3/W4** are in | One-line sign-off each. |
| 3 | Run **W1** (+ W3 first if chosen) | In app as a **regular user**: Catalog → Astro Rules shows only Mercury (± the 6 almanac); Sky Regime strip still renders all planets. |
| 4 | Run **W2** (+ W4 if chosen) | Catalog no longer lists `CON-NEP-MER-BUL`; adding any remaining Mercury overlay renders bands on `/chart` (5 windows active today — instant visual check). |
| 5 | Run **W5** only if V1 found orphans | Re-run V1 → both counts 0; spot-check Rules pages + Sky Regime + a chart overlay still render. |
| 6 | Post-cleanup snapshot | Re-run the §1 status queries; save output next to this file as the "launch baseline" for slice #2 (Venus is the data-backed next candidate). |

**What this plan deliberately does NOT touch:** the ~180+ out-of-scope rules' data (windows/signals/patterns stay in place — flags only), `km_rule_patterns`, the unscored-signals set, anything in `km_astro_calendar`/`km_astro_daily_signal` (Axis A is a separate fix), and any DELETE against `km_astro_rule_master` (cascade risk, see flags).
