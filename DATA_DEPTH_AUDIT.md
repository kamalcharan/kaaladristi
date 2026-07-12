# Data Depth Audit — NSE + BSE, full history (2026-07-12)

**Status:** 📋 FOR REVIEW (owner). Read-only audit run via the `kaala-postgres` MCP
connector during the BSE-delivery backfill sprint. No data changed. Purpose: answer
"do we have all 26 years, and where are the gaps — raw / delivery / computations,
NSE + BSE."

**One-line finding:** raw **prices** go back ~26 years and are complete for both
exchanges, but the **enriched signals** the scanners/analytics actually use
(delivery, and the `ema_20` indicator) are **shallow — only ~1.5–2 years deep**.
So the platform's *usable* history is recent, not 26 years.

---

## 1. Raw prices (OHLCV) — ✅ complete, no year gaps

| Exchange | Span | Trading days / year |
|---|---|---|
| NSE | **1996 → 2026** | ~243–262 every year present |
| BSE | **2000 → 2026** | ~258–262 every year present |

Row counts grow over time with the listed universe (expected). No missing or broken
years on either exchange. (Early-year NSE row counts are small — ~12–17k/yr in
1996–2001 — because few symbols are mapped that far back, not a date gap.)

## 2. Indicators — mostly deep, **one specific gap: `ema_20`**

Spot-checked NSE, June 2020 (13,508 rows):

| Column | Coverage 2020 | Verdict |
|---|---|---|
| `atr_14`, `rsi_14`, `sniper_inst` | 100% | deep ✅ |
| `sma_150`, `rss_value` | ~99% | deep ✅ |
| `flow_type`, `accum_distrib` | ~95–96% | deep ✅ |
| `magic_rs` | ~98% from **2006**→ (needs 144-bar warm-up) | deep ✅ |
| **`ema_20`** | **0%** (null) | 🔴 **GAP — only ~2025 onward** |

`ema_20` is null for *every* row before ~2025, on **both** exchanges — while its
sibling indicators are populated historically. It was almost certainly added as a
column later and only computed forward. **This matters:** the scanners require
`ema_20` (`buildScanStock` drops any row where `ema_20 IS NULL`), so this single
column silently caps how far back the scanners can ever look, independent of delivery.

## 3. Delivery (`delivery_pct` / `delivery_qty`) — shallow for both

| Exchange | Delivery exists for | Pre-that |
|---|---|---|
| **NSE** | ~**mid-2025 → 2026** (~1.5 yr) | gap |
| **BSE** | was **100% absent**; backfill (2026-07-12) is adding **2024 → 2026** | gap |

Even NSE — assumed to have deep delivery — only has ~1.5 years.

## 4. Delivery-derived (`delivery_surge_x`, delivery part of `score_5d/22d`)

- **NSE:** present 2025–2026 (computed where delivery exists).
- **BSE:** currently **0 in every year** — delivery only just landed; the
  rolling-metrics recompute must run over 2024–2026 for surge/score to populate
  (in progress at time of audit).

### BSE per-year coverage (raw counts, at audit time — backfill in progress)

```
yr    rows     deliv     ema20    magic_rs  surge   (avg_amt22 & score5 are non-null
2000  129,401  0         0        0         0        but = 0 pre-delivery, i.e. not
2006  321,397  0         0        261,323   0        meaningful — delivery-derived)
2015  476,226  0         0        464,050   0
2020  530,913  0         0        519,410   0
2023  600,274  0         0        581,449   0
2024  667,965  277,536   0        632,429   0    ← BSE delivery backfill starts
2025  1,127,488 1,007,097 846,625 848,276   0    ← ema_20 starts ~2025
2026  553,041  523,474   548,359  509,197   0    ← surge still 0 until recompute
```

---

## Implication for the "26-year BSE delivery backfill" decision

**A full 26-year BSE delivery backfill is low-value right now — recommend holding off.**

1. **NSE delivery itself only goes back ~1.5 years**, so deep BSE delivery would have
   no NSE counterpart for cross-exchange comparison.
2. **`ema_20` (scanner-required) only goes back to ~2025**, so pre-2025 rows can't
   drive the scanners regardless of delivery.
3. The **2-year BSE delivery backfill (in progress) is well-matched** to the actual
   depth of everything else, and brings BSE to parity with NSE — the real goal.

**For launch:** finish the 2-year BSE delivery + rolling-metrics recompute. That puts
BSE at parity with NSE across the ~2-year enriched window — the honest ceiling of the
platform's current depth.

**"Deep history" is a separate, larger initiative** (post-launch): it requires three
backfills done to the *same* depth together — `ema_20` (both exchanges), NSE delivery,
and BSE delivery — plus a rolling-metrics recompute over the whole range. Backfilling
BSE delivery alone to 26 years does not unlock deep analytics.

## Open questions for the owner

- Confirm the intended **enriched-history depth** for the product (2 yr is current; 5 yr?
  full?). That decision drives whether the `ema_20` + NSE-delivery + BSE-delivery deep
  backfill is worth scheduling post-launch.
- `ema_20` deep-backfill: is it wanted at all, or is 2-year enough for the product's
  analytics? (Cheap to compute historically — it's a simple EMA — if the depth is wanted.)

---

*Method note: per-year `count(col)` coverage over `km_equity_eod` joined to
`km_equity_symbols` (exchange filter), via the read-only MCP connector. Full
cross-exchange single queries time out at 30s under the concurrent backfill load, so
figures were gathered per-exchange / per-narrow-window; all counts are exact, not
sampled.*
