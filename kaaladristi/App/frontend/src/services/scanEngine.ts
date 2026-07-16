/**
 * Scan Engine — 6 Preset Market Scans
 * ====================================
 * Takes broad market data and applies filter/rank logic per scan.
 * All computation in TypeScript — no backend RPC needed for MVP.
 *
 * Vocabulary (KaalaDristi):
 *   "Smart Money"           — sniper_inst
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
  VaniOpportunityConfig,
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
  { id: 'flower_pot_burst',     name: 'Flower Pot Burst',      description: 'Stocks coiling in tight compression — dying volume, contracting range — plus the rare session when a coil releases with an explosive volume-and-range expansion',  limit: 60,  universe: 'NSE_ONLY', category: 'price_action',  category_label: 'Price Action',  category_color: '#f59e0b', category_sort: 1, is_default_tab: false, timeframe: 'daily', vani_rule: null },
  { id: 'stage_2_leaders',      name: 'Stage 2 Leaders',       description: 'Stocks in confirmed Weinstein Stage 2 — SMA200 rising, proper 52-week position',          limit: 500, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_s2' },
  { id: 'stage_2_watch',        name: 'Stage 2 Watch',         description: 'Stocks approaching Stage 2 — MA stacking confirmed, SMA200 not yet rising. Watch for Stage 2 breakout.', limit: 100, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: true, timeframe: 'daily', vani_rule: 'is_vani_s2' },
  { id: 'stage_4_leaders',      name: 'Stage 4 Leaders',       description: 'Confirmed downtrend — death cross, below both MAs',                                        limit: 200, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_weakness' },
  { id: 'stage_3_watch',        name: 'Stage 3 Watch',         description: 'Entering weakness — SMA50 converging toward SMA200',                                       limit: 100, universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'is_vani_weakness' },
  { id: 'vani_exit_watch',      name: 'VaNi Weakness Watch',   description: 'Highest conviction weakness — lowest RS, death cross confirmed',                            limit: 25,  universe: 'NSE_ONLY', category: 'stage_analysis', category_label: 'Stage Analysis', category_color: '#22c55e', category_sort: 2, is_default_tab: false, timeframe: 'daily', vani_rule: 'always_true' },
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

// ── Data Loading ───────────────────────────────────────────────

interface OppConfig {
  ema_atr_band: number;
  reward_min_atr_multiple: number;
  magic_rs_zones: string[];
  flow_types: string[];
  rvol_min: number;
}

const DEFAULT_OPP_CONFIG: OppConfig = {
  ema_atr_band: 2.5,  // raised from 1.0 — catches trending stocks up to 2.5×ATR above EMA20
  reward_min_atr_multiple: 0.0,
  magic_rs_zones: ['Strong Bull', 'Mild Bull'],
  flow_types: ['FRESH_LONGS', 'SHORT_COVERING'],
  rvol_min: 0.3,  // lowered — volume scale discontinuity bug suppresses rvol artificially
};

interface IndexReturn {
  ret_5d: number | null;
  ret_22d: number | null;
  ret_66d: number | null;
}

// Canonical magic_rs_zone bands the pipeline actually emits (migration 069),
// ordered bullish→bearish: Strong Bull > Mild Bull > Neutral Bull >
// Neutral Bear > Mild Bear > Strong Bear. Plain 'Neutral' is a legacy value
// kept in the DB CHECK constraint but no longer written — retained here so
// historical rows still validate. This set MUST match the zone keys in
// constants/signalScale.ts (ZONE_LABELS). Previously this listed only 5 bands
// and omitted Neutral Bull/Neutral Bear, which blanked ~47% of the universe to
// null (their real zone was discarded on every scan).
const VALID_ZONES = new Set([
  'Strong Bull', 'Mild Bull', 'Neutral Bull',
  'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear',
]);

interface ScanDataBundle {
  industries: IndustryEodRow[];
  industriesHistory: Map<string, IndustryEodRow[]>; // industry → rows by date desc
  symbols: Map<number, EquitySymbolRow>;
  latestEod: Map<number, EquityEodSnapshot>;
  eodHistory: Map<number, EquityEodSnapshot[]>; // equity_id → rows by date desc
  latestDate: string | null;
  oppConfigMap: Map<string, OppConfig>; // presetId → config
  nifty50Returns: IndexReturn | null;
  nifty500Returns: IndexReturn | null;
  timeframe: ScanTimeframe;
}

const _bundleCache = new Map<ScanTimeframe, { data: ScanDataBundle; fetchedAt: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 min
let _buildScanStockDebugCount = 0;

// Session-level config cache — presetId → OppConfig, fetched once per page load.
let _oppConfigCache: Map<string, OppConfig> | null = null;

async function fetchOpportunityConfig(): Promise<Map<string, OppConfig>> {
  if (_oppConfigCache) return _oppConfigCache;
  const map = new Map<string, OppConfig>();
  try {
    const res = await fetch(`${PIPELINE_URL}/api/vani-opportunity/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const configs = (await res.json()) as VaniOpportunityConfig[];
    console.log('[scanEngine] raw API configs:', configs.map(c => ({ name: c.config_name, presets: c.applies_to_presets })));
    for (const cfg of configs) {
      const p = cfg.parameters;
      const opp: OppConfig = {
        ema_atr_band: Number(p.atr_multiplier),
        reward_min_atr_multiple: Number(p.min_reward_atr_multiple),
        magic_rs_zones: Array.isArray(p.rs_zones) ? p.rs_zones : DEFAULT_OPP_CONFIG.magic_rs_zones,
        flow_types: Array.isArray(p.flow_types) ? p.flow_types : DEFAULT_OPP_CONFIG.flow_types,
        rvol_min: Number(p.min_rvol),
      };
      for (const presetId of cfg.applies_to_presets) {
        map.set(presetId, opp);
      }
    }
    console.log('[scanEngine] oppConfig map keys:', [...map.keys()]);
  } catch (e) {
    console.warn('[scanEngine] config fetch failed, using defaults:', e);
    for (const preset of SCAN_PRESETS) {
      map.set(preset.id, { ...DEFAULT_OPP_CONFIG });
    }
  }
  _oppConfigCache = map;
  return map;
}

// 3b: Fetch trading dates from km_trading_calendar — exchange-aware, exact count
async function fetchRecentDates(limit: number): Promise<string[]> {
  const { data } = await from('km_trading_calendar')
    .select('trade_date')
    .eq('status', 'completed')
    .eq('exchange', 'NSE')
    .order('trade_date', { ascending: false })
    .limit(limit)
    .execute();

  const rows = (data ?? []) as { trade_date: string }[];
  return rows.map((r) => r.trade_date).sort((a, b) => b.localeCompare(a));
}

async function loadDailyBundle(): Promise<ScanDataBundle> {
  const cached = _bundleCache.get('daily');
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  // 45 calendar days ≈ 30 sessions. Deepest history consumer is 23 sessions
  // (fresh_breakout's 20-day-high walk + xAmt's 22-day value window) — returns
  // and breakout levels come from DB columns now. Was 115 days when ret_66d
  // was computed client-side; this cut is ~60% of the scanner page's payload.
  const eodCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const industryCutoff = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const last10days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Phase 1: fetch active symbols first — needed to filter EOD to active stocks only.
  // km_equity_eod contains ~8,000 NSE+BSE stocks; without the filter the 175k LIMIT
  // yields only ~22 rows per stock, making history.length > 66 always fail.
  const symbolRes = await from('km_equity_symbols')
    .select('id,symbol,company_name,industry,exchange,isin,is_active,mcap_cr')
    .is('is_active', 'true')
    .limit(8000)
    .execute();

  const activeIds = (symbolRes.data ?? []).map((s: any) => s.id as number);

  // Phase 1b: resolve the latest fully-complete trading date.
  // Uses GROUP BY + HAVING COUNT >= 4000 on km_equity_eod directly — immune to
  // mid-pipeline partial ingestion where a partial date would have fewer rows.
  const confirmedLatestDate: string | null = await (async () => {
    try {
      const { data } = await (from('km_equity_eod') as any)
        .select('trade_date,count()')
        .group('trade_date')
        .having('count().gte.4000')
        .order('trade_date', { ascending: false })
        .limit(1)
        .execute();
      return (data as any)?.[0]?.trade_date ?? null;
    } catch {
      return null;
    }
  })();

  // Phase 2: fetch everything else in parallel.
  // EOD is chunked into batches of 400 IDs to stay within nginx's 8k URL limit.
  // Upper-bound each chunk with confirmedLatestDate to exclude any partially-ingested rows.
  const EOD_COLS = 'equity_id,trade_date,open,high,low,close,prev_close,pct_chng,volume,value_cr,rvol,tvol,rsi_14,magic_rs,magic_rs_zone,flow_type,accum_distrib,sniper_inst,sniper_hot,rss_value,rss_spread,sma_150,volume_divergence_flag,ema_20,atr_14,delivery_pct,delivery_qty,avg_amt_5d,avg_amt_22d,delivery_surge_x,w52_high,sma_50,sma_200,w52_low,supertrend_dir,lifetime_high,is_vani_surge,is_vani_breakout,is_vani_distrib,is_vani_weakness,is_vani_smart,is_vani_s2,is_vani_oversold,stage,score_5d,score_22d,pct_5d,pct_22d,pct_66d,avg_amt_66d,surge_22d,ret_5d,ret_22d,ret_66d,breakout_level,pct_from_breakout,pct_below_52w_high,deliv_value_cr';
  console.log('[loadDailyBundle] EOD_COLS select:', EOD_COLS);
  const CHUNK = 400;
  const idChunks: number[][] = [];
  for (let i = 0; i < activeIds.length; i += CHUNK) idChunks.push(activeIds.slice(i, i + CHUNK));

  const [industryRes, ...rest] = await Promise.all([
    from('km_industry_eod')
      .select('*')
      .gte('trade_date', industryCutoff)
      .order('trade_date', { ascending: false })
      .limit(1000)
      .execute(),

    ...idChunks.map((chunk) => {
      let q = from('km_equity_eod')
        .select(EOD_COLS)
        .in('equity_id', chunk)
        .gte('trade_date', eodCutoff)
        .order('trade_date', { ascending: false })
        .limit(50000);
      if (confirmedLatestDate) q = (q as any).lte('trade_date', confirmedLatestDate);
      return (q as any).execute();
    }),

    from('km_index_symbols').select('id,name').execute(),

    from('km_index_eod')
      .select('index_id,trade_date,ret_5d,ret_22d,ret_66d')
      .gte('trade_date', last10days)
      .order('trade_date', { ascending: false })
      .limit(200)
      .execute(),

    fetchOpportunityConfig(),
  ]);

  // Unpack: last 3 items are idxSymbolRes, idxEodRes, oppConfigMap
  const idxSymbolRes   = rest[rest.length - 3] as { data: any };
  const idxEodRes      = rest[rest.length - 2] as { data: any };
  const oppConfigMap   = rest[rest.length - 1] as Awaited<ReturnType<typeof fetchOpportunityConfig>>;
  const eodChunkRes    = rest.slice(0, rest.length - 3) as Array<{ data: any }>;
  const eodRes         = { data: eodChunkRes.flatMap((r) => r.data ?? []) };

  // Use the confirmed latest complete date from km_trading_calendar.
  // Falls back to max of loaded chunk heads only if km_trading_calendar returned no rows.
  const allEodRows = (eodRes.data ?? []) as EquityEodSnapshot[];
  const latestDate: string | null = confirmedLatestDate ?? eodChunkRes.reduce((max: string | null, chunk: any) => {
    const d: string | undefined = chunk.data?.[0]?.trade_date;
    return d && (!max || d > max) ? d : max;
  }, null);

  if (!latestDate) {
    return {
      industries: [],
      industriesHistory: new Map(),
      symbols: new Map(),
      latestEod: new Map(),
      eodHistory: new Map(),
      latestDate: null,
      oppConfigMap: new Map(),
      nifty50Returns: null,
      nifty500Returns: null,
      timeframe: 'daily',
    };
  }

  // Process industries
  const allIndustryRows = (industryRes.data ?? []) as IndustryEodRow[];
  const industries = allIndustryRows.filter((r) => r.trade_date === latestDate);
  const industriesHistory = new Map<string, IndustryEodRow[]>();
  for (const r of allIndustryRows) {
    const arr = industriesHistory.get(r.industry) ?? [];
    arr.push(r);
    industriesHistory.set(r.industry, arr);
  }

  // Process symbols
  const symbols = new Map<number, EquitySymbolRow>();
  for (const s of (symbolRes.data ?? []) as EquitySymbolRow[]) {
    symbols.set(s.id, s);
  }

  // Process EOD
  const latestEod = new Map<number, EquityEodSnapshot>();
  const eodHistory = new Map<number, EquityEodSnapshot[]>();
  for (const r of allEodRows) {
    const arr = eodHistory.get(r.equity_id) ?? [];
    arr.push(r);
    eodHistory.set(r.equity_id, arr);
    if (r.trade_date === latestDate && !latestEod.has(r.equity_id)) {
      latestEod.set(r.equity_id, r);
    }
  }

  // Build index returns
  const idxSymbols = (idxSymbolRes.data ?? []) as { id: number; name: string }[];
  const nifty50Id = idxSymbols.find((s) => s.name === 'NIFTY 50')?.id ?? null;
  const nifty500Id = idxSymbols.find((s) => s.name === 'NIFTY 500')?.id ?? null;

  const idxEodLatest = new Map<number, IndexReturn>();
  for (const row of (idxEodRes.data ?? []) as Array<{ index_id: number; trade_date: string; ret_5d: number | null; ret_22d: number | null; ret_66d: number | null }>) {
    if (!idxEodLatest.has(row.index_id)) {
      idxEodLatest.set(row.index_id, { ret_5d: row.ret_5d ?? null, ret_22d: row.ret_22d ?? null, ret_66d: row.ret_66d ?? null });
    }
  }

  const nifty50Returns = nifty50Id != null ? (idxEodLatest.get(nifty50Id) ?? null) : null;
  const nifty500Returns = nifty500Id != null ? (idxEodLatest.get(nifty500Id) ?? null) : null;

  const bundle: ScanDataBundle = {
    industries,
    industriesHistory,
    symbols,
    latestEod,
    eodHistory,
    latestDate,
    oppConfigMap,
    nifty50Returns,
    nifty500Returns,
    timeframe: 'daily',
  };

  _bundleCache.set('daily', { data: bundle, fetchedAt: Date.now() });
  return bundle;
}

async function loadWeeklyOrMonthlyBundle(tf: 'weekly' | 'monthly'): Promise<ScanDataBundle> {
  const cached = _bundleCache.get(tf);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  const table = tf === 'weekly' ? 'km_equity_weekly' : 'km_equity_monthly';
  const periodCol = tf === 'weekly' ? 'week_start' : 'month_start';
  const cutoffDays = tf === 'weekly' ? 510 : 2200;
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const last10days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const industryCutoff = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [industryRes, symbolRes, periodRes, idxSymbolRes, idxEodRes, oppConfigMap] = await Promise.all([
    from('km_industry_eod')
      .select('*')
      .gte('trade_date', industryCutoff)
      .order('trade_date', { ascending: false })
      .limit(1000)
      .execute(),

    from('km_equity_symbols')
      .select('id,symbol,company_name,industry,exchange,isin,is_active,mcap_cr')
      .is('is_active', 'true')
      .limit(8000)
      .execute(),

    from(table)
      .select([
        'equity_id', periodCol, 'trade_date',
        'open', 'high', 'low', 'close', 'volume', 'total_value',
        'rvol', 'tvol', 'rsi_14', 'magic_rs', 'magic_rs_zone',
        'flow_type', 'accum_distrib', 'sniper_inst', 'sniper_hot',
        'volume_divergence_flag', 'ema_20', 'atr_14',
        'avg_deliv_pct', 'deliv_qty', 'w52_high', 'w52_low',
        'deliv_value_cr',
      ].join(','))
      .gte(periodCol, cutoff)
      .order(periodCol, { ascending: false })
      .limit(110000)
      .execute(),

    from('km_index_symbols').select('id,name').execute(),

    from('km_index_eod')
      .select('index_id,trade_date,ret_5d,ret_22d,ret_66d')
      .gte('trade_date', last10days)
      .order('trade_date', { ascending: false })
      .limit(200)
      .execute(),

    fetchOpportunityConfig(),
  ]);

  const allPeriodRows = (periodRes.data ?? []) as any[];
  const latestDate: string | null = allPeriodRows.length > 0 ? allPeriodRows[0][periodCol] : null;

  if (!latestDate) {
    return {
      industries: [], industriesHistory: new Map(),
      symbols: new Map(), latestEod: new Map(), eodHistory: new Map(),
      latestDate: null, oppConfigMap: new Map(),
      nifty50Returns: null, nifty500Returns: null, timeframe: tf,
    };
  }

  // Map period rows to EquityEodSnapshot-shaped objects
  const mappedRows = allPeriodRows.map((r: any): EquityEodSnapshot => ({
    equity_id: r.equity_id,
    trade_date: r[periodCol],       // week_start or month_start — used as period ID
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    prev_close: null,
    pct_chng: null,
    volume: r.volume ?? null,
    value_cr: r.total_value ?? null, // remap total_value → value_cr
    rvol: r.rvol ?? null,
    tvol: r.tvol ?? null,
    rsi_14: r.rsi_14 ?? null,
    magic_rs: r.magic_rs ?? null,
    magic_rs_zone: r.magic_rs_zone ?? null,
    flow_type: r.flow_type ?? null,
    accum_distrib: r.accum_distrib ?? null,
    sniper_inst: r.sniper_inst ?? null,
    sniper_hot: r.sniper_hot ?? null,
    rss_value: null,
    rss_spread: null,
    sma_150: null,
    volume_divergence_flag: r.volume_divergence_flag ?? null,
    ema_20: r.ema_20 ?? null,
    atr_14: r.atr_14 ?? null,
    delivery_pct: r.avg_deliv_pct ?? null, // remap
    delivery_qty: r.deliv_qty ?? null,     // remap
    w52_high: r.w52_high ?? null,
    sma_50: null,
    sma_200: null,
    w52_low: null,
    supertrend_dir: null,
    lifetime_high: null,
  }));

  // Build industry data
  const allIndustryRows = (industryRes.data ?? []) as IndustryEodRow[];
  const latestIndustryDate = allIndustryRows.length > 0 ? allIndustryRows[0].trade_date : null;
  const industries = latestIndustryDate ? allIndustryRows.filter((r) => r.trade_date === latestIndustryDate) : [];
  const industriesHistory = new Map<string, IndustryEodRow[]>();
  for (const r of allIndustryRows) {
    const arr = industriesHistory.get(r.industry) ?? [];
    arr.push(r);
    industriesHistory.set(r.industry, arr);
  }

  // Build symbols map
  const symbols = new Map<number, EquitySymbolRow>();
  for (const s of (symbolRes.data ?? []) as EquitySymbolRow[]) {
    symbols.set(s.id, s);
  }

  // Build eodHistory and latestEod
  const latestEod = new Map<number, EquityEodSnapshot>();
  const eodHistory = new Map<number, EquityEodSnapshot[]>();
  for (const r of mappedRows) {
    const arr = eodHistory.get(r.equity_id) ?? [];
    arr.push(r);
    eodHistory.set(r.equity_id, arr);
    if (r.trade_date === latestDate && !latestEod.has(r.equity_id)) {
      latestEod.set(r.equity_id, r);
    }
  }

  // Build index returns
  const idxSymbols = (idxSymbolRes.data ?? []) as { id: number; name: string }[];
  const nifty50Id = idxSymbols.find((s) => s.name === 'NIFTY 50')?.id ?? null;
  const nifty500Id = idxSymbols.find((s) => s.name === 'NIFTY 500')?.id ?? null;
  const idxEodLatest = new Map<number, IndexReturn>();
  for (const row of (idxEodRes.data ?? []) as Array<{ index_id: number; ret_5d: number | null; ret_22d: number | null; ret_66d: number | null }>) {
    if (!idxEodLatest.has(row.index_id)) {
      idxEodLatest.set(row.index_id, { ret_5d: row.ret_5d ?? null, ret_22d: row.ret_22d ?? null, ret_66d: row.ret_66d ?? null });
    }
  }
  const nifty50Returns = nifty50Id != null ? (idxEodLatest.get(nifty50Id) ?? null) : null;
  const nifty500Returns = nifty500Id != null ? (idxEodLatest.get(nifty500Id) ?? null) : null;

  const bundle: ScanDataBundle = {
    industries, industriesHistory, symbols, latestEod, eodHistory,
    latestDate, oppConfigMap, nifty50Returns, nifty500Returns, timeframe: tf,
  };

  _bundleCache.set(tf, { data: bundle, fetchedAt: Date.now() });
  return bundle;
}

async function loadScanData(tf: ScanTimeframe = 'daily'): Promise<ScanDataBundle> {
  if (tf === 'weekly' || tf === 'monthly') return loadWeeklyOrMonthlyBundle(tf);
  return loadDailyBundle();
}

// ── 3c: VaNi Opportunity evaluation ───────────────────────────

let _oppDiagCount = 0;

function evaluateOpportunity(stock: Omit<ScanStock, 'vaniOpportunity'>, config: OppConfig): boolean {
  if (!stock.ema_20 || !stock.atr_14 || stock.atr_14 <= 0) return false;
  const isBearish = config.flow_types.some(f => f === 'FRESH_SHORTS' || f === 'LONG_LIQUIDATION');
  const withinBand =
    stock.close >= stock.ema_20 - config.ema_atr_band * stock.atr_14 &&
    stock.close <= stock.ema_20 + config.ema_atr_band * stock.atr_14;
  // Bullish: upside runway to the top of the band (ema20 + band×atr14)
  // Bearish: downside runway to the bottom of the band (ema20 - band×atr14)
  const runway = isBearish
    ? stock.close - (stock.ema_20 - config.ema_atr_band * stock.atr_14)
    : (stock.ema_20 + config.ema_atr_band * stock.atr_14) - stock.close;
  const hasReward = runway > config.reward_min_atr_multiple * stock.atr_14;
  const zoneOk = config.magic_rs_zones.includes(stock.magic_rs_zone ?? '');
  // LOW_VOLUME is an artifact of the volume scale discontinuity bug (CLAUDE.md § Known Issues).
  // It is computed from artificially suppressed rvol — treat as neutral for bullish configs.
  const flowOk = stock.flow_type === 'LOW_VOLUME' && !isBearish
    ? true
    : config.flow_types.includes(stock.flow_type ?? '');
  const rvolOk = (stock.rvol ?? 0) >= config.rvol_min;
  const result = withinBand && hasReward && zoneOk && flowOk && rvolOk;
  if (!isBearish && !result && _oppDiagCount < 5) {
    _oppDiagCount++;
    console.log(`[scanEngine] VaNi miss (${stock.symbol}): band=${withinBand} reward=${hasReward} zone=${zoneOk}(${stock.magic_rs_zone}) flow=${flowOk}(${stock.flow_type}) rvol=${rvolOk}(${stock.rvol?.toFixed(2)}) ema=${stock.ema_20?.toFixed(1)} atr=${stock.atr_14?.toFixed(1)}`);
  }
  return result;
}

// ── Helper: DOT detection in history ───────────────────────────
// Per-stock lookback copy of the canonical DOT logic.
// Source of truth: visualPulseEngine.ts computeDots()
// SQL copy:        km_migration_033_industry_eod.sql dot_signals CTE
// If you change a threshold, update all three locations.

function hasDotInHistory(
  history: EquityEodSnapshot[],
  dotType: 'svd' | 'sbd' | 'syd',
  lookback: number,
): boolean {
  const bars = history.slice(0, lookback + 1); // already sorted desc
  for (let i = 0; i < bars.length - 1 && i < lookback; i++) {
    const bar = bars[i];
    const prev = bars[i + 1];
    if (!bar || !prev) continue;

    const range = bar.high - bar.low;
    if (range <= 0) continue;
    const bodyRatio = Math.abs(bar.close - bar.open) / range;

    if (dotType === 'svd') {
      if (
        (bar.rvol ?? 0) > 10 &&
        bar.close > (bar.high + bar.low) / 2 &&
        prev.close > 0 && bar.close > prev.close * 1.02 &&
        bodyRatio >= 0.5 &&
        bar.close > bar.open
      ) return true;
    } else if (dotType === 'sbd') {
      if (
        (bar.rvol ?? 0) >= 3 && (bar.rvol ?? 0) < 10 &&
        bar.close > bar.open &&
        bar.close > bar.high - range / 3 &&
        bodyRatio >= 0.45
      ) return true;
    } else if (dotType === 'syd') {
      if (
        bar.close < prev.close &&
        (bar.rvol ?? 0) >= 2 &&
        bar.close < bar.low + range / 3
      ) return true;
    }
  }
  return false;
}

// ── Helper: Industry classifications ───────────────────────────

function getIndustryClassifications(bundle: ScanDataBundle) {
  const total = bundle.industries.length;
  const topQuartileCutoff = Math.ceil(total / 4);
  const bottomQuartileCutoff = total - topQuartileCutoff;

  // Compare with ~5 days ago for rotation detection
  const rotatingIn = new Set<string>();
  const rotatingOut = new Set<string>();
  const leading = new Set<string>();
  const lagging = new Set<string>();

  for (const ind of bundle.industries) {
    const history = bundle.industriesHistory.get(ind.industry) ?? [];
    const oldRow = history.length > 4 ? history[Math.min(4, history.length - 1)] : null;
    const rankChange = oldRow ? oldRow.industry_rank - ind.industry_rank : 0;

    if (rankChange >= 5) rotatingIn.add(ind.industry);
    if (rankChange <= -5) rotatingOut.add(ind.industry);
    if (ind.industry_rank <= topQuartileCutoff) leading.add(ind.industry);
    if (ind.industry_rank > bottomQuartileCutoff) lagging.add(ind.industry);
  }

  return { rotatingIn, rotatingOut, leading, lagging, topQuartileCutoff };
}

// ── Build ScanStock from equity data ───────────────────────────

function buildScanStock(
  equityId: number,
  bundle: ScanDataBundle,
  presetId: string | null = null,
): ScanStock | null {
  const eod = bundle.latestEod.get(equityId);
  const sym = bundle.symbols.get(equityId);
  if (!eod || !sym) return null;

  // Stocks without a computed EMA20 have insufficient history (< 20 bars).
  // ema_20 = 0 does not occur in the DB — the SQL formula never writes 0.
  if (eod.ema_20 == null) return null;

  // Guard: treat unrecognised zone values as null
  if (eod.magic_rs_zone && !VALID_ZONES.has(eod.magic_rs_zone)) {
    (eod as any).magic_rs_zone = null;
  }

  const history = bundle.eodHistory.get(equityId) ?? [];

  // 3c: Computed financial fields
  const ema20 = eod.ema_20 ?? null;
  const atr14 = eod.atr_14 ?? null;
  const reward = (ema20 && atr14) ? (ema20 + atr14) - eod.close : null;
  const rewardPct = (ema20 && atr14 && atr14 > 0) ? ((ema20 + atr14) - eod.close) / atr14 : null;
  const pctBelow52wHigh = eod.pct_below_52w_high != null ? Number(eod.pct_below_52w_high) : null;

  const magicRsTrend: (boolean | null)[] = history.slice(0, 5).map((h, i) =>
    h.magic_rs != null && (history[i + 1]?.magic_rs ?? null) != null
      ? h.magic_rs > history[i + 1].magic_rs!
      : null,
  );

  // xAmt: avg(value_cr, 5D) / avg(value_cr, 22D)
  const valW5  = history.slice(0, Math.min(history.length, 5)).filter((h) => h.value_cr != null);
  const valW22 = history.slice(0, Math.min(history.length, 22)).filter((h) => h.value_cr != null);
  const avgVal5  = valW5.length  > 0 ? valW5.reduce((s, h) => s + h.value_cr!, 0) / valW5.length   : null;
  const avgVal22 = valW22.length > 0 ? valW22.reduce((s, h) => s + h.value_cr!, 0) / valW22.length  : null;
  const xAmt = avgVal5 != null && avgVal22 != null && avgVal22 > 0 ? avgVal5 / avgVal22 : null;

  // REL fields vs NIFTY 50 and NIFTY 500 — returns come from the DB columns
  // (migration 111), not a client-side history walk. This is what lets the
  // bundle window shrink to ~23 sessions (the old 67-bar walk forced 115
  // calendar days of EOD download for every scanner visit).
  const stockRet5  = eod.ret_5d  != null ? Number(eod.ret_5d)  : null;
  const stockRet22 = eod.ret_22d != null ? Number(eod.ret_22d) : null;
  const stockRet66 = eod.ret_66d != null ? Number(eod.ret_66d) : null;

  const n50  = bundle.nifty50Returns;
  const n500 = bundle.nifty500Returns;

  const rel_5d_n50   = stockRet5  != null && n50?.ret_5d   != null ? stockRet5  - n50.ret_5d   : null;
  const rel_22d_n50  = stockRet22 != null && n50?.ret_22d  != null ? stockRet22 - n50.ret_22d  : null;
  const rel_66d_n50  = stockRet66 != null && n50?.ret_66d  != null ? stockRet66 - n50.ret_66d  : null;
  const rel_5d_n500  = stockRet5  != null && n500?.ret_5d  != null ? stockRet5  - n500.ret_5d  : null;
  const rel_22d_n500 = stockRet22 != null && n500?.ret_22d != null ? stockRet22 - n500.ret_22d : null;
  const rel_66d_n500 = stockRet66 != null && n500?.ret_66d != null ? stockRet66 - n500.ret_66d : null;

  const partial: Omit<ScanStock, 'vaniOpportunity'> = {
    equity_id: equityId,
    symbol: sym.symbol,
    company_name: sym.company_name,
    industry: sym.industry,
    exchange: sym.exchange ?? null,
    trade_date: eod.trade_date,
    close: eod.close,
    pct_chng: eod.pct_chng,
    rsi_14: eod.rsi_14,
    magic_rs: eod.magic_rs,
    magic_rs_zone: eod.magic_rs_zone,
    flow_type: eod.flow_type,
    rvol: eod.rvol,
    sniper_inst: eod.sniper_inst,
    sniper_hot: eod.sniper_hot ?? null,
    accum_distrib: eod.accum_distrib,
    rss_value: eod.rss_value,
    rss_spread: eod.rss_spread,
    sma_150: eod.sma_150,
    volume_divergence_flag: eod.volume_divergence_flag,
    has_recent_svd: hasDotInHistory(history, 'svd', 5),
    has_recent_sbd: hasDotInHistory(history, 'sbd', 5),
    has_recent_syd: hasDotInHistory(history, 'syd', 5),
    ema_20: ema20,
    atr_14: atr14,
    delivery_pct: eod.delivery_pct ?? null,
    w52_high: eod.w52_high ?? null,
    sma_50: eod.sma_50 ?? null,
    sma_200: eod.sma_200 ?? null,
    w52_low: eod.w52_low ?? null,
    supertrend_dir: eod.supertrend_dir ?? null,
    lifetime_high: eod.lifetime_high ?? null,
    stage: eod.stage ?? null,
    open: eod.open ?? null,
    high: eod.high ?? null,
    low: eod.low ?? null,
    mcap_cr: sym.mcap_cr ?? null,
    avg_amt_5d:       eod.avg_amt_5d       != null ? Number(eod.avg_amt_5d)       : null,
    avg_amt_22d:      eod.avg_amt_22d      != null ? Number(eod.avg_amt_22d)      : null,
    avg_amt_66d:      eod.avg_amt_66d      != null ? Number(eod.avg_amt_66d)      : null,
    delivery_surge_x: eod.delivery_surge_x != null ? Number(eod.delivery_surge_x) : null,
    surge_22d:        eod.surge_22d        != null ? Number(eod.surge_22d)        : null,
    score_5d:    eod.score_5d    != null ? Number(eod.score_5d)    : null,
    score_22d:   eod.score_22d   != null ? Number(eod.score_22d)   : null,
    pct_5d:      eod.pct_5d      != null ? Number(eod.pct_5d)      : null,
    pct_22d:     eod.pct_22d     != null ? Number(eod.pct_22d)     : null,
    pct_66d:     eod.pct_66d     != null ? Number(eod.pct_66d)     : null,
    ret_5d:           eod.ret_5d           != null ? Number(eod.ret_5d)           : null,
    ret_22d:          eod.ret_22d          != null ? Number(eod.ret_22d)          : null,
    ret_66d:          eod.ret_66d          != null ? Number(eod.ret_66d)          : null,
    breakout_level:   eod.breakout_level   != null ? Number(eod.breakout_level)   : null,
    pct_from_breakout: eod.pct_from_breakout != null ? Number(eod.pct_from_breakout) : null,
    deliv_value_cr:   eod.deliv_value_cr   != null ? Number(eod.deliv_value_cr)   : null,
    xAmt: xAmt != null ? Math.round(xAmt * 1000) / 1000 : null,
    rel_5d_n50:   rel_5d_n50   != null ? Math.round(rel_5d_n50   * 100) / 100 : null,
    rel_22d_n50:  rel_22d_n50  != null ? Math.round(rel_22d_n50  * 100) / 100 : null,
    rel_66d_n50:  rel_66d_n50  != null ? Math.round(rel_66d_n50  * 100) / 100 : null,
    rel_5d_n500:  rel_5d_n500  != null ? Math.round(rel_5d_n500  * 100) / 100 : null,
    rel_22d_n500: rel_22d_n500 != null ? Math.round(rel_22d_n500 * 100) / 100 : null,
    rel_66d_n500: rel_66d_n500 != null ? Math.round(rel_66d_n500 * 100) / 100 : null,
    magicRsTrend,
    reward,
    rewardPct,
    pctBelow52wHigh,
  };

  // One VaNi standard (owner 2026-07-06: "VaNi highlight is not configured
  // for all the scanners"): the preset's vani_rule decides the highlight,
  // same as the stage/breakout scans. The old ATR/EMA-band config was a
  // BULLISH-only gate — on bearish scans (Weakness Confluence, Distribution
  // Warnings) it could never fire, so they showed zero highlights forever.
  // The config path survives only as a fallback for presets with no rule.
  const vaniRule = presetId ? getPresetMeta(presetId)?.vani_rule : null;
  const presetCfg = presetId ? (bundle.oppConfigMap.get(presetId) ?? null) : null;
  const vaniOpportunity = vaniRule
    ? computeVaniOpportunity(eod as VaniRow, vaniRule)
    : presetCfg ? evaluateOpportunity(partial, presetCfg) : false;
  return { ...partial, vaniOpportunity };
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
 * NOTE: bundle-based scan functions (scanPowerBuy etc.) derive vaniOpportunity
 * through buildScanStock → evaluateOpportunity (ATR/EMA band config).
 * Migrating those to computeVaniOpportunity requires adding is_vani_* columns
 * to the bundle EOD SELECT — deferred to a future sprint.
 * Direct-query fetch functions (fetchStage2Leaders etc.) use computeVaniOpportunity.
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

// ── Scan Implementations ───────────────────────────────────────

// FILTER LOGIC NOTE:
// accum_distrib captures classical Wyckoff accumulation (price below
// Golden Line + 3x volume + bullish momentum). This signal is naturally
// rare — typically 1-5% of stocks meet it on any given day.
//
// The OR clause captures the broader bullish confluence pattern that
// traders also recognize as strength building: above Golden Line,
// strong/mild bull RS zone, bullish flow type, elevated volume.
//
// Both paths surface stocks worth attention; the strict path is high
// conviction, the confluence path is broader signal.

/** Scan 1: Strength Confluence */
function scanPowerBuy(bundle: ScanDataBundle): ScanStock[] {
  const { rotatingIn, leading } = getIndustryClassifications(bundle);
  const eligible = new Set([...rotatingIn, ...leading]);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'power_buy');
    if (!stock || !stock.industry) continue;

    // Industry gate (unchanged)
    if (!eligible.has(stock.industry)) continue;

    // Path 1: Strict Wyckoff accumulation (rare, high conviction)
    const wyckoffAccumulation = stock.accum_distrib === 'ACCUMULATION';

    // Path 2: Broader bullish confluence (common, also valid)
    const bullishConfluence =
      stock.sma_150 != null && stock.close > stock.sma_150 &&
      ['Strong Bull', 'Mild Bull'].includes(stock.magic_rs_zone ?? '') &&
      ['FRESH_LONGS', 'SHORT_COVERING'].includes(stock.flow_type ?? '') &&
      (stock.rvol ?? 0) > 1.5;

    if (!wyckoffAccumulation && !bullishConfluence) continue;
    results.push(stock);
  }

  return results
    .sort((a, b) => (b.magic_rs ?? 0) - (a.magic_rs ?? 0))
    .slice(0, 25);
}

// FILTER LOGIC NOTE (mirror of Strength Confluence):
// accum_distrib = 'DISTRIBUTION' captures classical Wyckoff distribution.
// The OR clause captures broader bearish confluence: below Golden Line,
// strong/mild bear RS zone, bearish flow type, elevated volume.

/** Scan 2: Weakness Confluence */
function scanPowerSell(bundle: ScanDataBundle): ScanStock[] {
  const { rotatingOut, lagging } = getIndustryClassifications(bundle);
  const eligible = new Set([...rotatingOut, ...lagging]);

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'power_sell');
    if (!stock || !stock.industry) continue;

    // Industry gate (unchanged)
    if (!eligible.has(stock.industry)) continue;

    // Path 1: Strict Wyckoff distribution (rare, high conviction)
    const wyckoffDistribution = stock.accum_distrib === 'DISTRIBUTION';

    // Path 2: Broader bearish confluence (common, also valid)
    const bearishConfluence =
      stock.sma_150 != null && stock.close < stock.sma_150 &&
      ['Strong Bear', 'Mild Bear'].includes(stock.magic_rs_zone ?? '') &&
      ['FRESH_SHORTS', 'LONG_LIQUIDATION'].includes(stock.flow_type ?? '') &&
      (stock.rvol ?? 0) > 1.5;

    if (!wyckoffDistribution && !bearishConfluence) continue;
    results.push(stock);
  }

  return results
    .sort((a, b) => (a.magic_rs ?? 0) - (b.magic_rs ?? 0))
    .slice(0, 25);
}

/** Scan 3: Smart Money Loading */
function scanSmartMoney(bundle: ScanDataBundle): ScanStock[] {
  // Industry gate — where accumulation is concentrated today.
  //
  // pct_accumulation is the share of an industry's stocks showing accumulation.
  // Empirically its distribution is low-skewed: on a typical day the median
  // industry sits ~15% and even the single most-accumulating one rarely clears
  // 50-67%. The old absolute `> 60` gate therefore fired for 0-1 industries,
  // leaving Smart Money chronically empty. We keep the absolute bar (so genuinely
  // broad-accumulation industries always qualify) but OR it with a relative
  // top-decile cutoff, so the scan reliably reflects the strongest-accumulating
  // corner of the market instead of blanking. delivery_pct at the stock level
  // keeps the list grounded in real delivery-based buying.
  const ranked = bundle.industries
    .filter((i) => (i.pct_accumulation ?? 0) > 0)
    .sort((a, b) => (b.pct_accumulation ?? 0) - (a.pct_accumulation ?? 0));
  const decileCount = Math.max(5, Math.ceil(ranked.length / 10));
  const accumulatingIndustries = new Set<string>();
  ranked.forEach((ind, i) => {
    if ((ind.pct_accumulation ?? 0) > 55 || i < decileCount) {
      accumulatingIndustries.add(ind.industry);
    }
  });

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'smart_money');
    if (!stock || !stock.industry) continue;
    if (!stock.symbol || !/^[A-Z]/.test(stock.symbol)) continue;
    if (!accumulatingIndustries.has(stock.industry)) continue;

    if ((stock.delivery_pct ?? 0) <= 60) continue;

    // rss_value must be positive (guards degenerate rows; RSS is RSI-derived 0-100)
    if ((stock.rss_value ?? 0) <= 0) continue;

    results.push(stock);
  }

  return results
    .sort((a, b) => (b.delivery_pct ?? 0) - (a.delivery_pct ?? 0))
    .slice(0, 25);
}

// Scan 4 "Fresh Breakouts" retired 2026-07-13 (B1): it was a near-duplicate of
// Breakout Surge (both "closed above a breakout level"), with two extras —
// a leading-industry gate and rvol>2. Breakout Surge is the robust superset
// (DB-precomputed breakout levels, full universe, conviction-ranked by Score
// 5D), and its sector scoping is available via the ScanFilterBar `industries`
// filter + the rvol column. The kd_scan_presets row is deactivated in
// migration 152; this handler + preset are removed so a stale DB row can't
// dispatch to a missing function.

/** Scan 5: Quiet Accumulation (contrarian) */
function scanQuietAccumulation(bundle: ScanDataBundle): ScanStock[] {
  const { topQuartileCutoff } = getIndustryClassifications(bundle);

  // Industries NOT in top quartile with rising pct_accumulation
  const eligibleIndustries = new Map<string, number>();
  for (const ind of bundle.industries) {
    if (ind.industry_rank <= topQuartileCutoff) continue;

    const history = bundle.industriesHistory.get(ind.industry) ?? [];
    const accNow = ind.pct_accumulation ?? 0;
    const acc5 = history.length > 4 ? (history[4]?.pct_accumulation ?? 0) : 0;
    const accChange = accNow - acc5;
    if (accChange <= 0) continue;

    eligibleIndustries.set(ind.industry, accChange);
  }

  const results: ScanStock[] = [];
  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'quiet_accumulation');
    if (!stock || !stock.industry) continue;
    if (!eligibleIndustries.has(stock.industry)) continue;
    if (stock.accum_distrib !== 'ACCUMULATION') continue;

    // sniper_inst trending up
    const history = bundle.eodHistory.get(id) ?? [];
    const sniperNow = history[0]?.sniper_inst ?? 0;
    const sniper5 = history.length > 4 ? (history[4]?.sniper_inst ?? 0) : 0;
    if (sniperNow <= sniper5) continue;

    const accChange = eligibleIndustries.get(stock.industry) ?? 0;
    results.push({ ...stock, _sortScore: accChange } as ScanStock & { _sortScore: number });
  }

  return results
    .sort((a, b) => ((b as any)._sortScore ?? 0) - ((a as any)._sortScore ?? 0))
    .slice(0, 25);
}

/** Scan 6: Distribution Warnings */
function scanDistributionWarning(bundle: ScanDataBundle): ScanStock[] {
  const results: ScanStock[] = [];

  for (const [id] of bundle.latestEod) {
    const stock = buildScanStock(id, bundle, 'distribution_warning');
    if (!stock) continue;

    // Current zone is a degraded-from-Strong-Bull middle band: everything
    // between Strong Bull and Strong Bear. Must include the two neutral bands
    // (Neutral Bull / Neutral Bear) — a stock decaying out of Strong Bull lands
    // there first, so omitting them (the old list only had phantom 'Neutral',
    // which the pipeline never emits) hid this scanner's most natural candidates.
    const zone = stock.magic_rs_zone;
    if (!zone || zone === 'Strong Bull' || zone === 'Strong Bear') continue;
    if (!['Mild Bull', 'Neutral Bull', 'Neutral', 'Neutral Bear', 'Mild Bear'].includes(zone)) continue;

    // Was in Strong Bull 10 days ago
    const history = bundle.eodHistory.get(id) ?? [];
    const bar10 = history.length > 9 ? history[9] : null;
    if (!bar10 || bar10.magic_rs_zone !== 'Strong Bull') continue;

    // Has SYD in last 5 bars OR volume_div_down
    if (!stock.has_recent_syd && stock.volume_divergence_flag !== 'VOLUME_DIV_DOWN') continue;

    // Score: rank_drop * abs(magic_rs_change)
    const magicRsNow = stock.magic_rs ?? 0;
    const magicRs10 = bar10.magic_rs ?? 0;
    const magicRsChange = Math.abs(magicRsNow - magicRs10);

    // Get industry rank drop
    const sym = bundle.symbols.get(id);
    const indNow = sym?.industry ? bundle.industries.find((i) => i.industry === sym.industry) : null;
    const indHistory = sym?.industry ? bundle.industriesHistory.get(sym.industry) ?? [] : [];
    const ind10 = indHistory.length > 9 ? indHistory[9] : null;
    const rankDrop = indNow && ind10 ? ind10.industry_rank - indNow.industry_rank : 0;

    const score = Math.abs(rankDrop) * magicRsChange;
    results.push({ ...stock, _sortScore: score } as ScanStock & { _sortScore: number });
  }

  return results
    .sort((a, b) => ((b as any)._sortScore ?? 0) - ((a as any)._sortScore ?? 0))
    .slice(0, 25);
}

/** Scan 7: Conviction Flow */
function scanConvictionFlow(bundle: ScanDataBundle): ScanStock[] {
  const results: ScanStock[] = [];

  for (const [id] of bundle.latestEod) {
    const eod = bundle.latestEod.get(id);
    if (!eod || eod.ema_20 == null || eod.ema_20 <= 0) continue;

    const history = bundle.eodHistory.get(id) ?? [];
    if (history.length < 5) continue;

    const d_pct = ((eod.close - eod.ema_20) / eod.ema_20) * 100;
    if (d_pct < -8 || d_pct > 8) continue;

    const stock = buildScanStock(id, bundle);
    if (!stock) continue;

    // Filter gates use client-side computed delivery scores (value_cr × delivery_pct/100)
    if ((stock.avg_amt_22d ?? 0) <= 1.5) continue;
    if ((stock.delivery_surge_x ?? 0) <= 1.5) continue;

    // Price returns over N trading days (history sorted desc: [0]=today, [N]=N days ago)
    const ret_5d  = history.length >  5 ? ((eod.close - history[5].close)  / history[5].close)  * 100 : null;
    const ret_22d = history.length > 22 ? ((eod.close - history[22].close) / history[22].close) * 100 : null;
    const ret_66d = history.length > 66 ? ((eod.close - history[66].close) / history[66].close) * 100 : null;

    results.push({
      ...stock,
      vaniOpportunity: computeVaniOpportunity(eod, getPresetMeta('conviction_flow')?.vani_rule),
      deliv_value_cr: Math.round((eod.value_cr ?? 0) * ((eod.delivery_pct ?? 0) / 100) * 100) / 100,
      d_pct:          Math.round(d_pct * 100) / 100,
      ret_5d:  ret_5d  != null ? Math.round(ret_5d  * 100) / 100 : null,
      ret_22d: ret_22d != null ? Math.round(ret_22d * 100) / 100 : null,
      ret_66d: ret_66d != null ? Math.round(ret_66d * 100) / 100 : null,
    });
  }

  return results
    .sort((a, b) => (b.delivery_surge_x ?? 0) - (a.delivery_surge_x ?? 0))
    .slice(0, 50);
}

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

const SCAN_FUNCTIONS: Record<string, (bundle: ScanDataBundle) => ScanStock[]> = {
  power_buy: scanPowerBuy,
  power_sell: scanPowerSell,
  smart_money: scanSmartMoney,
  quiet_accumulation: scanQuietAccumulation,
  distribution_warning: scanDistributionWarning,
  conviction_flow: scanConvictionFlow,
  // stage_2_leaders handled separately in executeScan via fetchStage2Leaders()
};

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

export async function executeScan(
  scanId: string,
  exchangeFilter: ExchangeFilter = 'combined',
  timeframe: ScanTimeframe = 'daily',
  date: string = '',
): Promise<ScanStock[]> {
  // Direct DB query scans — skip bundle entirely
  if (scanId === 'flower_pot_burst')     return fetchFlowerPotBurst(exchangeFilter);
  if (scanId === 'stage_2_leaders')      return fetchStage2Leaders(exchangeFilter);
  if (scanId === 'stage_2_watch')        return fetchStage2Watch(exchangeFilter);
  if (scanId === 'stage_4_leaders')      return fetchStage4Leaders(exchangeFilter);
  if (scanId === 'stage_3_watch')        return fetchStage3Watch(exchangeFilter);
  if (scanId === 'vani_exit_watch')      return fetchVaNiExitWatch(exchangeFilter);
  // breakout_surge_daily merged into breakout_surge (kept as alias for stale links)
  if (scanId === 'breakout_surge' || scanId === 'breakout_surge_daily') return fetchBreakoutSurge(exchangeFilter);

  const fn = SCAN_FUNCTIONS[scanId];
  if (!fn) throw new Error(`Unknown scan: ${scanId}`);

  const bundle = await loadScanData(timeframe);
  let results = fn(bundle);

  if (exchangeFilter === 'combined') {
    results = deduplicateByIsin(results, bundle.symbols);
  } else {
    results = results.filter((s) => s.exchange === exchangeFilter);
  }

  return results;
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

// The Watch lists are always_true (pre-filtered shortlists) — cap their
// contribution so they don't flood the union (owner decision 2026-07-06).
const HIGHLIGHT_SOURCES: { id: string; side: 'strength' | 'caution'; label: string; cap?: number }[] = [
  { id: 'power_buy',            side: 'strength', label: 'Confluence' },
  { id: 'smart_money',          side: 'strength', label: 'Smart Money' },
  // fresh_breakout retired (B1) · vani_opportunity retired (B2) — removed from
  // the highlights union; their stocks still surface via breakout_surge / S2.
  { id: 'quiet_accumulation',   side: 'strength', label: 'Quiet Acc' },
  { id: 'conviction_flow',      side: 'strength', label: 'Flow' },
  { id: 'breakout_surge',       side: 'strength', label: 'Surge' },
  { id: 'flower_pot_burst',     side: 'strength', label: 'Burst' },  // ✦ = a coil that released today
  { id: 'stage_2_leaders',      side: 'strength', label: 'S2' },
  { id: 'stage_2_watch',        side: 'strength', label: 'S2 Watch' },
  { id: 'power_sell',           side: 'caution',  label: 'Weakness' },
  { id: 'distribution_warning', side: 'caution',  label: 'Distribution' },
  { id: 'stage_3_watch',        side: 'caution',  label: 'S3' },
  { id: 'stage_4_leaders',      side: 'caution',  label: 'S4' },
  { id: 'vani_exit_watch',      side: 'caution',  label: 'VaNi', cap: 3 },
];

/**
 * Union of ✦ VaNi Highlights across all scanners, deduped per side.
 * A stock flagged by multiple scans carries all their labels — cross-scan
 * confluence is the strongest observation this board makes, so both sides
 * rank by flag count first, then by conviction (strength) / weakness (caution).
 */
export async function fetchVaniHighlights(): Promise<VaniHighlights> {
  // Prime the shared bundle once — firing all bundle-based scans in parallel
  // before the cache is warm would trigger concurrent full-market downloads.
  await executeScan(HIGHLIGHT_SOURCES[0].id);
  const bundle = await loadScanData('daily');  // cache hit — just for latestDate

  const settled = await Promise.allSettled(
    HIGHLIGHT_SOURCES.map((src) => executeScan(src.id)),
  );

  const buckets: Record<'strength' | 'caution', Map<number, VaniHighlightRow>> = {
    strength: new Map(),
    caution: new Map(),
  };

  settled.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const src = HIGHLIGHT_SOURCES[i];
    let rows = res.value.filter((s) => s.vaniOpportunity);
    if (src.cap != null) rows = rows.slice(0, src.cap);
    const bucket = buckets[src.side];
    for (const s of rows) {
      const existing = bucket.get(s.equity_id);
      if (existing) {
        if (!existing.scans.includes(src.label)) existing.scans.push(src.label);
        if (existing.score_5d == null && s.score_5d != null) existing.score_5d = s.score_5d;
        if (existing.rs_percentile == null && s.rs_percentile != null) existing.rs_percentile = s.rs_percentile;
      } else {
        bucket.set(s.equity_id, {
          equity_id: s.equity_id,
          symbol: s.symbol,
          company_name: s.company_name ?? null,
          score_5d: s.score_5d ?? null,
          rs_percentile: s.rs_percentile ?? null,
          scans: [src.label],
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

  return {
    strength,
    caution,
    strengthTotal: strength.length,
    cautionTotal: caution.length,
    asOf: bundle.latestDate,
  };
}

/** Invalidate scan data cache (call after data refresh) */
export function invalidateScanCache(): void {
  _bundleCache.clear();
  _oppConfigCache = null;
  _oppDiagCount = 0;
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

/** Return result counts for all 9 scans — uses shared cached data */
export async function getAllScanCounts(
  exchangeFilter: ExchangeFilter = 'combined',
  timeframe: ScanTimeframe = 'daily',
): Promise<ScanCountsResult> {
  const bundle = await loadScanData(timeframe);
  const counts: Record<string, number> = {};
  for (const [id, fn] of Object.entries(SCAN_FUNCTIONS)) {
    let results = fn(bundle);
    if (exchangeFilter === 'combined') {
      results = deduplicateByIsin(results, bundle.symbols);
    } else {
      results = results.filter((s) => s.exchange === exchangeFilter);
    }
    counts[id] = results.length;
  }
  return { counts, latestDate: bundle.latestDate };
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
 * Uses value_cr (daily turnover in crores) when available (~50% populated).
 * Falls back to volume × close proxy when value_cr is NULL.
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
