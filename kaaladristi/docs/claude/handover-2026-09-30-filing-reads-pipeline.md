# Handover — 2026-09-30 · filing reads on screen, Qwen second opinion, Monday repair, the LLM box

Branch `claude/wizardly-shannon-94im9e`, fast-forwarded to `main` at `27595dd`.
Eight commits over 29–30 Sep. Everything marked MEASURED was read from the
live DB; everything marked UNVERIFIED was not.

The owner's standing instruction for this session, in their words: *"give in
simple sentences — tell me how to solve"*. Short messages, no if/but chains.

---

## 1. STATE — what is live right now

| | status |
|---|---|
| Migration 233 (`km_filing_read_checks`) | **applied** — the checks table holds rows (MEASURED 29 Sep 13:40 IST) |
| Backend at `11da1bf` (checks + Read column) | **deployed** — checks ran on the VPS |
| Frontend at `11da1bf` | **built** — the owner used the Pipeline Dashboard panel and "Queue Qwen" |
| Backend + frontend at `27595dd` (auto-resume backoff) | **UNVERIFIED** — owner was told to deploy after 19:30 IST on 29 Sep. Check `git -C /opt/vikuna/apps/kaaladristi/kaaladristi log -1` on the VPS |
| Qwen checks queue | 5 done, 5 failed (404s), ~851 pending, 1 running at 13:40 IST 29 Sep — then the server died again |
| 28 Sep bar | **repaired** — scan_results 2026-09-28, S2 919, supertrend 7,561, bm_ratio 7,553 (MEASURED) |
| 29 Sep daily run (job 4760) | `partial`, 34 steps, **zero critical integrity findings** for run_date 2026-09-29 (MEASURED). Which step was partial is not recorded in `km_jobs`; read `km_dimension_watermarks` for 2026-09-29 |
| Leadership snapshot for 29 Sep | published **today 14:38 IST by a custom-index Calculate click**, not by the nightly run (the partial gate held) |
| The LLM VPS (srv1096269, 72.60.222.136) | **the open problem** — see §4 |

---

## 2. What shipped, in order

### a. Pipeline — three things that kept the banner red (`63ac68f`)
`check_scanner_contract` false positive on Standouts (`routing()` now marks a
`km_scan_results` reader without `.eq('preset_id', …)` as `'derived'`);
`_claim_job` orders `created_at, id` so a cascade runs in DAILY_STEPS order;
`lease.KEEPALIVES` on worker + scheduler connections so a recreated container's
zombie lease dies in ~1 min. Tests: `test_scan_contract_routing.py`,
`test_worker_claim_order.py`. CLAUDE.md section *"Three things that kept the
pipeline banner red"*.

### b. Filing reader time budget (`80833cb`)
`FILING_READ_MAX_SECONDS` (900) caps one ingest pass by wall clock; the VPS
`.env` also got `FILING_READ_MAX_PER_PASS=25`. The reader runs INSIDE the
single-threaded pipeline worker, and a 300-doc pass on Qwen held every job
behind it for hours. `backfill_filing_reads.py` passes `max_seconds=0` on
purpose.

### c. The 28 Sep repair (no code — a procedure worth keeping)
The 21:30 sweep on 28 Sep ran the cascade in scrambled order on the OLD code:
`stage_classification` at 00:47 before `nse_equity_indicators` at 01:19, so
every row read `stage = UNKNOWN`, `supertrend`/`big_money` failed at 0%, and
`scan_refresh` ran FIRST so the matview stayed on 25 Sep. The repair was ONE
unforced fix on `nse_equity_indicators` for 2026-09-28: it cascades 21
dependents in order and took 10:57 → 11:54 IST. **Do not queue three separate
fixes for a bar like this** — the stage carry needs the whole chain.

### d. Filing reads on screen + the admin's second opinion (`11da1bf`, migration 233)
Owner: *"system will run for qwen … for selected options, we will run haiku …
and then compare."*

- `km_filing_read_checks` + `v_filing_read_agreement`. One second opinion per
  backend per event; the view labels sides by MODEL, not by table.
- ⚠ **883 of the 960 primary verdicts are Haiku's**, not 145 as first said —
  the backfill kept running on Anthropic before the reader moved local. So the
  free comparison is a Qwen check on each of those 883.
- `lib/filing_checks.py`: request (paid capped at 25/click, other-backend only,
  done rows never re-run), one runner **thread in the API process** (never the
  pipeline worker), paid claimed before local, resumes pending rows at API
  start. `summary()` for the panel; `restart_read()` for owner's point 4.
- Endpoints (admin): `POST /api/admin/filing-checks`, `/queue-local`, `/run`,
  `GET /summary`, `POST /api/admin/filing-reads/{id}/restart`.
- Filings page: **Read** column (verdict, or Planned / Reading / Failed /
  Unreadable / Not read); expand → headline, reasoning, quoted evidence, second
  opinion side by side with agree/disagree; admin checkbox + "Check with Haiku
  (paid) / Qwen (free)" bar; Restart read on failed rows.
- Pipeline Dashboard: **Qwen vs Haiku** panel — queue, spend, agreement per
  event type with denominators, "Queue Qwen on N Haiku reads", "Run pending".
- `scripts/compare_filing_readers.py` DELETED — it compared the wrong way round.
- Tests `test_filing_checks.py` (15 with e. below), `KD_TEST_DSN` against a
  throwaway cluster (`/tmp/kdpg`, port 5499, `su postgres -c pg_ctl …`).

### e. Auto-resume when Qwen dies (`27595dd`)
Owner: *"it will run 3-4 and then stop, needs physical run again"*. Five model
errors in a row → those rows go back to pending with the attempt NOT counted,
the runner sleeps `FILING_CHECK_BACKOFF_SEC` (300) and continues, up to
`FILING_CHECK_BACKOFF_ROUNDS` (24 ≈ 2 h). A document failure (no stored text)
never counts toward the streak. The panel shows the retry time while waiting.

---

## 3. What the owner asked for and is NOT built

From the 29 Sep discussion of the Filing Intelligence UI (four points):

| # | ask | status |
|---|---|---|
| 4 | read status per filing: planned / running / failed (Restart) / outcome | **done** (d) |
| 2 | extend the Filings page with the read | **done** (d) |
| — | Qwen vs Haiku comparison, admin only | **done** (d, e) |
| 1 | Workspace block "Filing Intelligence": last 3–4 days of notable reads, split positive/negative, with stage + RS beside each; one line per bookmarked stock in "Your stocks today" | **not built** |
| 3 | Screener: **Sparks** / **Negative Sparks** in the Filing Intelligence category (notable positive/negative read in the last 5 sessions), Standouts' columns + the read headline, derived on read | **not built** |

Two open choices the owner did not answer: block vs separate page on the
Workspace (recommendation: a block), and the name (recommendation: Filing
Intelligence). The next session should confirm both in one line, then build
1 → 3. Both reuse `services/filingReads.ts`, `constants/filingReads.ts` and the
`ReadCell`/`ReadDetail` components in `components/domain/Filings/ReadVerdict.tsx`.

---

## 4. The LLM VPS is the real blocker — MEASURED 29 Sep

`vikuna-llm` (llama.cpp, Qwen3-4B Q4_K_M, `--ctx-size 16384 --parallel 1
--threads 3`) on srv1096269 was **OOM-killed five times on 29 Sep** (04:20,
04:51, 06:51, 08:03, 08:44 UTC — `dmesg -T | grep -iE "killed process|out of
memory"`), each time at ~6.7 GB RSS. The box has 7,940 MB, **0 swap**, and also
runs n8n + worker, n8n-postgres, redis, searxng, browserless (headless Chrome)
and traefik. Every 404/502 the reader and the checks saw maps to one of those
kills (08:03 UTC = 13:33 IST, the checks' three 404s).

Speed on that CPU: ~17 tok/s prompt, ~3.5 tok/s generation → **~200 s per
document**. 883 checks ≈ 2 days of Qwen time. The nightly filing reader shares
the same single slot.

The owner was given two steps and had done neither when the session ended:

1. Swap, now, no restart:
   `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`
   then `echo '/swapfile none swap sw 0 0' >> /etc/fstab`.
2. `docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}'` to see who
   else holds the 8 GB; browserless is the likely 0.5–1 GB to reclaim.

Other options not yet raised with the owner: `--cache-type-k q8_0
--cache-type-v q8_0` with flash attention halves the 2.4 GB KV cache (flag
syntax depends on the llama.cpp build — `-fa on` on recent ones); or
`--ctx-size 8192` (documents average 3.7k tokens, max ~15k, so some would be
trimmed to whole pages — the reader records `pages_read < page_count`).

⚠ `vikuna-llm` **also** appears in `docker ps` on the MAIN VPS (srv1528480,
"Up 3 weeks"). That is a leftover container, not the one serving
`llm.dristiq.com`. The owner ran diagnostics on the wrong box twice; say which
host every command is for.

---

## 5. Other open items carried forward

- **Rotate the production `JWT_SECRET`** — the value was pasted into the chat
  on 29 Sep. Rotate DB `app.jwt_secret`, PostgREST `PGRST_JWT_SECRET`, the app
  `.env` `JWT_SECRET` AND the dev machine's `.env` in one step (the localhost
  logout loop on 28–29 Sep was exactly a dev `.env` holding an old secret). The
  LLM API key `vk-llm-…` is also in the transcript. Quiet day, after 19:30.
- **Sector Rotation → Longer-Term Leadership feels slow** (owner, 30 Sep). The
  read path is two small queries on `km_sector_leadership_snapshots` — no
  calculation, no LLM. The companion's reading IS a Qwen call (~200 s now).
  The owner was asked for the Network-tab time of the `/api/vani/ask` request
  carrying `sector.leadership.context`; no number yet. Under 1 s → the wait is
  the companion. Several seconds → dig into the API.
- **The nightly run was `partial` on 29 Sep** with no critical finding. Find
  the partial step in `km_dimension_watermarks` (status `partial`, trade_date
  2026-09-29) before assuming anything. Leadership only publishes on a clean
  run, so that gate will keep the Longer-Term view a day behind until whatever
  is partial is fixed.
- **`ai_client._fallback_complete` sends no bearer** to `llm.dristiq.com` —
  still unfixed; it is the standing "fallback fails most of the time" finding.
- **SSH sessions drop after ~5 min** for the owner; suggested
  `ServerAliveInterval 60` in `~/.ssh/config`. Not done.

---

## 6. How to run what this session added

```bash
cd App/backend
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/kdpg -o '-p 5499' -l /tmp/kdpg.log start"   # cloud container only
KD_TEST_DSN=postgresql://postgres@localhost:5499/kd_test python3 -m unittest test_filing_reader test_filing_checks   # 51 + 15
python3 -m unittest test_scan_contract_routing test_worker_claim_order                                 # 4 + 4, no DB
python3 -m pyflakes lib/filing_checks.py pipeline2_api.py
cd ../frontend && npm run typecheck && npm run build && node scripts/qa/check-filings.mjs
```
