/**
 * Scan Engine — dispatcher for the /scan tabs and Workspace VaNi Highlights.
 *
 * The six matview-backed presets (power_buy, power_sell, smart_money,
 * quiet_accumulation, distribution_warning, conviction_flow) read pre-ranked
 * rows from km_scan_results (see fetchFromScanMatview + migration 170). Direct-
 * query presets (Stage 2/3/4 family, Breakout Surge, Volume Drive, Vani Exit
 * Watch) each query PostgREST for their own row set. Flower Pot Burst reads
 * km_scan_results too, with a deeper on-demand fallback path for its own
 * computation when the matview isn't populated.
 *
 * Vocabulary (KaalaDristi):
 *   "Smart Money"            — sniper_inst
 *   "Accumulation Signature" — SBD
 *   "Conditions Favorable"   — scan match
 */

import { from } from './postgrest';
import type {
  ScanStock,
  ScanDefinition,
  IndustryEodRow,
  EquitySymbolRow,
  EquityEodSnapshot,
} from '@/types';

export type ScanTimeframe = 'daily' | 'weekly' | 'monthly';

const PIPELINE_URL = (import.meta.env.VITE_PIPELINE_API_URL as string) || '';

// ── Scan Definitions ───────────────────────────────────────────

// Minimal placeholder used only as React Query placeholderData during initial load.
// universe, category, category_label, category_color, category_sort, timeframe
// are NOT included here — they come from DB only via fetchScanPresets().
export const SCAN_PRESETS: ScanDefinition[] = [
  { id: 'power_buy',            name: 'Strength Confluence',   description: 'Stocks where multiple positive conditions converge in leading or rotating-in industries', limit: 25,  universe: 'NSE_BSE',  category: 'flow',          category_label: 'Flow',          category_color: '#3b82f6', category_sort: 3, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_s2' },
  { id: 'power_sell',           name: 'Weakness Confluence',   description: 'Stocks where multiple weakening conditions converge in lagging or rotating-out industries', limit: 25,  universe: 'NSE_BSE',  category: '',              category_label: '',              category_color: '',        category_sort: 99, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_distrib_and_weakness' },
  { id: 'smart_money',          name: 'Smart Money Loading',   description: 'Industries with broad rising flow and growing institutional presence',                      limit: 25,  universe: 'NSE_ONLY', category: 'market',        category_label: 'Market',        category_color: '#8b5cf6', category_sort: 4, is_default_tab: true,  timeframe: 'daily', vani_rule: 'is_vani_smart' },
  { id: 'quiet_accumulation',   name: 'Quiet Rising Flow',     description: 'Under-the-radar industries where smart money is quietly building positions',               limit: 25,  universe: 'NSE_ONLY', category: 'market',        category_label: 'Market',        category_color: '#8b5cf6', category_sort: 4, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_s2' },
  { id: 'distribution_warning', name: 'Falling Flow Warnings', description: 'Previously strong stocks showing signs of institutional exit',                             limit: 25,  universe: 'NSE_BSE',  category: 'market',        category_label: 'Market',        category_color: '#8b5cf6', category_sort: 4, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_distrib_and_weakness' },
  { id: 'conviction_flow',      name: 'Conviction Flow',       description: 'Stocks where 5-day delivery value is outpacing the 22-day norm',                          limit: 50,  universe: 'NSE_ONLY', category: 'flow',          category_label: 'Flow',          category_color: '#3b82f6', category_sort: 3, is_default_tab: true,  timeframe: 'daily', vani_rule: 'is_vani_surge_or_breakout' },
  { id: 'breakout_surge',       name: 'Breakout Surge',        description: 'NSE stocks closing above their 20-day high on a green day — ranked by Score 5D',        limit: 500, universe: 'NSE_ONLY', category: 'price_action',  category_label: 'Price Action',  category_color: '#f59e0b', category_sort: 1, is_default_tab: true,  timeframe: 'daily', vani_rule: 'is_vani_surge_or_breakout' },
  { id: 'volume_drive',         name: 'Volume Drive',          description: 'Stocks printing a volume-drive or accumulation bar — ranked by delivery conviction',                                limit: 60,  universe: 'NSE_BSE',  category: 'flow',          category_label: 'Flow',          category_color: '#3b82f6', category_sort: 3, is_default_tab: false, timeframe: 'daily', vani_rule: 'svd_delivery_conviction' },
  { id: 'flower_pot_burst',     name: 'Flower Pot Burst',      description: 'Stocks coiling in tight compression — dying volume, contracting range — plus the rare session when a coil releases with an explosive volume-and-range expansion',  limit: 60,  universe: 'NSE_ONLY', category: 'price_action',  category_label: 'Price Action',  category_color: '#f59e0b', category_sort: 1, is_default_tab: false, timeframe: 'daily', vani_rule: null },
  { id: 'stage_2_leaders',      name: 'Stage 2 Leaders',       description: 'Stocks in confirmed Weinstein Stage 2 — SMA200 rising, proper 52-week position',          limit: 500, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_s2' },
  { id: 'stage_2_watch',        name: 'Stage 2 Watch',         description: 'Stocks approaching Stage 2 — MA stacking confirmed, SMA200 not yet rising. Watch for Stage 2 breakout.', limit: 100, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: true, timeframe: 'daily', vani_rule: 'is_vani_smart' },
  { id: 'stage_4_leaders',      name: 'Stage 4 Leaders',       description: 'Confirmed downtrend — death cross, below both MAs',                                        limit: 200, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_weakness' },
  { id: 'stage_3_watch',        name: 'Stage 3 Watch',         description: 'Entering weakness — SMA50 converging toward SMA200',                                       limit: 100, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_weakness' },
  { id: 'vani_exit_watch',      name: 'VaNi Weakness Watch',   description: 'Highest conviction weakness — lowest RS, death cross confirmed',                            limit: 25,  universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'always_true' },
  // Placeholder rows only — real metadata (incl. category color) comes from
  // kd_scan_presets (migration 177); empty color keeps the literal ratchet flat.
  { id: 'waking_giants',        name: 'Waking Giants',         description: 'Stocks breaking out of a multi-year hibernation at the Golden Line — the first sessions of a structural transition', limit: 60, universe: 'NSE_ONLY', category: 'discovery', category_label: 'Discovery', category_color: '', category_sort: 5, is_default_tab: false, timeframe: 'daily', vani_rule: null },
  { id: 'wg_ascent',            name: 'Ascent',                description: 'Confirmed multi-year journeys in progress — aligned across the daily, weekly and monthly clocks',                     limit: 60, universe: 'NSE_ONLY', category: 'discovery', category_label: 'Discovery', category_color: '', category_sort: 5, is_default_tab: false, timeframe: 'daily', vani_rule: null },
  { id: 'wg_stirring',          name: 'Stirring',              description: 'Quiet delivery-backed building inside a multi-year hibernation — no breakout yet',                                    limit: 40, universe: 'NSE_ONLY', category: 'discovery', category_label: 'Discovery', category_color: '', category_sort: 5, is_default_tab: false, timeframe: 'daily', vani_rule: null },
];

// ── Preset metadata — DB is the source of truth ────────────────
// fetchScanPresets() fills this cache from kd_scan_presets; everything in the
// engine and ScanTable resolves preset metadata (vani_rule, category, limit)
// through getPresetMeta(). The static SCAN_PRESETS array above is ONLY the
// first-paint placeholder / offline fallback — editing kd_scan_presets in the
// DB must change behavior without a code deploy.

const _dbPresetMeta = new Map<string, ScanDefinition>();

export function getPresetMeta(id: string): ScanDefinition | undefined {
  return _dbPresetMeta.get(id) ?? SCAN_PRESETS.find((p) => p.id === id);
}

// ── Liquidity floor — DEFINED, NOT APPLIED (2026-08-25) ──────────────────
// The problem it was meant to solve is real: no preset had a floor, and
// Strength Confluence rank 3 was a Rs 2.46 stock trading Rs 0.01 Cr/day.
// conviction_flow was the one clean scan because its own gate already
// carried avg_amt_22d > 1.5.
//
// A uniform Rs 1 Cr floor was applied to 8 direct fetchers and 6 matview
// arms, then reverted (migration 181 removes the matview side) because the
// cost was measured only afterwards, and it was large — see below. The
// floor is the right idea at the wrong altitude: it belongs in each
// scanner's own gate, sized to that scanner, not applied uniformly.
//
// Platform liquidity floor, in Rs Cr of 22-session average turnover.
// NOT currently applied to the direct fetchers. It was added to 8 of them in
// the 2026-08-25 scanner-integrity work and reverted the same day: measured
// after the fact, a Rs 1 Cr floor removes 67% of Stage 2 Watch (447 -> 148),
// 60% of Stage 2 Leaders (1023 -> 414) and 68% of the VaNi-flagged leaders
// (19 -> 6). That is a product decision that needs those numbers in front of
// it, not a hygiene gate to slip in. Re-apply per scanner, with the before/
// after row count recorded for each.
const MIN_AVG_AMT_22D_CR = 1.0;

// ── Utilities ─────────────────────────────────────────────────


// 3b: Fetch trading dates from km_trading_calendar — exchange-aware, exact count
//
// ⚠ History: this filtered status='completed' ONLY. The backend's own
// orchestrator (pipeline2/orchestrator.py) explicitly designs 'partial' as
// a USABLE outcome — CRITICAL_STEPS is only the 3 eod_download steps; every
// other step (magic_rs, rolling_metrics, stage_classification, ...) failing
// downgrades the run to 'partial', by design, specifically so "the day is
// still usable" and "keeps the day from being withheld from the frontend"
// (see that file's own comment). This filter contradicted that design: a
// transient failure in ANY non-critical step (e.g. a magic_rs deadlock)
// permanently capped every scan using this resolver at the last fully-
// completed day — confirmed live, NSE stuck 'partial' for 3 of 4 days
// running, every fetchRecentDates() consumer silently frozen days behind
// while prices/ema_20/etc were already correct and current. 'failed' is
// still excluded — that status means eod_download itself didn't happen,
// so there's genuinely nothing usable for that date.
async function fetchRecentDates(limit: number): Promise<string[]> {
  const { data } = await from('km_trading_calendar')
    .select('trade_date')
    .in('status', ['completed', 'partial'])
    .eq('exchange', 'NSE')
    .order('trade_date', { ascending: false })
    .limit(limit)
    .execute();

  const rows = (data ?? []) as { trade_date: string }[];
  return rows.map((r) => r.trade_date).sort((a, b) => b.localeCompare(a));
}

// ── VaNi Opportunity Rule — data-driven ────────────────────────
/*
 * VANI OPPORTUNITY RULE TYPES (data-driven via kd_scan_presets.vani_rule)
 *
 * always_true                  → DB pre-filtered (VaNi Opportunity, Exit Watch)
 * is_vani_s2                   → Stage 2 quality overlay (strength + position)
 * is_vani_weakness             → Bear zone + short flow + volume + RS<-10
 * is_vani_distrib_and_weakness → Distribution OR weakness (bearish scanners)
 * is_vani_surge_or_breakout    → Volume surge OR breakout (momentum scanners)
 * is_vani_smart                → Institutional accumulation signal
 * is_vani_oversold             → Oversold bounce candidates
 * null                         → No VaNi chip shown for this scanner
 *
 * To add new rule: add case here + set vani_rule in kd_scan_presets DB.
 * No other code changes needed.
 *
 * Flags computed by: backfill_vani_flags.py (step 6j, daily)
 * Exception: is_vani_s2 computed by backfill_stage_classification.py (step 6h)
 *
 * All active scans use computeVaniOpportunity or read vani_flag from
 * km_scan_results (which is `is_vani_*` per preset — see migration 170).
 */

// row shape accepted by computeVaniOpportunity — DB row or computed stock fields
interface VaniRow {
  is_vani_s2?: boolean | null;
  is_vani_surge?: boolean | null;
  is_vani_breakout?: boolean | null;
  is_vani_distrib?: boolean | null;
  is_vani_weakness?: boolean | null;
  is_vani_smart?: boolean | null;
  is_vani_oversold?: boolean | null;
  rvol?: number | null;
  close?: number | null;
  w52_high?: number | null;
  dot_svd?: boolean | null;
  delivery_pct?: number | null;
}

function computeVaniOpportunity(row: VaniRow, vaniRule: string | null | undefined): boolean {
  if (!vaniRule) return false;
  switch (vaniRule) {
    case 'always_true':
      return true;
    case 'is_vani_s2':
      return !!row.is_vani_s2;
    case 'rvol_surge_and_52wh':
      return (row.rvol ?? 0) > 2
        && (row.close ?? 0) >= (row.w52_high ?? 0) * 0.98;
    case 'is_vani_surge_or_breakout':
      return !!row.is_vani_surge || !!row.is_vani_breakout;
    case 'svd_delivery_conviction':
      // Volume Drive's conviction marker. Measured over 2026-05-01..2026-08-03
      // on NSE closes >= 10, against a next-day >= 10% move (base rate 0.686%):
      //   dot_svd alone .................  7.14%  (10.4x)
      //   dot_svd AND delivery_pct >= 50  23.73%  (34.6x)
      // Delivery does NO work on the general population (0.96x) and a great deal
      // on an already-selected one — it is a multiplier, not a filter, which is
      // why it marks a subset here rather than gating the scan.
      //
      // Deliberately NOT is_vani_surge_or_breakout: those flags measure 0.53%
      // (0.8x, BELOW base rate) on their own, and stacking them onto this scan
      // cut it from 59 signals to 5 while lowering the hit rate to 20%.
      return !!row.dot_svd && (row.delivery_pct ?? 0) >= 50;
    case 'is_vani_distrib_and_weakness':
      // OR logic — is_vani_distrib is sparse (typically 1–5 stocks/day)
      // so OR ensures the bearish scanners still surface weakness signals
      return !!row.is_vani_distrib || !!row.is_vani_weakness;
    case 'is_vani_weakness':
      return !!row.is_vani_weakness;
    case 'is_vani_smart':
      return !!row.is_vani_smart;
    case 'is_vani_oversold':
      return !!row.is_vani_oversold;
    default:
      return false;
  }
}

// ── Direct-query scans (Path B) ────────────────────────────────
// Bundle scans (power_buy .. conviction_flow) were deleted after Phase 3
// repointed them onto km_scan_results (see fetchFromScanMatview below).
// The scans below query PostgREST directly and never touched the bundle.

/** Scan 8: Breakout Surge — merged scan (owner decision 2026-07-06: the old
 *  bundle-based Breakout Surge and the standalone Breakout Surge Daily were
 *  near-duplicates; two tabs made no sense).
 *
 *  Definition: close above the 20-day breakout level on a green day, close
 *  >= 50 (penny filter). breakout_level / pct_from_breakout are DB-precomputed
 *  by the indicator pipeline — no history download needed. Full active
 *  universe: the old Daily variant's Rs 10,000 Cr large-cap gate is now just
 *  the MCap filter in the filter bar. Ranked by Score 5D (owner doctrine:
 *  conviction ranks the list). VaNi via vani_rule from the DB preset.
 */
async function fetchBreakoutSurge(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  const { data: rows } = await from('km_equity_eod')
    .select([
      'equity_id', 'trade_date', 'close', 'open', 'high', 'low',
      'pct_chng', 'magic_rs', 'magic_rs_zone', 'rss_value', 'rss_spread',
      'rsi_14', 'rvol', 'flow_type', 'supertrend_dir',
      'sma_50', 'sma_150', 'sma_200', 'ema_20', 'atr_14',
      'w52_high', 'w52_low', 'lifetime_high',
      'avg_amt_5d', 'avg_amt_22d', 'avg_amt_66d', 'delivery_surge_x',
      'sniper_inst', 'sniper_hot', 'accum_distrib',
      'volume_divergence_flag', 'delivery_pct', 'deliv_value_cr',
      'dot_svd', 'dot_sbd', 'dot_syd', 'stage',
      'score_5d', 'score_22d', 'ret_5d', 'ret_22d', 'ret_66d',
      'breakout_level', 'pct_from_breakout', 'pct_below_52w_high',
      'is_vani_surge', 'is_vani_breakout',
      'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
    ].join(','))
    .eq('trade_date', latestDate)
    .gt('pct_chng', 0)
    .gte('close', 50)
    .gt('pct_from_breakout', 0)
    .limit(2000)
    .execute();

  const eodRows = (rows ?? []) as any[];

  // Zero results is ambiguous: "no breakouts today" vs "pct_from_breakout not
  // populated" (house lesson: silent NULL columns). Probe one row to tell.
  if (eodRows.length === 0) {
    const { data: probe } = await from('km_equity_eod')
      .select('pct_from_breakout')
      .eq('trade_date', latestDate)
      .gt('pct_from_breakout', -100000)
      .limit(1)
      .execute();
    if (!probe || probe.length === 0) {
      console.warn(`[breakout_surge] pct_from_breakout is NULL for all rows on ${latestDate} — indicator pipeline gap, scan cannot run`);
    }
    return [];
  }

  // ISIN-dedup: prefer NSE over BSE; apply exchange filter
  const isinMap = new Map<string, any>();
  for (const row of eodRows) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) { isinMap.set(`noisin:${row.equity_id}`, row); continue; }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') isinMap.set(isin, row);
  }

  const vaniRule = getPresetMeta('breakout_surge')?.vani_rule;
  const resultLimit = getPresetMeta('breakout_surge')?.limit ?? 500;

  const results = Array.from(isinMap.values()).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    return {
      equity_id:            row.equity_id,
      symbol:               sym?.symbol ?? String(row.equity_id),
      company_name:         sym?.company_name ?? null,
      industry:             sym?.industry ?? null,
      exchange:             sym?.exchange ?? null,
      mcap_cr:              sym?.mcap_cr ?? null,
      trade_date:           row.trade_date,
      close:                row.close,
      open:                 row.open ?? null,
      high:                 row.high ?? null,
      low:                  row.low ?? null,
      pct_chng:             row.pct_chng ?? null,
      magic_rs:             row.magic_rs ?? null,
      magic_rs_zone:        row.magic_rs_zone ?? null,
      rss_value:            row.rss_value ?? null,
      rss_spread:           row.rss_spread ?? null,
      rsi_14:               row.rsi_14 ?? null,
      rvol:                 row.rvol ?? null,
      flow_type:            row.flow_type ?? null,
      supertrend_dir:       row.supertrend_dir ?? null,
      sma_50:               row.sma_50 ?? null,
      sma_150:              row.sma_150 ?? null,
      sma_200:              row.sma_200 ?? null,
      ema_20:               ema20,
      atr_14:               atr14,
      w52_high:             row.w52_high ?? null,
      w52_low:              row.w52_low ?? null,
      lifetime_high:        row.lifetime_high ?? null,
      avg_amt_5d:           row.avg_amt_5d ?? null,
      avg_amt_22d:          row.avg_amt_22d ?? null,
      avg_amt_66d:          row.avg_amt_66d ?? null,
      delivery_surge_x:     row.delivery_surge_x ?? null,
      sniper_inst:          row.sniper_inst ?? null,
      sniper_hot:           row.sniper_hot ?? null,
      accum_distrib:        row.accum_distrib ?? null,
      volume_divergence_flag: row.volume_divergence_flag ?? null,
      delivery_pct:         row.delivery_pct ?? null,
      deliv_value_cr:       row.deliv_value_cr ?? null,
      has_recent_svd:       !!row.dot_svd,
      has_recent_sbd:       !!row.dot_sbd,
      has_recent_syd:       !!row.dot_syd,
      pctBelow52wHigh:      row.pct_below_52w_high ?? null,
      reward:               ema20 && atr14 ? (ema20 + atr14) - row.close : null,
      rewardPct:            ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null,
      magicRsTrend:         [],
      score_5d:             row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d:            row.score_22d != null ? Number(row.score_22d) : null,
      ret_5d:               row.ret_5d  ?? null,
      ret_22d:              row.ret_22d ?? null,
      ret_66d:              row.ret_66d ?? null,
      xAmt:                 null,
      rel_5d_n50:           null, rel_22d_n50:  null, rel_66d_n50:  null,
      rel_5d_n500:          null, rel_22d_n500: null, rel_66d_n500: null,
      vaniOpportunity:      computeVaniOpportunity(row, vaniRule),
      stage:                row.stage ?? null,
      d_pct:                row.pct_chng != null ? Math.round(Number(row.pct_chng) * 100) / 100 : null,
      breakout_level:       row.breakout_level    != null ? Number(row.breakout_level)    : null,
      pct_from_breakout:    row.pct_from_breakout != null ? Number(row.pct_from_breakout) : null,
    };
  });

  // Score 5D DESC, NULLS LAST
  results.sort((a, b) => {
    const as5 = a.score_5d ?? null;
    const bs5 = b.score_5d ?? null;
    if (as5 == null && bs5 == null) return 0;
    if (as5 == null) return 1;
    if (bs5 == null) return -1;
    return bs5 - as5;
  });
  return results.slice(0, resultLimit);
}

/** Scan 9: Stage 2 Leaders — direct PostgREST query on pre-computed stage column.
 *  Returns all stocks where stage = 'S2' on the latest trade date.
 *  VaNi = is_vani_s2 from DB. ISIN-deduped (NSE preferred).
 */
/** Scan: Volume Drive — dot_svd / dot_sbd bars, ranked by delivery conviction.
 *
 *  The dots are rebuilt nightly by scripts/compute_dots.py from the owner's
 *  Chartink screener definitions (SVD = volume > 10x SMA(vol,5), pct_chng > 9,
 *  close in top half of range, close >= sma_150; SBD = the broader 3x/top-third
 *  green-candle form). SVD is the extreme tail of the same shape as SBD, not a
 *  separate signal, so both qualify here and ranking separates them.
 *
 *  Measured 2026-05-01..2026-08-03, NSE, close >= 10, vs a next-day >= 10% move
 *  (base rate 0.686%):
 *      dot_svd ......................  7.14%  (10.4x)
 *      dot_sbd ......................  3.74%  ( 5.4x)
 *      dot_svd AND delivery >= 50 ... 23.73%  (34.6x)  <- the VaNi chip
 *
 *  What this scan does NOT catch, and cannot: stocks that explode from a quiet
 *  base. STEELCITY traded 8,728 shares the session before a +16% move. There is
 *  no daily-bar signal there — that cohort needs the intraday feed.
 *
 *  Ranking is delivery-first within dot tier, NOT by pct_chng: the move already
 *  happened, so ranking by size of move just sorts yesterday's news. Delivery is
 *  what separates a real bid from churn.
 */
async function fetchVolumeDrive(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  const COLS = [
    'equity_id', 'trade_date', 'close', 'open', 'high', 'low',
    'pct_chng', 'magic_rs', 'magic_rs_zone', 'rss_value', 'rss_spread',
    'rsi_14', 'rvol', 'flow_type', 'supertrend_dir',
    'sma_50', 'sma_150', 'sma_200', 'ema_20', 'atr_14',
    'w52_high', 'w52_low', 'lifetime_high',
    'avg_amt_5d', 'avg_amt_22d', 'avg_amt_66d', 'delivery_surge_x',
    'sniper_inst', 'sniper_hot', 'accum_distrib',
    'volume_divergence_flag', 'delivery_pct', 'deliv_value_cr',
    'dot_svd', 'dot_sbd', 'dot_syd', 'stage',
    'score_5d', 'score_22d', 'ret_5d', 'ret_22d', 'ret_66d',
    'breakout_level', 'pct_from_breakout', 'pct_below_52w_high',
    'is_vani_surge', 'is_vani_breakout',
    'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
  ].join(',');

  // The QueryBuilder has no .or() — two queries merged by equity_id instead of
  // touching shared infra. SVD is NOT a strict subset of SBD (SVD needs
  // pct_chng > 9 but no green candle, so a gap-up that closes below its open
  // fires SVD only — URBANCO did exactly that on 2026-08-03), so both are
  // needed.
  const [svdRes, sbdRes] = await Promise.all([
    from('km_equity_eod').select(COLS).eq('trade_date', latestDate)
      .is('dot_svd', 'true').limit(2000).execute(),
    from('km_equity_eod').select(COLS).eq('trade_date', latestDate)
      .is('dot_sbd', 'true').limit(2000).execute(),
  ]);

  const byId = new Map<number, any>();
  for (const r of [...((svdRes.data ?? []) as any[]), ...((sbdRes.data ?? []) as any[])]) {
    byId.set(r.equity_id, r);
  }
  const eodRows = Array.from(byId.values());

  // Zero results is ambiguous: "quiet day" vs "compute_dots.py never ran".
  // The dots were all-FALSE universe-wide for four months without anything
  // noticing (house lesson: a populated column can still be dead), so probe
  // rather than silently return an empty list.
  if (eodRows.length === 0) {
    const { data: probe } = await from('km_equity_eod')
      .select('equity_id')
      .eq('trade_date', latestDate)
      .is('dot_svd', 'true')
      .limit(1)
      .execute();
    if (!probe || probe.length === 0) {
      console.warn(`[volume_drive] no dot_svd/dot_sbd TRUE on ${latestDate} — if this persists for days, compute_dots.py has stopped running`);
    }
    return [];
  }

  // ISIN-dedup: prefer NSE over BSE; apply exchange filter
  const isinMap = new Map<string, any>();
  for (const row of eodRows) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) { isinMap.set(`noisin:${row.equity_id}`, row); continue; }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') isinMap.set(isin, row);
  }

  const vaniRule = getPresetMeta('volume_drive')?.vani_rule;
  const resultLimit = getPresetMeta('volume_drive')?.limit ?? 60;

  const results = Array.from(isinMap.values()).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    return {
      equity_id:            row.equity_id,
      symbol:               sym?.symbol ?? String(row.equity_id),
      company_name:         sym?.company_name ?? null,
      industry:             sym?.industry ?? null,
      exchange:             sym?.exchange ?? null,
      mcap_cr:              sym?.mcap_cr ?? null,
      trade_date:           row.trade_date,
      close:                row.close,
      open:                 row.open ?? null,
      high:                 row.high ?? null,
      low:                  row.low ?? null,
      pct_chng:             row.pct_chng ?? null,
      magic_rs:             row.magic_rs ?? null,
      magic_rs_zone:        row.magic_rs_zone ?? null,
      rss_value:            row.rss_value ?? null,
      rss_spread:           row.rss_spread ?? null,
      rsi_14:               row.rsi_14 ?? null,
      rvol:                 row.rvol ?? null,
      flow_type:            row.flow_type ?? null,
      supertrend_dir:       row.supertrend_dir ?? null,
      sma_50:               row.sma_50 ?? null,
      sma_150:              row.sma_150 ?? null,
      sma_200:              row.sma_200 ?? null,
      ema_20:               ema20,
      atr_14:               atr14,
      w52_high:             row.w52_high ?? null,
      w52_low:              row.w52_low ?? null,
      lifetime_high:        row.lifetime_high ?? null,
      avg_amt_5d:           row.avg_amt_5d ?? null,
      avg_amt_22d:          row.avg_amt_22d ?? null,
      avg_amt_66d:          row.avg_amt_66d ?? null,
      delivery_surge_x:     row.delivery_surge_x ?? null,
      sniper_inst:          row.sniper_inst ?? null,
      sniper_hot:           row.sniper_hot ?? null,
      accum_distrib:        row.accum_distrib ?? null,
      volume_divergence_flag: row.volume_divergence_flag ?? null,
      delivery_pct:         row.delivery_pct ?? null,
      deliv_value_cr:       row.deliv_value_cr ?? null,
      has_recent_svd:       !!row.dot_svd,
      has_recent_sbd:       !!row.dot_sbd,
      has_recent_syd:       !!row.dot_syd,
      // The dot IS this scan's selection criterion, so it has to be visible in
      // the grid. The three booleans above only render in card view and the XLS
      // export — the table has no boolean renderer.
      dot_signal:           row.dot_svd ? 'SVD' : row.dot_sbd ? 'SBD' : row.dot_syd ? 'SYD' : null,
      pctBelow52wHigh:      row.pct_below_52w_high ?? null,
      reward:               ema20 && atr14 ? (ema20 + atr14) - row.close : null,
      rewardPct:            ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null,
      magicRsTrend:         [],
      score_5d:             row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d:            row.score_22d != null ? Number(row.score_22d) : null,
      ret_5d:               row.ret_5d  ?? null,
      ret_22d:              row.ret_22d ?? null,
      ret_66d:              row.ret_66d ?? null,
      xAmt:                 null,
      rel_5d_n50:           null, rel_22d_n50:  null, rel_66d_n50:  null,
      rel_5d_n500:          null, rel_22d_n500: null, rel_66d_n500: null,
      vaniOpportunity:      computeVaniOpportunity(row, vaniRule),
      stage:                row.stage ?? null,
      d_pct:                row.pct_chng != null ? Math.round(Number(row.pct_chng) * 100) / 100 : null,
      breakout_level:       row.breakout_level    != null ? Number(row.breakout_level)    : null,
      pct_from_breakout:    row.pct_from_breakout != null ? Number(row.pct_from_breakout) : null,
    };
  });

  // SVD tier first (10.4x vs 5.4x), then delivery conviction, then 5-day
  // momentum — the strongest continuous feature measured (ret_5d 3.15 vs 0.32).
  results.sort((a, b) => {
    if (a.has_recent_svd !== b.has_recent_svd) return a.has_recent_svd ? -1 : 1;
    const ad = a.delivery_pct ?? -1;
    const bd = b.delivery_pct ?? -1;
    if (ad !== bd) return bd - ad;
    return (b.ret_5d ?? -999) - (a.ret_5d ?? -999);
  });
  return results.slice(0, resultLimit);
}

async function fetchStage2Leaders(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  // Use km_trading_calendar completed dates — immune to mid-pipeline partial ingestion.
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  // 2. Fetch all S2 stocks with embedded symbol data
  const { data: rows } = await from('km_equity_eod')
    .select([
      'equity_id', 'trade_date', 'close', 'open', 'high', 'low',
      'pct_chng', 'magic_rs', 'magic_rs_zone', 'rss_value', 'rss_spread',
      'rsi_14', 'rvol', 'flow_type', 'supertrend_dir',
      'sma_50', 'sma_200', 'sma_150', 'ema_20', 'atr_14',
      'w52_high', 'w52_low', 'lifetime_high',
      'avg_amt_5d', 'avg_amt_22d', 'delivery_surge_x',
      'sniper_inst', 'sniper_hot', 'accum_distrib',
      'volume_divergence_flag', 'delivery_pct',
      'dot_svd', 'dot_sbd', 'dot_syd',
      'stage', 'is_vani_s2', 'rs_percentile',
      'score_5d', 'score_22d',
      'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
    ].join(','))
    .eq('stage', 'S2')
    .eq('trade_date', latestDate)
    .order('magic_rs', { ascending: false })
    .limit(500)
    .execute();

  const eodRows = (rows ?? []) as any[];

  // 3. ISIN-dedup: prefer NSE over BSE
  const isinMap = new Map<string, any>();
  for (const row of eodRows) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) {
      // no isin — include as-is keyed by equity_id
      isinMap.set(`noisin:${row.equity_id}`, row);
      continue;
    }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') {
      isinMap.set(isin, row);
    }
  }

  // 4. Map to ScanStock
  return Array.from(isinMap.values()).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const pctBelow52wHigh = row.w52_high && row.w52_high > 0
      ? ((row.w52_high - row.close) / row.w52_high) * 100
      : null;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    const reward = ema20 && atr14 ? (ema20 + atr14) - row.close : null;
    const rewardPct = ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null;

    return {
      equity_id:            row.equity_id,
      symbol:               sym?.symbol ?? String(row.equity_id),
      company_name:         sym?.company_name ?? null,
      industry:             sym?.industry ?? null,
      exchange:             sym?.exchange ?? null,
      mcap_cr:              sym?.mcap_cr ?? null,
      trade_date:           row.trade_date,
      close:                row.close,
      open:                 row.open ?? null,
      high:                 row.high ?? null,
      low:                  row.low ?? null,
      pct_chng:             row.pct_chng ?? null,
      magic_rs:             row.magic_rs ?? null,
      magic_rs_zone:        row.magic_rs_zone ?? null,
      rss_value:            row.rss_value ?? null,
      rss_spread:           row.rss_spread ?? null,
      rsi_14:               row.rsi_14 ?? null,
      rvol:                 row.rvol ?? null,
      flow_type:            row.flow_type ?? null,
      supertrend_dir:       row.supertrend_dir ?? null,
      sma_50:               row.sma_50 ?? null,
      sma_200:              row.sma_200 ?? null,
      sma_150:              row.sma_150 ?? null,
      ema_20:               ema20,
      atr_14:               atr14,
      w52_high:             row.w52_high ?? null,
      w52_low:              row.w52_low ?? null,
      lifetime_high:        row.lifetime_high ?? null,
      avg_amt_5d:           row.avg_amt_5d ?? null,
      avg_amt_22d:          row.avg_amt_22d ?? null,
      delivery_surge_x:     row.delivery_surge_x ?? null,
      sniper_inst:          row.sniper_inst ?? null,
      sniper_hot:           row.sniper_hot ?? null,
      accum_distrib:        row.accum_distrib ?? null,
      volume_divergence_flag: row.volume_divergence_flag ?? null,
      delivery_pct:         row.delivery_pct ?? null,
      has_recent_svd:       !!row.dot_svd,
      has_recent_sbd:       !!row.dot_sbd,
      has_recent_syd:       !!row.dot_syd,
      pctBelow52wHigh,
      reward,
      rewardPct,
      magicRsTrend:         [],
      score_5d:             row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d:            row.score_22d != null ? Number(row.score_22d) : null,
      avg_amt_66d:          null,
      xAmt:                 null,
      rel_5d_n50:           null, rel_22d_n50:  null, rel_66d_n50:  null,
      rel_5d_n500:          null, rel_22d_n500: null, rel_66d_n500: null,
      vaniOpportunity:      computeVaniOpportunity(row, getPresetMeta('stage_2_leaders')?.vani_rule),
      rs_percentile:        row.rs_percentile ?? null,
      stage:                row.stage ?? null,
      is_vani_s2:           row.is_vani_s2 ?? null,
    };
  });
}

/** Scan: Stage 2 Watch — S2_CANDIDATE stocks with MA stacking, not yet extended. */
async function fetchStage2Watch(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  const { data: rows } = await from('km_equity_eod')
    .select([
      'equity_id', 'trade_date', 'close', 'open', 'high', 'low',
      'pct_chng', 'magic_rs', 'magic_rs_zone', 'rss_value', 'rss_spread',
      'rsi_14', 'rvol', 'flow_type', 'supertrend_dir',
      'sma_50', 'sma_150', 'sma_200', 'sma200_rising', 'ema_20', 'atr_14',
      'w52_high', 'w52_low', 'lifetime_high',
      'avg_amt_5d', 'avg_amt_22d', 'delivery_surge_x',
      'sniper_inst', 'sniper_hot', 'accum_distrib',
      'volume_divergence_flag', 'delivery_pct',
      'dot_svd', 'dot_sbd', 'dot_syd',
      'stage', 'rs_percentile', 'chartink_score', 'is_vani_s2',
      'score_5d', 'score_22d',
      'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
    ].join(','))
    .eq('stage', 'S2_CANDIDATE')
    .eq('trade_date', latestDate)
    .gt('close', 30)
    .order('rs_percentile', { ascending: false })
    .limit(200)
    .execute();

  const eodRows = (rows ?? []) as any[];

  // Client-side filter: price > sma_150, sma_50 > sma_150, pct_above_150 < 50%
  const filtered = eodRows.filter((row) => {
    const sma150 = row.sma_150;
    const sma50 = row.sma_50;
    if (!sma150 || !sma50) return false;
    if (row.close <= sma150) return false;
    if (sma50 <= sma150) return false;
    const pctAbove150 = ((row.close - sma150) / sma150) * 100;
    return pctAbove150 < 50;
  });

  // ISIN dedup: prefer NSE
  const isinMap = new Map<string, any>();
  for (const row of filtered) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) { isinMap.set(`noisin:${row.equity_id}`, row); continue; }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') isinMap.set(isin, row);
  }

  return Array.from(isinMap.values()).slice(0, 100).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const pctBelow52wHigh = row.w52_high && row.w52_high > 0
      ? ((row.w52_high - row.close) / row.w52_high) * 100 : null;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    return {
      equity_id: row.equity_id, trade_date: row.trade_date,
      symbol: sym?.symbol ?? String(row.equity_id),
      company_name: sym?.company_name ?? null,
      industry: sym?.industry ?? null,
      exchange: sym?.exchange ?? null, mcap_cr: sym?.mcap_cr ?? null,
      close: row.close, open: row.open ?? null, high: row.high ?? null, low: row.low ?? null,
      pct_chng: row.pct_chng ?? null,
      magic_rs: row.magic_rs ?? null, magic_rs_zone: row.magic_rs_zone ?? null,
      rss_value: row.rss_value ?? null, rss_spread: row.rss_spread ?? null,
      rsi_14: row.rsi_14 ?? null, rvol: row.rvol ?? null,
      flow_type: row.flow_type ?? null, sniper_inst: row.sniper_inst ?? null,
      sniper_hot: row.sniper_hot ?? null,
      accum_distrib: row.accum_distrib ?? null,
      volume_divergence_flag: row.volume_divergence_flag ?? null,
      sma_50: row.sma_50 ?? null, sma_150: row.sma_150 ?? null,
      sma_200: row.sma_200 ?? null, ema_20: ema20, atr_14: atr14,
      w52_high: row.w52_high ?? null, w52_low: row.w52_low ?? null,
      lifetime_high: row.lifetime_high ?? null,
      delivery_pct: row.delivery_pct ?? null, supertrend_dir: row.supertrend_dir ?? null,
      has_recent_svd: !!row.dot_svd, has_recent_sbd: !!row.dot_sbd, has_recent_syd: !!row.dot_syd,
      avg_amt_5d: row.avg_amt_5d ?? null, avg_amt_22d: row.avg_amt_22d ?? null,
      delivery_surge_x: row.delivery_surge_x ?? null,
      avg_amt_66d: null, xAmt: null,
      rel_5d_n50: null, rel_22d_n50: null, rel_66d_n50: null,
      rel_5d_n500: null, rel_22d_n500: null, rel_66d_n500: null,
      magicRsTrend: [],
      score_5d:  row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d: row.score_22d != null ? Number(row.score_22d) : null,
      reward: ema20 && atr14 ? (ema20 + atr14) - row.close : null,
      rewardPct: ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null,
      pctBelow52wHigh,
      vaniOpportunity: computeVaniOpportunity(row, getPresetMeta('stage_2_watch')?.vani_rule),
      rs_percentile: row.rs_percentile ?? null,
      stage: row.stage ?? null,
      sma200_rising: row.sma200_rising ?? null,
      chartink_score: row.chartink_score ?? null,
      is_vani_s2: row.is_vani_s2 ?? null,
    };
  });
}

/** Scan: Stage 4 Leaders — death cross confirmed, sorted weakest RS first. */
async function fetchStage4Leaders(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  const { data: rows } = await from('km_equity_eod')
    .select([
      'equity_id', 'trade_date', 'close', 'stage',
      'open', 'high', 'low', 'pct_chng',
      'sma_50', 'sma_150', 'sma_200', 'sma200_rising',
      'magic_rs', 'magic_rs_zone', 'rs_percentile',
      'rss_value', 'rss_spread',
      'rsi_14', 'rvol',
      'w52_high', 'w52_low', 'lifetime_high',
      'avg_amt_5d', 'avg_amt_22d', 'delivery_surge_x',
      'sniper_inst', 'sniper_hot', 'accum_distrib',
      'flow_type', 'volume_divergence_flag', 'delivery_pct',
      'dot_svd', 'dot_sbd', 'dot_syd',
      'supertrend_dir', 'ema_20', 'atr_14',
      'is_vani_weakness', 'is_vani_distrib', 'is_vani_surge',
      'is_vani_breakout', 'is_vani_smart', 'is_vani_oversold',
      'score_5d', 'score_22d',
      'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
    ].join(','))
    .eq('stage', 'S4')
    .eq('trade_date', latestDate)
    .gt('close', 30)
    .order('rs_percentile', { ascending: true })
    .limit(500)
    .execute();

  const eodRows = (rows ?? []) as any[];

  // Client-side death cross filter: close < sma_50 AND sma_50 < sma_200
  // stage='S4' only guarantees close < sma_200; the full death cross is stricter
  const filtered = eodRows.filter((row: any) =>
    row.sma_50 != null && row.sma_200 != null &&
    row.close < row.sma_50 && row.sma_50 < row.sma_200
  );

  // ISIN dedup: prefer NSE
  const isinMap = new Map<string, any>();
  for (const row of filtered) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) { isinMap.set(`noisin:${row.equity_id}`, row); continue; }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') isinMap.set(isin, row);
  }

  return Array.from(isinMap.values()).slice(0, 200).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const pctBelow52wHigh = row.w52_high && row.w52_high > 0
      ? ((row.w52_high - row.close) / row.w52_high) * 100 : null;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    const reward = ema20 && atr14 ? (ema20 + atr14) - row.close : null;
    const rewardPct = ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null;
    return {
      equity_id:            row.equity_id,
      symbol:               sym?.symbol ?? String(row.equity_id),
      company_name:         sym?.company_name ?? null,
      industry:             sym?.industry ?? null,
      exchange:             sym?.exchange ?? null,
      mcap_cr:              sym?.mcap_cr ?? null,
      trade_date:           row.trade_date,
      close:                row.close,
      open:                 row.open ?? null,
      high:                 row.high ?? null,
      low:                  row.low ?? null,
      pct_chng:             row.pct_chng ?? null,
      magic_rs:             row.magic_rs ?? null,
      magic_rs_zone:        row.magic_rs_zone ?? null,
      rss_value:            row.rss_value ?? null,
      rss_spread:           row.rss_spread ?? null,
      rsi_14:               row.rsi_14 ?? null,
      rvol:                 row.rvol ?? null,
      flow_type:            row.flow_type ?? null,
      supertrend_dir:       row.supertrend_dir ?? null,
      sma_50:               row.sma_50 ?? null,
      sma_150:              row.sma_150 ?? null,
      sma_200:              row.sma_200 ?? null,
      sma200_rising:        row.sma200_rising ?? null,
      ema_20:               ema20,
      atr_14:               atr14,
      w52_high:             row.w52_high ?? null,
      w52_low:              row.w52_low ?? null,
      lifetime_high:        row.lifetime_high ?? null,
      avg_amt_5d:           row.avg_amt_5d ?? null,
      avg_amt_22d:          row.avg_amt_22d ?? null,
      delivery_surge_x:     row.delivery_surge_x ?? null,
      sniper_inst:          row.sniper_inst ?? null,
      sniper_hot:           row.sniper_hot ?? null,
      accum_distrib:        row.accum_distrib ?? null,
      volume_divergence_flag: row.volume_divergence_flag ?? null,
      delivery_pct:         row.delivery_pct ?? null,
      has_recent_svd:       !!row.dot_svd,
      has_recent_sbd:       !!row.dot_sbd,
      has_recent_syd:       !!row.dot_syd,
      pctBelow52wHigh,
      reward,
      rewardPct,
      magicRsTrend:         [],
      score_5d:             row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d:            row.score_22d != null ? Number(row.score_22d) : null,
      avg_amt_66d:          null,
      xAmt:                 null,
      rel_5d_n50:           null, rel_22d_n50:  null, rel_66d_n50:  null,
      rel_5d_n500:          null, rel_22d_n500: null, rel_66d_n500: null,
      vaniOpportunity:      computeVaniOpportunity(row, getPresetMeta('stage_4_leaders')?.vani_rule),
      rs_percentile:        row.rs_percentile ?? null,
      stage:                row.stage ?? null,
      is_vani_weakness:     row.is_vani_weakness ?? null,
      is_vani_distrib:      row.is_vani_distrib ?? null,
      is_vani_surge:        row.is_vani_surge ?? null,
      is_vani_breakout:     row.is_vani_breakout ?? null,
      is_vani_smart:        row.is_vani_smart ?? null,
      is_vani_oversold:     row.is_vani_oversold ?? null,
    };
  });
}

/** Scan: Stage 3 Watch — above SMA200, SMA50 converging. Sorted by closeness to death cross. */
async function fetchStage3Watch(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  const { data: rows } = await from('km_equity_eod')
    .select([
      'equity_id', 'trade_date', 'close', 'stage',
      'pct_chng', 'magic_rs', 'magic_rs_zone', 'rs_percentile',
      'rss_value', 'rss_spread',
      'sma_50', 'sma_150', 'sma_200', 'sma200_rising',
      'rsi_14', 'rvol',
      'w52_high', 'w52_low',
      'flow_type', 'volume_divergence_flag', 'delivery_pct',
      'dot_svd', 'dot_sbd', 'dot_syd',
      'sniper_inst', 'sniper_hot', 'accum_distrib',
      'supertrend_dir', 'ema_20', 'atr_14',
      'is_vani_weakness',
      'score_5d', 'score_22d',
      'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
    ].join(','))
    .eq('stage', 'S3')
    .eq('trade_date', latestDate)
    .gt('close', 30)
    .order('rs_percentile', { ascending: true })
    .limit(300)
    .execute();

  const eodRows = (rows ?? []) as any[];

  // Client-side: keep only rows with SMA50 within 15% of SMA200 (explicit S3 condition)
  // Sort by convergence gap ascending (closest to death cross first)
  const filtered = eodRows
    .filter((row) => {
      const sma50 = row.sma_50;
      const sma200 = row.sma_200;
      if (!sma50 || !sma200 || sma200 <= 0) return false;
      return Math.abs(sma50 - sma200) / sma200 < 0.15;
    })
    .sort((a: any, b: any) => {
      const gapA = a.sma_200 > 0 ? Math.abs(a.sma_50 - a.sma_200) / a.sma_200 : 1;
      const gapB = b.sma_200 > 0 ? Math.abs(b.sma_50 - b.sma_200) / b.sma_200 : 1;
      return gapA - gapB;
    });

  // ISIN dedup: prefer NSE
  const isinMap = new Map<string, any>();
  for (const row of filtered) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) { isinMap.set(`noisin:${row.equity_id}`, row); continue; }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') isinMap.set(isin, row);
  }

  return Array.from(isinMap.values()).slice(0, 100).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const pctBelow52wHigh = row.w52_high && row.w52_high > 0
      ? ((row.w52_high - row.close) / row.w52_high) * 100 : null;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    return {
      equity_id:            row.equity_id,
      symbol:               sym?.symbol ?? String(row.equity_id),
      company_name:         sym?.company_name ?? null,
      industry:             sym?.industry ?? null,
      exchange:             sym?.exchange ?? null,
      mcap_cr:              sym?.mcap_cr ?? null,
      trade_date:           row.trade_date,
      close:                row.close,
      open:                 null, high: null, low: null,
      pct_chng:             row.pct_chng ?? null,
      magic_rs:             row.magic_rs ?? null,
      magic_rs_zone:        row.magic_rs_zone ?? null,
      rss_value:            row.rss_value ?? null, rss_spread: row.rss_spread ?? null,
      rsi_14:               row.rsi_14 ?? null,
      rvol:                 row.rvol ?? null,
      flow_type:            row.flow_type ?? null,
      supertrend_dir:       row.supertrend_dir ?? null,
      sma_50:               row.sma_50 ?? null,
      sma_150:              row.sma_150 ?? null,
      sma_200:              row.sma_200 ?? null,
      sma200_rising:        row.sma200_rising ?? null,
      ema_20:               ema20,
      atr_14:               atr14,
      w52_high:             row.w52_high ?? null,
      w52_low:              row.w52_low ?? null,
      lifetime_high:        null,
      avg_amt_5d:           null, avg_amt_22d: null, delivery_surge_x: null,
      sniper_inst:          row.sniper_inst ?? null,
      sniper_hot:           row.sniper_hot ?? null,
      accum_distrib:        row.accum_distrib ?? null,
      volume_divergence_flag: row.volume_divergence_flag ?? null,
      delivery_pct:         row.delivery_pct ?? null,
      has_recent_svd:       !!row.dot_svd,
      has_recent_sbd:       !!row.dot_sbd,
      has_recent_syd:       !!row.dot_syd,
      pctBelow52wHigh,
      reward: ema20 && atr14 ? (ema20 + atr14) - row.close : null,
      rewardPct: ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null,
      magicRsTrend:         [],
      score_5d:             row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d:            row.score_22d != null ? Number(row.score_22d) : null,
      avg_amt_66d:          null, xAmt: null,
      rel_5d_n50:           null, rel_22d_n50:  null, rel_66d_n50:  null,
      rel_5d_n500:          null, rel_22d_n500: null, rel_66d_n500: null,
      vaniOpportunity:      computeVaniOpportunity(row, getPresetMeta('stage_3_watch')?.vani_rule),
      rs_percentile:        row.rs_percentile ?? null,
      stage:                row.stage ?? null,
      is_vani_weakness:     row.is_vani_weakness ?? null,
    };
  });
}

/** Scan: VaNi Exit Watch — Stage 4 + RS percentile < 20. Bottom 25 weakest. */
async function fetchVaNiExitWatch(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  const completedDates = await fetchRecentDates(1);
  const latestDate: string | null = completedDates[0] ?? null;
  if (!latestDate) return [];

  const { data: rows } = await from('km_equity_eod')
    .select([
      'equity_id', 'trade_date', 'close', 'stage',
      'pct_chng', 'magic_rs', 'magic_rs_zone', 'rs_percentile',
      'rss_value', 'rss_spread',
      'sma_50', 'sma_150', 'sma_200',
      'rsi_14', 'rvol', 'flow_type',
      'w52_high', 'w52_low',
      'dot_svd', 'dot_sbd', 'dot_syd',
      'sniper_inst', 'sniper_hot',
      'ema_20', 'atr_14',
      'is_vani_weakness', 'is_vani_distrib',
      'score_5d', 'score_22d',
      'km_equity_symbols(id,symbol,company_name,exchange,industry,mcap_cr,isin)',
    ].join(','))
    .eq('stage', 'S4')
    .eq('trade_date', latestDate)
    .gt('close', 30)
    .lt('rs_percentile', 20)
    .order('rs_percentile', { ascending: true })
    .limit(100)
    .execute();

  const eodRows = (rows ?? []) as any[];

  // Client-side death cross filter: close < sma_50 AND sma_50 < sma_200
  const deathCross = eodRows.filter((row: any) =>
    row.sma_50 != null && row.sma_200 != null &&
    row.close < row.sma_50 && row.sma_50 < row.sma_200
  );

  // ISIN dedup: prefer NSE
  const isinMap = new Map<string, any>();
  for (const row of deathCross) {
    const sym = row.km_equity_symbols;
    if (!sym) continue;
    if (exchangeFilter === 'NSE' && sym.exchange !== 'NSE') continue;
    if (exchangeFilter === 'BSE' && sym.exchange !== 'BSE') continue;
    const isin = sym.isin;
    if (!isin) { isinMap.set(`noisin:${row.equity_id}`, row); continue; }
    const existing = isinMap.get(isin);
    if (!existing || sym.exchange === 'NSE') isinMap.set(isin, row);
  }

  return Array.from(isinMap.values()).slice(0, 25).map((row): ScanStock => {
    const sym = row.km_equity_symbols;
    const pctBelow52wHigh = row.w52_high && row.w52_high > 0
      ? ((row.w52_high - row.close) / row.w52_high) * 100 : null;
    const ema20 = row.ema_20 ?? null;
    const atr14 = row.atr_14 ?? null;
    return {
      equity_id:            row.equity_id,
      symbol:               sym?.symbol ?? String(row.equity_id),
      company_name:         sym?.company_name ?? null,
      industry:             sym?.industry ?? null,
      exchange:             sym?.exchange ?? null,
      mcap_cr:              sym?.mcap_cr ?? null,
      trade_date:           row.trade_date,
      close:                row.close,
      open:                 null, high: null, low: null,
      pct_chng:             row.pct_chng ?? null,
      magic_rs:             row.magic_rs ?? null,
      magic_rs_zone:        row.magic_rs_zone ?? null,
      rss_value:            row.rss_value ?? null, rss_spread: row.rss_spread ?? null,
      rsi_14:               row.rsi_14 ?? null,
      rvol:                 row.rvol ?? null,
      flow_type:            row.flow_type ?? null,
      supertrend_dir:       null,
      sma_50:               row.sma_50 ?? null,
      sma_150:              row.sma_150 ?? null,
      sma_200:              row.sma_200 ?? null,
      sma200_rising:        null,
      ema_20:               ema20,
      atr_14:               atr14,
      w52_high:             row.w52_high ?? null,
      w52_low:              row.w52_low ?? null,
      lifetime_high:        null,
      avg_amt_5d:           null, avg_amt_22d: null, delivery_surge_x: null,
      sniper_inst:          row.sniper_inst ?? null,
      sniper_hot:           row.sniper_hot ?? null,
      accum_distrib:        null,
      volume_divergence_flag: null,
      delivery_pct:         null,
      has_recent_svd:       !!row.dot_svd,
      has_recent_sbd:       !!row.dot_sbd,
      has_recent_syd:       !!row.dot_syd,
      pctBelow52wHigh,
      reward: ema20 && atr14 ? (ema20 + atr14) - row.close : null,
      rewardPct: ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - row.close) / atr14 : null,
      magicRsTrend:         [],
      score_5d:             row.score_5d  != null ? Number(row.score_5d)  : null,
      score_22d:            row.score_22d != null ? Number(row.score_22d) : null,
      avg_amt_66d:          null, xAmt: null,
      rel_5d_n50:           null, rel_22d_n50:  null, rel_66d_n50:  null,
      rel_5d_n500:          null, rel_22d_n500: null, rel_66d_n500: null,
      vaniOpportunity:      true, // always_true — all results in this scan qualify
      rs_percentile:        row.rs_percentile ?? null,
      stage:                row.stage ?? null,
    };
  });
}


// ── Public API ─────────────────────────────────────────────────

/**
 * Build a Set of equity_ids that are the NSE-preferred representative per ISIN.
 * For dual-listed stocks this picks the NSE row; for NSE-only or BSE-only it picks whichever exists.
 * Used by scan functions to avoid processing BSE numeric-code duplicates.
 */
export function buildNsePreferredIds(symbols: Map<number, EquitySymbolRow>): Set<number> {
  const isinToId = new Map<string, { id: number; exchange: string }>();
  for (const [id, sym] of symbols) {
    const isin = sym.isin;
    if (!isin) continue;
    const existing = isinToId.get(isin);
    if (!existing || sym.exchange === 'NSE') {
      isinToId.set(isin, { id, exchange: sym.exchange ?? '' });
    }
  }
  const ids = new Set<number>();
  for (const v of isinToId.values()) ids.add(v.id);
  return ids;
}

/**
 * Deduplicate scan results by ISIN (prefer VaNi opportunity, then NSE over BSE).
 * For Combined mode, ensures one row per company.
 */
function deduplicateByIsin(stocks: ScanStock[], symbols: Map<number, EquitySymbolRow>): ScanStock[] {
  const seen = new Map<string, ScanStock>();
  for (const stock of stocks) {
    const sym = symbols.get(stock.equity_id);
    const isin = sym?.isin;
    if (!isin) continue; // skip no-ISIN stocks in combined mode — matches SQL WHERE isin IS NOT NULL
    const existing = seen.get(isin);
    if (!existing) {
      seen.set(isin, stock);
    } else {
      // Prefer VaNi opportunity first; fall back to NSE preference for ties
      const stockWins = stock.vaniOpportunity && !existing.vaniOpportunity
        || (!stock.vaniOpportunity === !existing.vaniOpportunity && stock.exchange === 'NSE' && existing.exchange !== 'NSE');
      if (stockWins) seen.set(isin, stock);
    }
  }
  return [...seen.values()];
}

export type ExchangeFilter = 'combined' | 'NSE' | 'BSE';

// ── Flower Pot Burst (energy compression → release) ────────────
//
// A precision, low-frequency scan. Two phases surface together:
//   SETUP  — a stock coiling now: ATR contracting, range tightening, volume
//            dying, relative strength flat (not trending). The watchlist.
//   BURST  — the rare session (≈2×/month across NSE) when an active coil
//            releases: volume + range expansion, strong close, breaks the
//            10-day range on real delivery.
//
// Thresholds are CALIBRATED to the live NSE distribution (2026-07-13), not the
// spec literals — the spec's ATR15/ATR60 < 0.5 fired for 12 of 1,232 stocks and
// < 0.35 for zero (ATR15 is a subset of ATR60, so the ratio naturally sits ~0.96).
// Calibrated compression gate → ~4 coiling today / 37 active over 22 sessions.
// This needs ~60 sessions of history per stock, far deeper than the shared
// scanner bundle (~30 sessions), so FPB runs its own on-demand fetch — it only
// loads when its tab is opened and never taxes the other scanners' page load.
const FPB = {
  ATR_COMPRESSION_MAX: 0.8,   // ATR15 / ATR60 — recent vol below its 60d norm
  RANGE_PCT_MAX: 0.08,        // 10-day (high-low) / close — price coiled
  VOL_DEATH_MAX: 0.6,         // vol5 / vol22 — participation fading
  RS_FLAT_MAX: 2,             // |MagicRS 5-day delta| — coiled, not trending
  MIN_CLOSE: 20,              // avoid sub-₹20 illiquids
  MIN_BARS: 60,               // need a full 60d ATR window
  SETUP_LOOKBACK: 10,         // "coiling now" = compressed within last N sessions
  BURST_PRIOR_LOOKBACK: 22,   // burst requires a setup active in the prior N sessions
  VOL_BURST_MIN: 3.0,         // today volume / 22d avg
  RANGE_EXP_MIN: 2.0,         // today range / 15d avg range
  CLOSE_STRENGTH_MIN: 0.70,   // close in top 30% of day's range
  DELIVERY_MIN: 45,           // real buyers, not intraday churn
} as const;

function fpbMean(arr: number[], end: number, len: number): number {
  const start = Math.max(0, end - len + 1);
  let sum = 0, n = 0;
  for (let i = start; i <= end; i++) {
    const v = arr[i];
    if (v != null && !Number.isNaN(v)) { sum += v; n++; }
  }
  return n ? sum / n : NaN;
}
function fpbMax(arr: number[], start: number, end: number): number {
  let m = -Infinity;
  for (let i = Math.max(0, start); i <= end; i++) if (arr[i] > m) m = arr[i];
  return m;
}
function fpbMin(arr: number[], start: number, end: number): number {
  let m = Infinity;
  for (let i = Math.max(0, start); i <= end; i++) if (arr[i] < m) m = arr[i];
  return m;
}

/** Build the FPB ScanStock for one equity from its ascending-date history,
 *  or null if it is neither coiling nor bursting. */
function computeFpbStock(bars: any[], sym: EquitySymbolRow | undefined): ScanStock | null {
  const n = bars.length;
  if (n < FPB.MIN_BARS + 1) return null;
  const L = n - 1;

  const high = bars.map((b) => Number(b.high));
  const low = bars.map((b) => Number(b.low));
  const close = bars.map((b) => Number(b.close));
  const open = bars.map((b) => Number(b.open));
  const vol = bars.map((b) => Number(b.volume));
  const mrs = bars.map((b) => (b.magic_rs != null ? Number(b.magic_rs) : NaN));
  const rangeArr = bars.map((b) => Number(b.high) - Number(b.low));
  const tr = bars.map((b, i) => {
    const pc = b.prev_close != null ? Number(b.prev_close) : (i > 0 ? close[i - 1] : close[i]);
    return Math.max(high[i] - low[i], Math.abs(high[i] - pc), Math.abs(low[i] - pc));
  });

  // Compression gate evaluated ending at bar `idx` (needs >= MIN_BARS history).
  const compressedAt = (idx: number): boolean => {
    if (idx < FPB.MIN_BARS - 1) return false;
    if (close[idx] <= FPB.MIN_CLOSE) return false;
    const stg = bars[idx].stage;
    if (stg === 'S3' || stg === 'S4') return false;
    const atr15 = fpbMean(tr, idx, 15), atr60 = fpbMean(tr, idx, 60);
    if (!(atr60 > 0) || atr15 / atr60 >= FPB.ATR_COMPRESSION_MAX) return false;
    const hi10 = fpbMax(high, idx - 9, idx), lo10 = fpbMin(low, idx - 9, idx);
    if ((hi10 - lo10) / close[idx] >= FPB.RANGE_PCT_MAX) return false;
    const vol5 = fpbMean(vol, idx, 5), vol22 = fpbMean(vol, idx, 22);
    if (!(vol22 > 0) || vol5 / vol22 >= FPB.VOL_DEATH_MAX) return false;
    const rsNow = mrs[idx], rsPrev = mrs[idx - 5];
    if (Number.isNaN(rsNow) || Number.isNaN(rsPrev) || Math.abs(rsNow - rsPrev) >= FPB.RS_FLAT_MAX) return false;
    return true;
  };

  // Setup activity windows.
  let setupDaysIn22 = 0;
  for (let i = Math.max(0, L - FPB.BURST_PRIOR_LOOKBACK + 1); i <= L; i++) if (compressedAt(i)) setupDaysIn22++;
  let setupActiveRecent = false;
  for (let i = Math.max(0, L - FPB.SETUP_LOOKBACK + 1); i <= L; i++) { if (compressedAt(i)) { setupActiveRecent = true; break; } }
  let setupActivePrior = false;
  for (let i = Math.max(0, L - FPB.BURST_PRIOR_LOOKBACK); i <= L - 1; i++) { if (compressedAt(i)) { setupActivePrior = true; break; } }

  // Burst metrics for today (L), measured against pre-burst (ending yesterday) norms.
  const vol22Prior = fpbMean(vol, L - 1, 22);
  const volBurst = vol22Prior > 0 ? vol[L] / vol22Prior : NaN;
  const avgRange15Prior = fpbMean(rangeArr, L - 1, 15);
  const rangeExp = avgRange15Prior > 0 ? rangeArr[L] / avgRange15Prior : NaN;
  const dayRange = high[L] - low[L];
  const closeStrength = dayRange > 0 ? (close[L] - low[L]) / dayRange : 0;
  const hi10Prior = fpbMax(high, L - 10, L - 1);
  const lo10Prior = fpbMin(low, L - 10, L - 1);
  const delivToday = bars[L].delivery_pct != null ? Number(bars[L].delivery_pct) : null;

  // Burst = coil releases UP: wide/high-volume candle closing near its high,
  // above the 10-day range. Shatter = the mirror DOWN release: closes near its
  // low, below the 10-day range. Same energy gate (vol/range/delivery), opposite
  // resolution. Mutually exclusive (close can't be both >hi10 and <lo10).
  const releaseEnergy =
    setupActivePrior &&
    close[L] > FPB.MIN_CLOSE &&
    volBurst >= FPB.VOL_BURST_MIN &&
    rangeExp >= FPB.RANGE_EXP_MIN &&
    (delivToday ?? 0) > FPB.DELIVERY_MIN;
  const isBurst =
    releaseEnergy && closeStrength >= FPB.CLOSE_STRENGTH_MIN && close[L] > hi10Prior;
  const isShatter =
    releaseEnergy && closeStrength <= (1 - FPB.CLOSE_STRENGTH_MIN) && close[L] < lo10Prior;
  const isRelease = isBurst || isShatter;

  const phase: 'BURST' | 'SHATTER' | 'SETUP' | null =
    isBurst ? 'BURST' : isShatter ? 'SHATTER' : (setupActiveRecent ? 'SETUP' : null);
  if (!phase) return null;

  // Display-side compression metrics (as of the latest bar) for scoring/UI.
  const atr15L = fpbMean(tr, L, 15), atr60L = fpbMean(tr, L, 60);
  const atrComp = atr60L > 0 ? atr15L / atr60L : null;
  const vol5L = fpbMean(vol, L, 5), vol22L = fpbMean(vol, L, 22);
  const volDeath = vol22L > 0 ? vol5L / vol22L : null;
  const hi10L = fpbMax(high, L - 9, L), lo10L = fpbMin(low, L - 9, L);
  const rangePctL = close[L] > 0 ? (hi10L - lo10L) / close[L] : null;
  const compressionScore =
    (atrComp != null ? 1 - atrComp : 0) +
    (volDeath != null ? 1 - volDeath : 0) +
    (rangePctL != null ? 1 - rangePctL / FPB.RANGE_PCT_MAX : 0);
  // Release quality — burst rewards a strong close (near high), shatter rewards a
  // weak close (near low). Same volume/range/delivery magnitude either way.
  const fpbQuality = isBurst
    ? (volBurst / FPB.VOL_BURST_MIN) * (rangeExp / FPB.RANGE_EXP_MIN) * closeStrength * ((delivToday ?? 50) / 50)
    : isShatter
    ? (volBurst / FPB.VOL_BURST_MIN) * (rangeExp / FPB.RANGE_EXP_MIN) * (1 - closeStrength) * ((delivToday ?? 50) / 50)
    : null;

  const b = bars[L];
  const ema20 = b.ema_20 != null ? Number(b.ema_20) : null;
  const atr14 = b.atr_14 != null ? Number(b.atr_14) : null;
  return {
    equity_id: b.equity_id,
    symbol: sym?.symbol ?? String(b.equity_id),
    company_name: sym?.company_name ?? null,
    industry: sym?.industry ?? null,
    exchange: sym?.exchange ?? null,
    mcap_cr: sym?.mcap_cr ?? null,
    trade_date: b.trade_date,
    close: close[L],
    open: open[L] ?? null,
    high: high[L] ?? null,
    low: low[L] ?? null,
    pct_chng: b.pct_chng ?? null,
    magic_rs: b.magic_rs ?? null,
    magic_rs_zone: b.magic_rs_zone ?? null,
    rss_value: null, rss_spread: null,
    rsi_14: b.rsi_14 ?? null,
    rvol: b.rvol ?? null,
    flow_type: b.flow_type ?? null,
    supertrend_dir: null,
    sma_50: b.sma_50 ?? null,
    sma_150: b.sma_150 ?? null,
    sma_200: b.sma_200 ?? null,
    ema_20: ema20,
    atr_14: atr14,
    w52_high: b.w52_high ?? null,
    w52_low: b.w52_low ?? null,
    lifetime_high: null,
    avg_amt_5d: null, avg_amt_22d: null, avg_amt_66d: null, delivery_surge_x: null,
    sniper_inst: b.sniper_inst ?? null,
    sniper_hot: b.sniper_hot ?? null,
    accum_distrib: b.accum_distrib ?? null,
    volume_divergence_flag: null,
    delivery_pct: delivToday,
    deliv_value_cr: b.deliv_value_cr ?? null,
    has_recent_svd: false, has_recent_sbd: false, has_recent_syd: false,
    pctBelow52wHigh: null,
    reward: ema20 && atr14 ? (ema20 + atr14) - close[L] : null,
    rewardPct: ema20 && atr14 && atr14 > 0 ? ((ema20 + atr14) - close[L]) / atr14 : null,
    magicRsTrend: [],
    score_5d: b.score_5d != null ? Number(b.score_5d) : null,
    score_22d: null,
    xAmt: null,
    rel_5d_n50: null, rel_22d_n50: null, rel_66d_n50: null,
    rel_5d_n500: null, rel_22d_n500: null, rel_66d_n500: null,
    // BURST (upward release) is the ✦ highlight for the cross-scan strength board.
    vaniOpportunity: isBurst,
    stage: b.stage ?? null,
    d_pct: b.pct_chng != null ? Math.round(Number(b.pct_chng) * 100) / 100 : null,
    fpb_phase: phase,
    fpb_quality: fpbQuality != null ? Math.round(fpbQuality * 100) / 100 : null,
    fpb_compression_score: Math.round(compressionScore * 100) / 100,
    // Release-only metrics (burst or shatter) — blank on coiling rows.
    fpb_vol_burst: isRelease && Number.isFinite(volBurst) ? Math.round(volBurst * 10) / 10 : null,
    fpb_range_exp: isRelease && Number.isFinite(rangeExp) ? Math.round(rangeExp * 10) / 10 : null,
    fpb_close_strength: isRelease ? Math.round(closeStrength * 100) / 100 : null,
    fpb_atr_compression: atrComp != null ? Math.round(atrComp * 100) / 100 : null,
    fpb_vol_death: volDeath != null ? Math.round(volDeath * 100) / 100 : null,
    fpb_setup_days: setupDaysIn22,
  };
}

/** Map a km_scan_results row (preset_id='flower_pot_burst') to a ScanStock. */
function fpbRowToScanStock(r: any): ScanStock {
  const num = (v: any) => (v == null ? null : Number(v));
  return {
    equity_id: r.equity_id,
    symbol: r.symbol ?? String(r.equity_id),
    company_name: r.company_name ?? null,
    industry: r.industry ?? null,
    exchange: r.exchange ?? null,
    mcap_cr: num(r.mcap_cr),
    trade_date: r.trade_date,
    close: Number(r.close),
    open: null, high: null, low: null,
    pct_chng: num(r.pct_chng),
    magic_rs: num(r.magic_rs),
    magic_rs_zone: r.magic_rs_zone ?? null,
    rss_value: null, rss_spread: null,
    rsi_14: null,
    rvol: num(r.rvol),
    flow_type: null,
    supertrend_dir: null,
    sma_50: null, sma_150: null, sma_200: null,
    ema_20: null, atr_14: null,
    w52_high: null, w52_low: null, lifetime_high: null,
    avg_amt_5d: null, avg_amt_22d: null, avg_amt_66d: null, delivery_surge_x: null,
    sniper_inst: null, sniper_hot: null,
    accum_distrib: null, volume_divergence_flag: null,
    delivery_pct: num(r.delivery_pct),
    deliv_value_cr: null,
    has_recent_svd: false, has_recent_sbd: false, has_recent_syd: false,
    pctBelow52wHigh: null,
    reward: null, rewardPct: null,
    magicRsTrend: [],
    score_5d: null, score_22d: null,
    xAmt: null,
    rel_5d_n50: null, rel_22d_n50: null, rel_66d_n50: null,
    rel_5d_n500: null, rel_22d_n500: null, rel_66d_n500: null,
    vaniOpportunity: r.fpb_phase === 'BURST',
    stage: r.stage ?? null,
    d_pct: r.pct_chng != null ? Math.round(Number(r.pct_chng) * 100) / 100 : null,
    fpb_phase: r.fpb_phase ?? null,
    fpb_quality: num(r.fpb_quality),
    fpb_compression_score: num(r.fpb_compression_score),
    fpb_vol_burst: num(r.fpb_vol_burst),
    fpb_range_exp: num(r.fpb_range_exp),
    fpb_close_strength: num(r.fpb_close_strength),
    fpb_atr_compression: num(r.fpb_atr_compression),
    fpb_vol_death: num(r.fpb_vol_death),
    fpb_setup_days: num(r.fpb_setup_days),
  };
}

// ── Flower Pot — Day-2 position state (km_fpb_active, migration 156) ──────────
export interface FpbActiveRow {
  equity_id: number;
  symbol: string;
  direction: 'UP' | 'DOWN';
  release_date: string;
  release_close: number | null;
  release_midpoint: number | null;
  sl_level: number | null;
  target_level: number | null;
  quality: number | null;
  status: string; // ACTIVE | HOLDING | CRACKED | TARGET_HIT | STOPPED | EXPIRED
  last_eval_date: string | null;
  last_close: number | null;
}

/** Recent Flower Pot releases + their day-2 hold/crack verdict and stop/target.
 *  Returns [] gracefully if km_fpb_active isn't deployed yet. */
export async function fetchFpbActive(): Promise<FpbActiveRow[]> {
  // 60d so the Day-2 strip doubles as a recent release track-record (once
  // km_fpb_active is backfilled), not just the last few live sessions.
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const { data, error } = await from('km_fpb_active')
      .select('equity_id,symbol,direction,release_date,release_close,release_midpoint,sl_level,target_level,quality,status,last_eval_date,last_close')
      .gte('release_date', cutoff)
      .order('release_date', { ascending: false })
      .limit(100)
      .execute();
    if (error || !Array.isArray(data)) return [];
    return data as FpbActiveRow[];
  } catch {
    return [];
  }
}

async function fetchFlowerPotBurst(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  // FPB is an NSE-universe scan; BSE-only returns nothing.
  if (exchangeFilter === 'BSE') return [];

  // Primary path: read the DB matview km_scan_results (migration 147, preset
  // 'flower_pot_burst'). The DB does the compression/burst compute and the
  // pipeline's scan_refresh step keeps it current, so the browser transfers only
  // the signal rows. Falls back to the client-side compute below ONLY when the
  // matview isn't deployed yet (transitional — remove once 147 is live).
  try {
    const { data, error } = await from('km_scan_results')
      .select('*')
      .eq('preset_id', 'flower_pot_burst')
      .order('rank', { ascending: true })
      .limit(500)
      .execute();
    if (!error && Array.isArray(data)) {
      return (data as any[]).map(fpbRowToScanStock);
    }
    console.warn('[flower_pot_burst] km_scan_results unavailable — using client-side fallback', error);
  } catch (e) {
    console.warn('[flower_pot_burst] km_scan_results read failed — using client-side fallback', e);
  }
  return fetchFlowerPotBurstClientSide(exchangeFilter);
}

async function fetchFlowerPotBurstClientSide(exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  // Transitional fallback — only runs if km_scan_results (migration 147) is not
  // deployed. Fetches ~72 sessions of NSE EOD and computes compression/burst in
  // the browser. Slower; the matview path above supersedes it.
  if (exchangeFilter === 'BSE') return [];

  const dates = await fetchRecentDates(FPB.MIN_BARS + 12); // ~72 sessions
  if (dates.length < FPB.MIN_BARS + 1) return [];
  const latestDate = dates[0];
  const cutoff = dates[dates.length - 1];

  const symRes = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry,exchange,isin,mcap_cr')
    .is('is_active', 'true')
    .eq('exchange', 'NSE')
    .limit(8000)
    .execute();
  const syms = (symRes.data ?? []) as EquitySymbolRow[];
  const symMap = new Map<number, EquitySymbolRow>();
  const ids: number[] = [];
  for (const s of syms) { symMap.set(s.id, s); ids.push(s.id); }
  if (ids.length === 0) return [];

  const COLS = 'equity_id,trade_date,open,high,low,close,prev_close,volume,magic_rs,magic_rs_zone,delivery_pct,rsi_14,rvol,ema_20,atr_14,sma_50,sma_150,sma_200,w52_high,w52_low,stage,score_5d,flow_type,sniper_inst,sniper_hot,pct_chng,accum_distrib,deliv_value_cr';
  const CHUNK = 400;
  const idChunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) idChunks.push(ids.slice(i, i + CHUNK));

  const chunkRes = await Promise.all(idChunks.map((chunk) =>
    from('km_equity_eod')
      .select(COLS)
      .in('equity_id', chunk)
      .gte('trade_date', cutoff)
      .lte('trade_date', latestDate)
      .order('trade_date', { ascending: true })
      .limit(60000)
      .execute()
  ));
  const rows = chunkRes.flatMap((r) => (r.data ?? [])) as any[];

  const hist = new Map<number, any[]>();
  for (const r of rows) {
    const arr = hist.get(r.equity_id) ?? [];
    arr.push(r);
    hist.set(r.equity_id, arr);
  }

  const out: ScanStock[] = [];
  for (const [id, bars] of hist) {
    bars.sort((a, b) => (a.trade_date < b.trade_date ? -1 : a.trade_date > b.trade_date ? 1 : 0));
    const stock = computeFpbStock(bars, symMap.get(id));
    if (stock) out.push(stock);
  }

  // Releases first (burst/shatter, by quality), then coiling setups (by tightness).
  const isRel = (s: ScanStock) => s.fpb_phase === 'BURST' || s.fpb_phase === 'SHATTER';
  out.sort((a, b) => {
    const pa = isRel(a) ? 0 : 1;
    const pb = isRel(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (pa === 0) return (b.fpb_quality ?? 0) - (a.fpb_quality ?? 0);
    return (b.fpb_compression_score ?? 0) - (a.fpb_compression_score ?? 0);
  });

  const lim = getPresetMeta('flower_pot_burst')?.limit ?? 60;
  return out.slice(0, lim);
}

// ── km_scan_results matview: the 6 bundle presets ─────────────────────────
//
// Migration 170 refreshed km_scan_results so its rows are what these six scans
// return. Daily reads pull the ranked rows directly (one ~150-row query per
// preset); the client-side JS scans + their EOD bundle were deleted in the
// follow-up cleanup, so a matview outage now surfaces as an explicit error
// rather than a silent slow-path downgrade.
//
// Weekly / monthly timeframes aren't in the matview yet — those return empty
// until km_scan_results grows a weekly/monthly variant.
const MATVIEW_BUNDLE_PRESETS: ReadonlySet<string> = new Set([
  'power_buy',
  'power_sell',
  'smart_money',
  'quiet_accumulation',
  'distribution_warning',
  'conviction_flow',
]);

// Waking Giants v4 (migration 177) — the three journey-state presets read the
// km_wg_journeys state table (the km_fpb_active pattern on a multi-year
// clock), NOT the scan matview. Map: preset id → journey state.
const WG_JOURNEY_PRESETS: Record<string, string> = {
  waking_giants: 'WAKING',
  wg_ascent: 'ASCENDING',
  wg_stirring: 'STIRRING',
};

// A wake is shown on the Waking tab only while fresh — the formation window
// where the breakout is still an observation about NOW.
const WAKING_FRESH_DAYS = 90;

/** Map a km_wg_journeys row to a ScanStock (display fields are stamped
 *  denormalized on the row by compute_wg_journeys.py). */
function wgJourneyRowToScanStock(r: any): ScanStock {
  const num = (v: any) => (v == null ? null : Number(v));
  const truthy = (v: any) => v === true || v === 't' || v === 'true' || v === 1;
  return {
    equity_id: r.equity_id,
    symbol: r.symbol ?? String(r.equity_id),
    company_name: r.company_name ?? null,
    industry: r.industry ?? null,
    exchange: r.exchange ?? null,
    mcap_cr: num(r.mcap_cr),
    trade_date: r.trade_date,
    close: Number(r.close ?? 0),
    open: null, high: null, low: null,
    pct_chng: num(r.pct_chng),
    rsi_14: null,
    magic_rs: num(r.magic_rs),
    magic_rs_zone: r.magic_rs_zone ?? null,
    flow_type: null, rvol: null, sniper_inst: null, sniper_hot: null,
    accum_distrib: null, rss_value: null, rss_spread: null,
    sma_150: null, volume_divergence_flag: null,
    has_recent_svd: false, has_recent_sbd: false, has_recent_syd: false,
    ema_20: null, atr_14: null,
    delivery_pct: num(r.delivery_pct),
    w52_high: null, sma_50: null, sma_200: null, w52_low: null,
    supertrend_dir: null, lifetime_high: null, stage: null,
    xAmt: null,
    rel_5d_n50: null, rel_22d_n50: null, rel_66d_n50: null,
    rel_5d_n500: null, rel_22d_n500: null, rel_66d_n500: null,
    magicRsTrend: [], reward: null, rewardPct: null, pctBelow52wHigh: null,
    vaniOpportunity: false,
    avg_amt_5d: null, avg_amt_22d: null, avg_amt_66d: null,
    // journey fields
    wg_phase: r.state ?? null,
    gl_acc_days: num(r.stir_days),
    listing_age_years: num(r.listing_age_years),
    pct_from_3y_high: num(r.pct_from_base_high),
    days_since_3y_high: null,
    drawdown_3y_pct: null,
    base_years: num(r.base_years),
    align_score: num(r.align_score),
    journey_age_days: num(r.journey_age_days),
    wg_resting: truthy(r.resting),
    wake_date: r.wake_date ?? null,
    gl_dist_pct: num(r.gl_dist_pct),
  };
}

/** One journey-state tab = one indexed read of km_wg_journeys. */
async function fetchWgJourneys(presetId: string, exchangeFilter: ExchangeFilter): Promise<ScanStock[]> {
  if (exchangeFilter === 'BSE') return [];
  const state = WG_JOURNEY_PRESETS[presetId];
  // QueryBuilder.order() appends the direction itself — pass the bare column.
  const orderCol =
    state === 'WAKING'    ? 'wake_date' :      // freshest wakes first
    state === 'ASCENDING' ? 'align_score' :    // strongest alignment first
                            'stir_days';       // strongest quiet building first
  const lim = getPresetMeta(presetId)?.limit ?? 60;
  let q = from('km_wg_journeys')
    .select('*')
    .is('is_current', 'true')
    .eq('state', state);
  if (state === 'WAKING') {
    // The Waking tab is an OPPORTUNITY feed, not a history lesson (owner
    // 2026-08-24: a breakout from years ago is no opportunity now). Only
    // wakes still in their formation window are shown; older unconfirmed
    // journeys stay in the table but off the tab.
    const cutoff = new Date(Date.now() - WAKING_FRESH_DAYS * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    q = q.gte('wake_date', cutoff);
  }
  const { data, error } = await q
    .order(orderCol, { ascending: false, nullsFirst: false })
    .limit(lim)
    .execute();
  if (error || !Array.isArray(data)) {
    throw new Error(`km_wg_journeys unavailable for ${presetId} — run migration 177 + compute_wg_journeys.py`);
  }
  return (data as any[]).map(wgJourneyRowToScanStock);
}

/** Counts for the three journey tabs (landing page). */
async function fetchWgJourneyCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = { waking_giants: 0, wg_ascent: 0, wg_stirring: 0 };
  try {
    const { data, error } = await from('km_wg_journeys')
      .select('state,wake_date')
      .is('is_current', 'true')
      .limit(3000)
      .execute();
    if (error || !Array.isArray(data)) return counts;
    const cutoff = new Date(Date.now() - WAKING_FRESH_DAYS * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    for (const r of data as any[]) {
      if (r.state === 'WAKING') {
        if (r.wake_date && r.wake_date >= cutoff) counts.waking_giants += 1;
      } else if (r.state === 'ASCENDING') counts.wg_ascent += 1;
      else if (r.state === 'STIRRING') counts.wg_stirring += 1;
    }
  } catch { /* table not deployed yet — zeros */ }
  return counts;
}

/** Map a km_scan_results row (one of the 6 bundle presets) to a ScanStock.
 *  Mirrors fpbRowToScanStock's shape; fields the matview does not carry for
 *  these presets stay null (they were null under the JS path too). */
function scanRowToScanStock(r: any): ScanStock {
  const num = (v: any) => (v == null ? null : Number(v));
  const truthy = (v: any) => v === true || v === 't' || v === 'true' || v === 1;
  const trendArr: Array<number | null> = Array.isArray(r.magic_rs_trend) ? r.magic_rs_trend : [];
  const magicRsTrend: (boolean | null)[] = trendArr.map((v) => (v == null ? null : v === 1));
  return {
    equity_id: r.equity_id,
    symbol: r.symbol ?? String(r.equity_id),
    company_name: r.company_name ?? null,
    industry: r.industry ?? null,
    exchange: r.exchange ?? null,
    mcap_cr: num(r.mcap_cr),
    trade_date: r.trade_date,
    close: Number(r.close),
    open: null, high: null, low: null,
    pct_chng: num(r.pct_chng),
    rsi_14: null,
    magic_rs: num(r.magic_rs),
    magic_rs_zone: r.magic_rs_zone ?? null,
    flow_type: r.flow_type ?? null,
    rvol: num(r.rvol),
    sniper_inst: num(r.sniper_inst),
    sniper_hot: null,
    accum_distrib: r.accum_distrib ?? null,
    rss_value: num(r.rss_value),
    rss_spread: null,
    sma_150: num(r.sma_150),
    volume_divergence_flag: r.volume_divergence_flag ?? null,
    has_recent_svd: truthy(r.has_recent_svd),
    has_recent_sbd: truthy(r.has_recent_sbd),
    has_recent_syd: truthy(r.has_recent_syd),
    ema_20: num(r.ema_20),
    atr_14: num(r.atr_14),
    delivery_pct: num(r.delivery_pct),
    delivery_surge_x: num(r.delivery_surge_x),
    avg_amt_22d: num(r.avg_amt_22d),
    avg_amt_5d: null,
    avg_amt_66d: null,
    w52_high: num(r.w52_high),
    sma_50: null,
    sma_200: null,
    w52_low: null,
    supertrend_dir: null,
    lifetime_high: null,
    stage: null,
    xAmt: num(r.xamt),
    rel_5d_n50:   num(r.rel_5d_n50),
    rel_22d_n50:  num(r.rel_22d_n50),
    rel_66d_n50:  num(r.rel_66d_n50),
    rel_5d_n500:  num(r.rel_5d_n500),
    rel_22d_n500: num(r.rel_22d_n500),
    rel_66d_n500: num(r.rel_66d_n500),
    magicRsTrend,
    reward:    num(r.reward),
    rewardPct: num(r.reward_pct),
    pctBelow52wHigh: num(r.pct_below_52w_high),
    vaniOpportunity: truthy(r.vani_flag),
    // Preset-specific (populated where applicable, null elsewhere)
    ret_5d:  num(r.ret_5d),
    ret_22d: num(r.ret_22d),
    ret_66d: num(r.ret_66d),
    d_pct:   num(r.d_pct),
    deliv_value_cr: num(r.deliv_value_cr),
    // Waking Giants / First Ascent (migration 175; null for other presets)
    wg_phase: r.wg_phase ?? null,
    gl_acc_days: num(r.gl_acc_days),
    listing_age_years: num(r.listing_age_years),
    pct_from_3y_high: num(r.pct_from_3y_high),
    days_since_3y_high: num(r.days_since_3y_high),
    drawdown_3y_pct: num(r.drawdown_3y_pct),
  };
}

/** Combined-mode dedup on raw matview rows (isin+exchange+vani_flag are on the row).
 *  Same policy as deduplicateByIsin: prefer vaniOpportunity, then NSE. */
function dedupeMatviewRowsByIsin(rows: any[]): any[] {
  const seen = new Map<string, any>();
  for (const r of rows) {
    const isin = r.isin;
    if (!isin) continue;
    const existing = seen.get(isin);
    if (!existing) {
      seen.set(isin, r);
      continue;
    }
    const rVani = r.vani_flag === true;
    const eVani = existing.vani_flag === true;
    const rWins = (rVani && !eVani)
      || (rVani === eVani && r.exchange === 'NSE' && existing.exchange !== 'NSE');
    if (rWins) seen.set(isin, r);
  }
  return [...seen.values()];
}

/** Matview-first fetch for the 6 bundle presets. Returns null on any failure
 *  so the caller can fall back to the JS bundle path. */
async function fetchFromScanMatview(
  presetId: string,
  exchangeFilter: ExchangeFilter,
): Promise<ScanStock[] | null> {
  try {
    const { data, error } = await from('km_scan_results')
      .select('*')
      .eq('preset_id', presetId)
      .order('rank', { ascending: true })
      .limit(500)
      .execute();
    if (error || !Array.isArray(data)) {
      console.warn(`[scan] ${presetId}: matview unavailable, using bundle fallback`, error);
      return null;
    }
    let rows = data as any[];
    if (exchangeFilter === 'combined') {
      rows = dedupeMatviewRowsByIsin(rows);
    } else {
      rows = rows.filter((r) => r.exchange === exchangeFilter);
    }
    return rows.map(scanRowToScanStock);
  } catch (e) {
    console.warn(`[scan] ${presetId}: matview read failed, using bundle fallback`, e);
    return null;
  }
}

/** One-query per-preset counts across all 6 bundle presets. Returns null on
 *  failure so getAllScanCounts falls back to bundle iteration. */
async function fetchAllScanCountsFromMatview(
  exchangeFilter: ExchangeFilter,
): Promise<{ counts: Record<string, number>; latestDate: string | null } | null> {
  try {
    const { data, error } = await from('km_scan_results')
      .select('preset_id,exchange,isin,vani_flag,trade_date')
      .in('preset_id', [...MATVIEW_BUNDLE_PRESETS])
      .limit(2000)
      .execute();
    if (error || !Array.isArray(data)) {
      console.warn('[scan] matview counts unavailable, using bundle fallback', error);
      return null;
    }
    const rows = data as any[];
    const perPreset = new Map<string, any[]>();
    for (const r of rows) {
      const arr = perPreset.get(r.preset_id) ?? [];
      arr.push(r);
      perPreset.set(r.preset_id, arr);
    }
    const counts: Record<string, number> = {};
    let latestDate: string | null = null;
    for (const [presetId, presetRows] of perPreset) {
      const filtered = exchangeFilter === 'combined'
        ? dedupeMatviewRowsByIsin(presetRows)
        : presetRows.filter((r) => r.exchange === exchangeFilter);
      counts[presetId] = filtered.length;
      const d = presetRows[0]?.trade_date as string | undefined;
      if (d && (!latestDate || d > latestDate)) latestDate = d;
    }
    // Presets with zero matview rows still need a 0 entry so the landing UI
    // doesn't read them as "unknown".
    for (const id of MATVIEW_BUNDLE_PRESETS) {
      if (!(id in counts)) counts[id] = 0;
    }
    // Journey-tab counts ride along (separate table, graceful zeros pre-177).
    Object.assign(counts, await fetchWgJourneyCounts());
    return { counts, latestDate };
  } catch (e) {
    console.warn('[scan] matview counts read failed, using bundle fallback', e);
    return null;
  }
}

export async function executeScan(
  scanId: string,
  exchangeFilter: ExchangeFilter = 'combined',
  timeframe: ScanTimeframe = 'daily',
  date: string = '',
): Promise<ScanStock[]> {
  // Direct DB query scans — skip bundle entirely
  if (scanId === 'volume_drive')         return fetchVolumeDrive(exchangeFilter);
  if (scanId === 'flower_pot_burst')     return fetchFlowerPotBurst(exchangeFilter);
  if (scanId === 'stage_2_leaders')      return fetchStage2Leaders(exchangeFilter);
  if (scanId === 'stage_2_watch')        return fetchStage2Watch(exchangeFilter);
  if (scanId === 'stage_4_leaders')      return fetchStage4Leaders(exchangeFilter);
  if (scanId === 'stage_3_watch')        return fetchStage3Watch(exchangeFilter);
  if (scanId === 'vani_exit_watch')      return fetchVaNiExitWatch(exchangeFilter);
  // breakout_surge_daily merged into breakout_surge (kept as alias for stale links)
  if (scanId === 'breakout_surge' || scanId === 'breakout_surge_daily') return fetchBreakoutSurge(exchangeFilter);

  // The 6 daily bundle presets read from km_scan_results (Phase 3). The old
  // client-side bundle path was deleted in the follow-up cleanup — a matview
  // failure now surfaces to React Query as an explicit error instead of
  // silently downgrading, so an ops issue (nightly refresh failed, migration
  // rolled back) is visible on the scan page rather than hidden by a slow
  // parallel compute.
  // Waking Giants v4 journey tabs — km_wg_journeys reads (migration 177).
  if (scanId in WG_JOURNEY_PRESETS) return fetchWgJourneys(scanId, exchangeFilter);

  if (timeframe === 'daily' && MATVIEW_BUNDLE_PRESETS.has(scanId)) {
    const matview = await fetchFromScanMatview(scanId, exchangeFilter);
    if (matview) return matview;
    throw new Error(`Scan matview unavailable for ${scanId} — check pipeline scan_refresh step`);
  }

  throw new Error(`Unknown scan: ${scanId}`);
}

// ── VaNi Highlights board (Workspace · Discovery) ──────────────

export interface VaniHighlightRow {
  equity_id: number;
  symbol: string;
  company_name: string | null;
  score_5d: number | null;
  rs_percentile?: number | null;
  /** Short labels of the scans that flagged this stock — >1 = cross-scan confluence. */
  scans: string[];
}

export interface VaniHighlights {
  strength: VaniHighlightRow[];
  caution: VaniHighlightRow[];
  strengthTotal: number;
  cautionTotal: number;
  /** Trade date the scans evaluated (bundle latestDate) — the board shows it
   * so persistent names read as conviction, not staleness. */
  asOf: string | null;
}

/**
 * Union of ✦ VaNi Highlights across all scanners, deduped per side.
 * A stock flagged by multiple scans carries all their labels — cross-scan
 * confluence is the strongest observation this board makes, so both sides
 * rank by flag count first, then by conviction (strength) / weakness (caution).
 *
 * The scanner list is DB-driven (kd_scan_presets.vani_side/vani_short_label/
 * vani_cap — migration 161), not hardcoded here. Owner instruction: new
 * scanners get added and old ones retired over time, and a hardcoded array
 * silently drifts (this file used to carry a comment documenting two
 * presets someone had to remember to manually remove). Opting a preset into
 * Discovery — or pulling one out — is now a DB update, not a code deploy.
 * vani_side IS NULL means "not on Discovery" (opt-in default for new
 * presets); is_active = false (already enforced by fetchScanPresets'
 * WHERE clause) removes a retired preset automatically too.
 */
export async function fetchVaniHighlights(): Promise<VaniHighlights> {
  const allPresets = await fetchScanPresets();
  const sources = allPresets.filter(
    (p): p is ScanDefinition & { vani_side: 'strength' | 'caution' } => p.vani_side != null,
  );

  if (sources.length === 0) {
    return { strength: [], caution: [], strengthTotal: 0, cautionTotal: 0, asOf: null };
  }

  // All bundle-preset scans read from km_scan_results now (Phase 3), so firing
  // them in parallel no longer triggers concurrent full-market downloads —
  // each is a single ~150-row matview query.
  const settled = await Promise.allSettled(
    sources.map((src) => executeScan(src.id)),
  );

  const buckets: Record<'strength' | 'caution', Map<number, VaniHighlightRow>> = {
    strength: new Map(),
    caution: new Map(),
  };

  settled.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const src = sources[i];
    const label = src.vani_short_label ?? src.name;
    let rows = res.value.filter((s) => s.vaniOpportunity);
    if (src.vani_cap != null) rows = rows.slice(0, src.vani_cap);
    const bucket = buckets[src.vani_side];
    for (const s of rows) {
      const existing = bucket.get(s.equity_id);
      if (existing) {
        if (!existing.scans.includes(label)) existing.scans.push(label);
        if (existing.score_5d == null && s.score_5d != null) existing.score_5d = s.score_5d;
        if (existing.rs_percentile == null && s.rs_percentile != null) existing.rs_percentile = s.rs_percentile;
      } else {
        bucket.set(s.equity_id, {
          equity_id: s.equity_id,
          symbol: s.symbol,
          company_name: s.company_name ?? null,
          score_5d: s.score_5d ?? null,
          rs_percentile: s.rs_percentile ?? null,
          scans: [label],
        });
      }
    }
  });

  const strength = [...buckets.strength.values()].sort(
    (a, b) => b.scans.length - a.scans.length || (b.score_5d ?? -1) - (a.score_5d ?? -1),
  );
  const caution = [...buckets.caution.values()].sort(
    (a, b) => b.scans.length - a.scans.length || (a.rs_percentile ?? 101) - (b.rs_percentile ?? 101),
  );

  // asOf: any fulfilled result carries the matview's trade_date; take the
  // first available. All scans share the same latest date so which one we
  // read from doesn't matter.
  let asOf: string | null = null;
  for (const res of settled) {
    if (res.status === 'fulfilled' && res.value[0]?.trade_date) {
      asOf = res.value[0].trade_date;
      break;
    }
  }

  return {
    strength,
    caution,
    strengthTotal: strength.length,
    cautionTotal: caution.length,
    asOf,
  };
}

/** Invalidate scan data cache (call after data refresh). No-op now that the
 *  scan engine holds no in-memory bundles — React Query owns the cache. */
export function invalidateScanCache(): void {
  /* intentionally empty — see docstring */
}

/** Fetch scan preset definitions from the DB (via pipeline API). */
export async function fetchScanPresets(): Promise<ScanDefinition[]> {
  const res = await fetch(`${PIPELINE_URL}/api/scan/presets`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{
    id: string;
    name: string;
    description: string | null;
    tooltip: string | null;
    sort_order: number;
    result_limit: number;
    universe: string;
    category: string;
    category_label: string;
    category_color: string;
    category_sort: number;
    is_default_tab: boolean | null;
    timeframe: string;
    vani_rule: string | null;
    vani_side: 'strength' | 'caution' | null;
    vani_short_label: string | null;
    vani_cap: number | null;
  }>;
  const presets = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    tooltip: r.tooltip ?? undefined,
    limit: r.result_limit,
    universe: (r.universe === 'NSE_ONLY' || r.universe === 'NSE_BSE') ? r.universe : 'NSE_BSE',
    category: r.category ?? '',
    category_label: r.category_label ?? '',
    category_color: r.category_color ?? '',
    category_sort: r.category_sort ?? 99,
    is_default_tab: r.is_default_tab ?? false,
    timeframe: (r.timeframe === 'weekly' || r.timeframe === 'monthly') ? r.timeframe : 'daily',
    vani_rule: r.vani_rule ?? null,
    vani_side: r.vani_side ?? null,
    vani_short_label: r.vani_short_label ?? null,
    vani_cap: r.vani_cap ?? null,
  })) as ScanDefinition[];
  // Refresh the engine-wide metadata cache — getPresetMeta() serves these.
  _dbPresetMeta.clear();
  for (const p of presets) _dbPresetMeta.set(p.id, p);
  return presets;
}

export interface ScanCountsResult {
  counts: Record<string, number>;
  latestDate: string | null;
}

/** Return result counts for the 6 bundle scans — matview-first, one query. */
export async function getAllScanCounts(
  exchangeFilter: ExchangeFilter = 'combined',
  timeframe: ScanTimeframe = 'daily',
): Promise<ScanCountsResult> {
  // Daily reads use the matview (one small aggregate query for all 6 presets).
  // A matview failure surfaces as an error rather than a silent fallback so
  // ops sees a broken landing page instead of a slow one that hides the issue.
  // Weekly / monthly counts aren't in the matview yet — return empty until
  // that timeframe lands in km_scan_results.
  if (timeframe === 'daily') {
    const mv = await fetchAllScanCountsFromMatview(exchangeFilter);
    if (mv) return mv;
    throw new Error('Scan matview counts unavailable — check pipeline scan_refresh step');
  }
  return { counts: {}, latestDate: null };
}

// ── Manipulation Watch ────────────────────────────────────────
// Separate from scanner presets — safety feature, not opportunity.
// No industry filter: manipulation can happen anywhere.
// Scans across a date range (default 30 trading days) to catch
// patterns that play out over days/weeks.

export interface ManipulationWatchStock extends ScanStock {
  whyFlagged: string[];
  triggerDates: string[];   // dates where conditions were met (desc order)
  triggerCount: number;     // how many days in range the stock triggered
  latestTrigger: string;    // most recent trigger date
}

export interface ManipulationWatchResult {
  pumpSuspects: ManipulationWatchStock[];
  dumpSuspects: ManipulationWatchStock[];
  latestDate: string | null;
  lookbackDays: number;
}

// Separate cache for manipulation watch (wider date range than scanner)
const CACHE_TTL = 3 * 60 * 1000; // 3 min
let _mwCache: { data: ManipulationWatchBundle; fetchedAt: number; lookback: number } | null = null;

interface ManipulationWatchBundle {
  symbols: Map<number, EquitySymbolRow>;
  // equity_id → array of snapshots sorted by date desc
  eodHistory: Map<number, EquityEodSnapshot[]>;
  tradeDates: string[]; // all trade dates in range, desc order
}

async function loadManipulationData(lookbackDays: number): Promise<ManipulationWatchBundle> {
  if (_mwCache && Date.now() - _mwCache.fetchedAt < CACHE_TTL && _mwCache.lookback === lookbackDays) {
    return _mwCache.data;
  }

  // Fetch lookback + 6 dates (extra for sniper slope calculation)
  const dates = await fetchRecentDates(lookbackDays + 6);
  if (dates.length === 0) {
    return { symbols: new Map(), eodHistory: new Map(), tradeDates: [] };
  }

  const oldestDate = dates[dates.length - 1];

  const [symbolRes, eodRes] = await Promise.all([
    from('km_equity_symbols')
      .select('id,symbol,company_name,industry,exchange,isin,is_active,mcap_cr')
      .is('is_active', 'true')
      .limit(8000)
      .execute(),

    from('km_equity_eod')
      .select('equity_id,trade_date,open,high,low,close,prev_close,pct_chng,volume,value_cr,rvol,tvol,rsi_14,magic_rs,magic_rs_zone,flow_type,accum_distrib,sniper_inst,sniper_hot,rss_value,rss_spread,sma_150,volume_divergence_flag')
      .gte('trade_date', oldestDate)
      .order('trade_date', { ascending: false })
      .limit(lookbackDays * 8000) // ~8K equities × N days
      .execute(),
  ]);

  const symbols = new Map<number, EquitySymbolRow>();
  for (const s of (symbolRes.data ?? []) as EquitySymbolRow[]) {
    symbols.set(s.id, s);
  }

  const eodHistory = new Map<number, EquityEodSnapshot[]>();
  for (const r of (eodRes.data ?? []) as EquityEodSnapshot[]) {
    const arr = eodHistory.get(r.equity_id) ?? [];
    arr.push(r);
    eodHistory.set(r.equity_id, arr);
  }

  const bundle: ManipulationWatchBundle = {
    symbols,
    eodHistory,
    tradeDates: dates.slice(0, lookbackDays), // only the lookback range (not the buffer dates)
  };

  _mwCache = { data: bundle, fetchedAt: Date.now(), lookback: lookbackDays };
  return bundle;
}

/**
 * Eligibility gate — manipulation requires operator capability.
 * Large-caps with deep float can't be operator-pumped/dumped.
 *
 * Uses value_cr (daily turnover in true Crores on both exchanges) when available.
 * Falls back to volume × close proxy when value_cr is NULL.
 *
 * Before migration 167, NSE value_cr was inflated 1e5x, so `turnover <= 25` was
 * false for every NSE stock and this returned false for the entire NSE universe —
 * Manipulation Watch could only ever flag BSE rows. Fixed at source; no
 * exchange-aware branch is needed here.
 *
 *   > 25 cr daily = too liquid for operator manipulation
 *   < 1 cr daily = untradeable noise
 */
function isOperatorEligible(eod: EquityEodSnapshot): boolean {
  const turnover = eod.value_cr;

  if (turnover != null && turnover > 0) {
    return turnover >= 1 && turnover <= 25;
  }

  // Fallback: compute turnover proxy from volume × close
  const proxyCr = ((eod.volume ?? 0) * eod.close) / 1e7;
  return proxyCr >= 1 && proxyCr <= 25;
}

/** Check pump conditions for a single EOD snapshot */
function isPumpSignal(eod: EquityEodSnapshot): boolean {
  if (!isOperatorEligible(eod)) return false;
  return (
    (eod.rss_value ?? 0) > 75 &&
    (eod.rss_spread ?? 0) < -200 &&
    eod.flow_type === 'SHORT_COVERING' &&
    eod.volume_divergence_flag === 'VOLUME_DIV_UP'
  );
}

/** Check dump conditions for a single EOD snapshot.
 *  sniper_slope check removed — sniper_inst is structurally floored at 0
 *  for oversold stocks (derived from RSI-9 above 61). See LESSONS_LEARNED. */
function isDumpSignal(eod: EquityEodSnapshot): boolean {
  if (!isOperatorEligible(eod)) return false;
  if ((eod.rss_value ?? 100) >= 25) return false;
  if (eod.flow_type !== 'LONG_LIQUIDATION') return false;
  if (eod.volume_divergence_flag !== 'VOLUME_DIV_DOWN') return false;
  return true;
}

/** Build why-flagged tags for a pump signal */
function buildPumpTags(eod: EquityEodSnapshot): string[] {
  const rssVal = eod.rss_value ?? 0;
  const rssSpread = eod.rss_spread ?? 0;
  return [
    `RSS overbought (${Math.round(rssVal)})`,
    `Spread broken (${rssSpread > -1000 ? rssSpread.toFixed(0) : (rssSpread / 1000).toFixed(1) + 'K'})`,
    'Short covering',
    'Volume diverging up',
  ];
}

/** Build why-flagged tags for a dump signal */
function buildDumpTags(eod: EquityEodSnapshot): string[] {
  const rssVal = eod.rss_value ?? 0;
  return [
    `RSS oversold (${Math.round(rssVal)})`,
    'Long liquidation',
    'Volume diverging down',
  ];
}

/** Build a ScanStock-like object from any EOD snapshot (not just latest) */
function buildStockFromEod(
  equityId: number,
  eod: EquityEodSnapshot,
  history: EquityEodSnapshot[],
  sym: EquitySymbolRow,
): ScanStock {
  return {
    equity_id: equityId,
    symbol: sym.symbol,
    company_name: sym.company_name,
    industry: sym.industry,
    exchange: sym.exchange ?? null,
    close: eod.close,
    pct_chng: eod.pct_chng,
    rsi_14: eod.rsi_14,
    magic_rs: eod.magic_rs,
    magic_rs_zone: eod.magic_rs_zone,
    flow_type: eod.flow_type,
    rvol: eod.rvol,
    sniper_inst: eod.sniper_inst,
    accum_distrib: eod.accum_distrib,
    rss_value: eod.rss_value,
    rss_spread: eod.rss_spread,
    sma_150: eod.sma_150,
    volume_divergence_flag: eod.volume_divergence_flag,
    has_recent_svd: false,
    has_recent_sbd: false,
    has_recent_syd: false,
    sniper_hot: null,
    ema_20: null,
    atr_14: null,
    delivery_pct: null,
    w52_high: null,
    sma_50: null,
    sma_200: null,
    w52_low: null,
    supertrend_dir: null,
    lifetime_high: null,
    open: eod.open ?? null,
    high: eod.high ?? null,
    low: eod.low ?? null,
    mcap_cr: sym.mcap_cr ?? null,
    avg_amt_66d: null,
    xAmt: null,
    rel_5d_n50: null, rel_22d_n50: null, rel_66d_n50: null,
    rel_5d_n500: null, rel_22d_n500: null, rel_66d_n500: null,
    magicRsTrend: [],
    reward: null,
    rewardPct: null,
    pctBelow52wHigh: null,
    vaniOpportunity: false,
  };
}

/** Execute Manipulation Watch — scans across lookbackDays trading days */
export async function executeManipulationWatch(lookbackDays: number = 30): Promise<ManipulationWatchResult> {
  const bundle = await loadManipulationData(lookbackDays);

  // Track triggers per stock: equity_id → { dates, latestEod, tags }
  const pumpMap = new Map<number, { dates: string[]; eod: EquityEodSnapshot; tags: string[] }>();
  const dumpMap = new Map<number, { dates: string[]; eod: EquityEodSnapshot; tags: string[] }>();

  for (const [equityId, history] of bundle.eodHistory) {
    const sym = bundle.symbols.get(equityId);
    if (!sym) continue;

    // Iterate over each date in the lookback range
    for (let i = 0; i < history.length; i++) {
      const eod = history[i];
      if (!bundle.tradeDates.includes(eod.trade_date)) continue; // skip buffer dates

      // Check pump
      if (isPumpSignal(eod)) {
        const existing = pumpMap.get(equityId);
        if (existing) {
          existing.dates.push(eod.trade_date);
        } else {
          pumpMap.set(equityId, {
            dates: [eod.trade_date],
            eod, // first hit = most recent (history sorted desc)
            tags: buildPumpTags(eod),
          });
        }
      }

      // Check dump
      if (isDumpSignal(eod)) {
        const existing = dumpMap.get(equityId);
        if (existing) {
          existing.dates.push(eod.trade_date);
        } else {
          dumpMap.set(equityId, {
            dates: [eod.trade_date],
            eod,
            tags: buildDumpTags(eod),
          });
        }
      }
    }
  }

  // Convert to result arrays
  const buildResult = (
    map: Map<number, { dates: string[]; eod: EquityEodSnapshot; tags: string[] }>,
  ): ManipulationWatchStock[] => {
    const results: ManipulationWatchStock[] = [];
    for (const [equityId, trigger] of map) {
      const sym = bundle.symbols.get(equityId);
      if (!sym) continue;
      const history = bundle.eodHistory.get(equityId) ?? [];
      const stock = buildStockFromEod(equityId, trigger.eod, history, sym);
      results.push({
        ...stock,
        whyFlagged: trigger.tags,
        triggerDates: trigger.dates,
        triggerCount: trigger.dates.length,
        latestTrigger: trigger.dates[0],
      });
    }
    // Sort: most frequent triggers first, then by rvol
    return results
      .sort((a, b) => b.triggerCount - a.triggerCount || (b.rvol ?? 0) - (a.rvol ?? 0))
      .slice(0, 50); // higher limit for range scan
  };

  let pumpSuspects = buildResult(pumpMap);
  let dumpSuspects = buildResult(dumpMap);

  // Deduplicate by ISIN
  pumpSuspects = deduplicateByIsin(pumpSuspects, bundle.symbols) as ManipulationWatchStock[];
  dumpSuspects = deduplicateByIsin(dumpSuspects, bundle.symbols) as ManipulationWatchStock[];

  return {
    pumpSuspects,
    dumpSuspects,
    latestDate: bundle.tradeDates[0] ?? null,
    lookbackDays,
  };
}
