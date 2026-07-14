# Industry Rotation — Spec for Implementation Review

**Status:** Draft for owner review · 2026-07-14
**Scope:** The `/industry-transition` feature ("Industry Rotation") — its ranking
basis, its relationship to Sector Rotation, and the relative-strength benchmark
question.
**Decision needed before build.** This doc is a proposal + open questions, not a
committed plan.

---

## 1. What Industry Rotation is today

A stock scanner viewed through the lens of **industry-level relative strength**.
It answers: *"Which stocks sit inside industries whose relative-strength ranking
is improving, and how does each stock look individually?"*

Route/UI: `/industry-transition` → `views/IndustryTransitionView.tsx`
Hook: `hooks/useIndustryRotation.ts` → `useIndustryTransitionStocks()`
Service: `services/industryRotation.ts` → `fetchIndustryTransitionStocks()` (+ `fetchFullIndustryTransition()`)
Pipeline: `compute_all_industry_composites(p_trade_date)` RPC → `km_industry_eod`
(pipeline2 dimension `industry_composites`, daily step 6c)

### Data flow
1. `km_industry_eod` is rebuilt each day per industry (≥5 stocks, deduped via
   `v_equity_eod_deduped`, NSE preferred). It stores **equity-signal aggregates**:
   `avg_magic_rs`, `pct_strong_bull/bear`, `pct_accumulation/distribution`,
   `avg_sniper_inst`, `pct_with_recent_svd/sbd/syd`, `pct_volume_div_up/down`,
   `dominant_flow_type`, `industry_rank`.
2. Frontend pulls 6 recent dates, computes each industry's **percentile**
   (`1 − rank/total`) and its **percentile change vs 5 days ago** → classifies
   **Rotating In** (Δ ≥ +10), **Rotating Out** (Δ ≤ −10), **Leading** (top quartile),
   **Stable**.
3. Individual stocks (`km_equity_eod`) are merged with their industry's
   category/percentile and rendered as cards with per-stock metrics.

### The ranking basis (the crux)
`industry_rank` is produced by exactly **one** line in `compute_all_industry_composites`:

```sql
RANK() OVER (ORDER BY ia.avg_magic_rs DESC NULLS LAST) AS industry_rank
```

**Industries are ranked purely by `avg_magic_rs`** — the mean of each constituent
stock's Magic RS. Every other aggregate column is **descriptive context only**;
none of them influences the rank. The "transition" is the **5-day change** in this
Magic-RS-based rank.

Magic RS itself = 144-bar relative strength of the stock **vs NIFTY 500**,
normalized as % above/below its SMA (see Field Formulas in CLAUDE.md).

---

## 2. The problem

### 2a. The ranking clock disagrees with the house 5D/22D language
5D/22D returns are the platform's decision backbone (Sector Rotation ranks
indices on `ret_5d`/`ret_22d`/`ret_66d`). Industry Rotation instead ranks on a
144-bar relative-strength metric. Measured on live data (2026-07-13, ~160
industries ranked three ways):

| Industry | Magic-RS rank | 5D-ret rank | 22D-ret rank | avg 5D | avg 22D |
|---|---|---|---|---|---|
| Copper | **#1** | **#84** | #1 | +0.2% | +125% |
| Telecom Equipment | **#2** | **#146** | #79 | −1.1% | +5.8% |
| Oil & Gas Refining | #4 | **#155** | #51 | −1.3% | +8.7% |
| Computers Hardware | #8 | #84 | #3 | +0.2% | +27.7% |
| Diversified | #12 | **#3** | #5 | +6.7% | +18.2% |

**Findings:**
- Magic-RS ranking ≈ a **~22-day / structural** view. It tracks 22D returns
  closely but diverges from **5D by 80–150 rank positions**.
- It **systematically lags the 5D clock.** Its "leaders" (Copper, Telecom Equip,
  Oil & Gas) are flat-to-negative over the last 5 days — strong because of
  *sustained* leadership, sometimes already **rolling over** week-to-week.
- A genuine 5-day mover (Diversified, +6.7%) is only mid-pack on Magic RS.

**Consequence:** users who trust 5D/22D and read "rotation" get names that don't
match the momentum they expect — and occasionally names that already ran.

### 2b. UX / mental-model inconsistency
Two features called "rotation," on two different clocks, with no cue why they
disagree:
- **Sector Rotation** → return momentum (5D/22D/66D), fast, indices.
- **Industry Rotation** → Magic-RS structural strength, ~22D-like, slow, industries.

This is a cognitive tax and erodes trust in the numbers.

### 2c. The benchmark question (relative strength is benchmark-relative)
Magic RS today is **vs NIFTY 500** — a **market-relative** ("beats the whole
market?") view. The owner's point: RS could be computed vs a **peer** benchmark
(e.g. a copper stock vs a metals index) — a **peer-relative** ("leader within its
group?") view. These answer different questions:

| Benchmark | Question | Cross-comparable? |
|---|---|---|
| NIFTY 500 (today) | Beats the whole market? | **Yes** — one common ruler |
| Sector/peer index | Leader within its group? | **No** — each group on its own ruler |

**Critical constraint:** cross-industry ranking (the whole point of Industry
Rotation) **requires a common benchmark**. Peer-relative RS measures each industry
against a *different* ruler, so it **cannot** be the basis for ranking industries
against each other — it's apples-to-oranges. Peer-relative RS is a **drill-down**
lens (leaders *within* a sector), not a rotation-ranking basis.

---

## 3. What is / isn't already in place (feasibility)

- ✅ **Return columns exist per equity:** `km_equity_eod.ret_5d`, `ret_22d`,
  `ret_66d`, `d30_pct_chng`, `d365_pct_chng`. So per-industry average returns are
  a cheap add to the composite.
- ✅ **Magic RS compute is fully benchmark-parameterized.**
  `compute_magic_rs_batch(p_table, p_id_col, p_symbol_id, p_benchmark_id,
  p_from_date, p_bench_table, p_bench_id_col)` already supports any benchmark index
  (even on a different table). Computing "copper stock vs NIFTY METAL" is a solved
  computation — no new math.
- ❌ **No peer-benchmark mapping.** `km_equity_symbols.index_names[]` is too sparse
  to derive a stock's sector index (verified: Hindustan Copper → `[]`). A curated
  **industry → sector-index** lookup does not exist.
- ❌ **Single-series storage.** `km_equity_eod.magic_rs` holds exactly one series
  (vs NIFTY 500). A peer RS needs another column or on-demand compute.
- ⚠️ **`avg_magic_rs` is Magic-RS-only** and inherits Magic RS's null gaps
  (~989 equities null magic_rs on a given day → thin averages for young-stock
  industries).

---

## 4. Proposal (recommended direction)

Keep NIFTY-500 Magic RS as the **cross-comparable backbone**; make the ranking
speak the house 5D/22D language; add peer-relative RS only where it's valid.

### 4a. Ranking basis — lead with returns, keep RS as a cross-check
- Add `avg_ret_5d`, `avg_ret_22d` (and optionally `avg_ret_66d`) to
  `km_industry_eod`, computed in `compute_all_industry_composites` (columns already
  on `km_equity_eod`).
- Make the **default rank/sort a return clock** (5D, or a 5D+22D blend) so Industry
  Rotation matches the language used everywhere else.
- Keep **`avg_magic_rs` visible as a column and an optional sort** — the "is this
  structural or just a pop?" cross-check. (Because RS ≈ 22D here, leading with
  returns loses little.)
- Optional: a **ranking-basis toggle** (Momentum 5D/22D · Relative Strength · Blend),
  default Momentum.

### 4b. UX — reconcile the two "rotation" views
- Show **both clocks on the industry/stock cards** (5D, 22D, and Magic RS) so a
  user can see momentum and structural strength side by side.
- Clarify labeling so Industry Rotation and Sector Rotation don't read as the same
  metric on different data (e.g. an explainer line, or rename the RS lens
  "Relative-Strength Leadership").

### 4c. Benchmark — layered, not a swap
- **Market-relative Magic RS (vs NIFTY 500)** stays the backbone for all
  cross-sector ranking (Industry Rotation, Sector Rotation, scanners). This ruler
  must remain common so cross-industry / cross-index ranking stays valid.
- **Peer-relative Magic RS is a selectable lens on BOTH single stocks AND indices**
  (owner decision, 2026-07-14):
  - *Single stock* (Chart / Visual Pulse): default NIFTY 500, optional "vs sector
    index" (e.g. a copper stock vs NIFTY METAL).
  - *Index* (Index Visual Pulse / Sector Rotation detail): default NIFTY 500,
    optional "vs a parent/peer index" (e.g. a sub-sector index vs its broad parent).
  - Both are cheap, on-demand computations — `compute_magic_rs_batch` already
    supports equity-vs-index and index-vs-index (`p_bench_table`/`p_bench_id_col`);
    index Magic RS vs NIFTY 500 is already wired (dimension `index_magic_rs`, 2026-07-14).
- **Build the industry → sector-index mapping table** as the shared enabler. It
  supplies the default peer benchmark for a stock/industry and unlocks a future
  "leaders within each sector" view.

---

## 5. Implementation phases (if approved)

**Phase 1 — Return columns on the industry composite (small, high value)**
- Migration: add `avg_ret_5d`, `avg_ret_22d` (+ `avg_ret_66d`?) to `km_industry_eod`.
- Extend `compute_all_industry_composites` to average `ret_5d`/`ret_22d` per industry.
- Surface them on `IndustryTransitionView` cards + add as sort options.
- *No ranking change yet — purely additive, lets us eyeball both clocks in the UI.*

**Phase 2 — Ranking basis decision**
- Switch `industry_rank` (or add a second rank) to the chosen clock (return / blend),
  and/or add the ranking-basis toggle in the UI + service.
- Re-verify Rotating-In/Out thresholds against the new basis.

**Phase 3 — Peer benchmark enabler (stocks + indices)**
- Curated `industry → sector-index` mapping table (+ seed) → supplies the default
  peer benchmark.
- Benchmark selector on **single-stock views** (Chart / Visual Pulse) **and index
  views** (Index Visual Pulse / Sector Rotation detail); on-demand peer-RS compute
  via `compute_magic_rs_batch` with the mapped/selected benchmark (equity-vs-index
  and index-vs-index both already supported).

**Phase 4 (optional) — Within-sector leaders view**
- Rank stocks *inside* an industry by peer-relative RS (valid because it's a single
  common group).

---

## 6. Open questions for owner review

1. **Should Industry Rotation mean the same as Sector Rotation (one clock),** or
   stay a deliberately different lens that's just labeled clearly?
2. **Ranking basis:** default to 5D, a 5D+22D blend, or a full composite
   (returns + accumulation + sniper)? Or ship the **toggle** and let the user pick?
3. ~~Peer RS scope~~ — **DECIDED (2026-07-14): peer RS on BOTH single stocks and
   indices** (selectable benchmark on stock + index views). Still open: do we also
   want a "leaders within each sector" *ranking* view (Phase 4)?
4. Want a **rank-stability-over-time** study (how jumpy each clock is week-to-week)
   before locking the default?

---

## 7. Reference (touch points)

- **Tables:** `km_industry_eod`, `km_equity_eod` (`ret_5d`/`ret_22d`/`ret_66d`,
  `magic_rs`).
- **RPCs:** `compute_all_industry_composites(date)`,
  `compute_magic_rs_batch(...)` / `compute_all_magic_rs(...)` (benchmark-parameterized).
- **Backend pipeline:** pipeline2 dimension `industry_composites`
  (`pipeline2/handlers.py`, `orchestrator.py` step 6c).
- **Frontend:** `views/IndustryTransitionView.tsx`, `services/industryRotation.ts`,
  `hooks/useIndustryRotation.ts`.
- **Related deferred spec:** `docs/claude/Rsspec.md` (RS-Rotation / RRG scanner),
  `docs/claude/industry-rotation.md` (current technical reference).
