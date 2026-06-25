// ── App Types ──

export type MarketSymbol = 'NIFTY' | 'BANKNIFTY' | 'NIFTYIT' | 'NIFTYFMCG';

export type ViewType = 'dashboard' | 'markets' | 'calendar' | 'transmission' | 'history' | 'settings';

export interface RiskFactors {
  structural: number;
  momentum: number;
  volatility: number;
  deception: number;
}

export interface DayRiskReport {
  date: string;
  symbol: MarketSymbol;
  riskScore: number;
  regime: string;
  explanation: string;
  factors: RiskFactors;
  planetarySummary: string;
  sectorImpacts: {
    sector: string;
    sensitivity: number;
    weight: number;
  }[];
}

export interface HistoricalProof {
  date: string;
  score: number;
  actualReturn: number;
  volatility: string;
  isCorrect: boolean;
}

export interface FactorStats {
  factor: string;
  downDaysPct: number;
  avgReturn: number;
  sampleSize: number;
  currentlyActive: boolean;
}

export interface WeekDay {
  date: string;
  dayName: string;
  riskScore: number;
  regime: string;
}

// ── Master Data Types (matching Supabase km_ tables exactly) ──

export interface KmPlanet {
  id: number;
  name: string;
  vedic_name: string | null;
  category: 'classical' | 'node' | 'outer';
}

export interface KmNakshatra {
  id: number;
  name: string;
  start_deg: number | null;
  end_deg: number | null;
}

export interface KmNakshatraLord {
  nakshatra_id: number;
  planet_id: number;
}

export interface KmZodiacSign {
  id: number;
  name: string;
  element: string | null;
  start_deg: number | null;
  end_deg: number | null;
}

export interface KmZodiacLord {
  zodiac_id: number;
  planet_id: number;
}

export interface KmDayOfWeek {
  id: number;
  name: string;
}

export interface KmDayLord {
  day_id: number;
  planet_id: number;
  is_primary: boolean;
}

export interface KmSector {
  id: number;
  name: string;
}

export interface KmSectorLord {
  sector_id: number;
  planet_id: number;
}

/** @deprecated Use KmIndexSymbol instead — km_index_master has only 13 rows */
export interface KmIndexMaster {
  id: number;
  symbol: string;
  name: string;
  yahoo_ticker: string | null;
}

/** @deprecated Use KmIndexConstituent instead — km_index_composition has null sector/weight */
export interface KmIndexComposition {
  id: number;
  index_id: number;
  stock_symbol: string;
  sector: string | null;
  weight_pct: number | null;
  snapshot_date: string | null;
}

// ── Production types (migration 022) ──

export interface KmIndexConstituent {
  id: number;
  index_id: number;
  equity_id: number;
  sector: string | null;
  weight_pct: number | null;
  snapshot_date: string;
}

// ── Auth / Profile Types ──

export interface KmProfile {
  id: string;           // UUID, matches auth.users.id
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  onboarded: boolean;
  created_at: string;
  updated_at: string;
  tier?: string;        // subscription tier — undefined treated as 'free'
  expires_at?: string | null;  // latest subscription expiry; null = no expiry (beta/lifetime)
  theme?: string;       // active UI theme id; undefined = 'kaaladristi'
  icp_mode?: 'astro' | 'technical'; // workspace tab default; undefined treated as 'astro'
}

// ── Index / Equity Symbol Tables (new restructured schema) ──

export interface KmIndexSymbol {
  id: number;
  name: string;
  category: string | null;
  exchange?: string;
  is_tri?: boolean;
  vendor_codes?: Record<string, string> | null;
  created_at?: string;
}

export interface KmIndexEod {
  id: number;
  index_id: number;
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  prev_close: number | null;
  chng: number | null;
  pct_chng: number | null;
  volume: number | null;
}

// ── Joined / Derived Types ──

export interface NakshatraWithLord extends KmNakshatra {
  lord: KmPlanet | null;
}

export interface ZodiacWithLord extends KmZodiacSign {
  lord: KmPlanet | null;
}

/** @deprecated Use IndexWithConstituents instead */
export interface IndexWithComposition extends KmIndexMaster {
  composition: KmIndexComposition[];
  sectorBreakdown: { sector: string; totalWeight: number }[];
}

export interface IndexWithConstituents extends KmIndexSymbol {
  constituents: KmIndexConstituent[];
  sectorBreakdown: { sector: string; totalWeight: number }[];
}

// ── Chart Types ──

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

export interface ChartDataPoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface IndexStats {
  currentClose: number;
  previousClose: number;
  change: number;
  changePct: number;
  high52w: number;
  low52w: number;
  dayHigh: number;
  dayLow: number;
}

// ── Panchangam (from km_daily_panchang) ──

export interface DailyPanchang {
  id: number;
  date: string;
  sunrise_ist: string | null;
  sunset_ist: string | null;
  tithi_num: number;
  tithi_name: string;
  tithi_base_name: string | null;
  paksha: string;
  tithi_group: string | null;
  tithi_lord: string | null;
  nakshatra_num: number;
  nakshatra_name: string;
  nakshatra_lord: string | null;
  nakshatra_pada: number | null;
  yoga_num: number | null;
  yoga_name: string | null;
  karana_num: number | null;
  karana_name: string | null;
  vara: string;
  vara_lord: string;
  dlnl_match: boolean | null;
  sun_sign: number | null;
  sun_sign_name: string | null;
  moon_sign: number | null;
  moon_sign_name: string | null;
  is_sankranti: boolean | null;
  sankranti_from: string | null;
  sankranti_to: string | null;
  hemisphere_event: string | null;
  is_purnima: boolean | null;
  is_amavasya: boolean | null;
  is_ekadashi: boolean | null;
  // Change times — populated by populate_panchang_end_times.py
  tithi_end_ist: string | null;
  tithi_end_next_day: boolean | null;
  nakshatra_end_ist: string | null;
  nakshatra_end_next_day: boolean | null;
  // Next-day values joined from tomorrow's row (via /api/panchang/daily)
  tithi_next_name: string | null;
  nakshatra_next_name: string | null;
  karana_next_name: string | null;
}

// ── Market Breadth (from km_market_breadth) ──

export interface MarketBreadthDay {
  trade_date:    string;
  pct_above_20:  number | null;
  pct_above_50:  number | null;
  pct_above_150: number | null;
  breadth_score: number | null;
  stock_count:   number | null;
}

// ── Breadth ROC Oscillator (from km_breadth_roc) ──

export interface BreadthRocDay {
  trade_date:  string;
  roc_13:      number | null;   // avg 13-day ROC / 13 (normalised per day)
  roc_55:      number | null;   // avg 55-day ROC / 55
  sma_breadth: number | null;   // 5-period SMA of roc_13
  stock_count: number | null;
}

// ── Confluence Historical (from /api/confluence/historical) ──

export interface ConfluenceCell {
  outcome:          string;          // 'bullish' | 'bearish' (DB value)
  breadth_regime:   string | null;   // 'Depressed' | 'Moderate' | 'Elevated'
  roc_regime:       string | null;   // 'Contracting' | 'Negative' | 'Positive' | 'Expanding'
  signal_count:     number;
  positive_day_pct: number | null;   // % of days where NIFTY pct_chng > 0
  avg_day_return:   number | null;   // avg same-day NIFTY pct_chng
}

export interface ConfluenceData {
  breadth_rows:  ConfluenceCell[];
  roc_rows:      ConfluenceCell[];
  total_signals: number;
}

// keep alias so legacy references don't break
export type ConfluenceRow = ConfluenceCell;

// ── Confluence Heatmap — today's conditions + 3-way historical pattern ──

export interface ConfluenceConditions {
  breadth_score:    number | null;
  breadth_regime:   string | null;
  roc_13:           number | null;
  sma_breadth:      number | null;
  roc_regime:       string | null;
  roc_direction:    string | null;   // 'accelerating' | 'decelerating' | 'recovering' | 'deepening'
  nakvar_outcome:   string | null;   // 'bullish' | 'bearish'
  nakvar_rule_code: string | null;
  nakvar_rule_name: string | null;
  nakvar_strength:  number | null;
  nakvar_conf:      number | null;
  vara:             string | null;
  nakshatra_lord:   string | null;
}

export interface ConfluencePattern {
  breadth_regime:   string;
  roc_regime:       string;
  nakvar_outcome:   string;
  signal_count:     number;
  positive_day_pct: number | null;
  avg_day_return:   number | null;
}

export interface ConfluenceHeatmap {
  date:       string;
  conditions: ConfluenceConditions;
  pattern:    ConfluencePattern | null;
}

// ── Confluence Timeline (from /api/confluence/timeline) ──

export interface ConfluenceTimelineEntry {
  trade_date:     string;
  nifty_return:   number | null;
  breadth_score:  number | null;
  roc_13:         number | null;
  nakvar_outcome: 'bullish' | 'bearish' | null;
}

// ── Index Catalog (from mv_index_catalog) ──

export interface IndexCatalogItem {
  id: number;
  name: string;
  category: string | null;
  exchange: string;
  is_active: boolean;
  is_tri: boolean;
  data_from: string | null;
  data_to: string | null;
  record_count: number;
  last_close: number | null;
}

// ── Equity Catalog (from mv_equity_catalog) ──

export interface EquityCatalogItem {
  id: number;
  symbol: string;
  exchange: string;          // 'NSE' | 'BSE'
  is_active: boolean;
  index_names: string[] | null;
  data_from: string | null;
  data_to: string | null;
  record_count: number;
  last_close: number | null;
}

export type EquityExchangeFilter = 'NSE' | 'BSE' | 'ALL';

// ── Commodity Catalog (from mv_commodity_catalog) ──

export interface CommodityCatalogItem {
  id: number;
  symbol: string;
  name: string | null;
  exchange: string;          // 'MCX' | 'NCDEX'
  category: string | null;
  data_from: string | null;
  data_to: string | null;
  record_count: number;
  last_close: number | null;
}

// ── DC Inference Types ──

export interface DcInference {
  id: number;
  astro_event: string;
  rule_definition: Record<string, unknown> | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  inference: string | null;
  market_impact: string | null;   // value from MARKET_STATUS constants
  confidence: number | null;
  notes: string | null;
  applicability_scope: string[] | null;
  applicability: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  month: number | null;   // generated: EXTRACT(MONTH FROM start_date)
  year: number | null;    // generated: EXTRACT(YEAR  FROM start_date)
}

export type DcInferenceInput = Omit<DcInference, 'id' | 'rule_definition' | 'created_at' | 'updated_at' | 'month' | 'year'>;

// ── DC Lookup Types ──

export type { DcLookupItem } from '../services/dcLookup';

// ── Industry EOD (from km_industry_eod, migration 033) ──

export interface IndustryEodRow {
  trade_date: string;
  industry: string;
  stock_count: number;
  avg_magic_rs: number | null;
  pct_strong_bull: number | null;
  pct_strong_bear: number | null;
  pct_accumulation: number | null;
  pct_distribution: number | null;
  dominant_flow_type: string | null;
  avg_sniper_inst: number | null;
  pct_with_recent_svd: number | null;
  pct_with_recent_sbd: number | null;
  pct_with_recent_syd: number | null;
  pct_volume_div_up: number | null;
  pct_volume_div_down: number | null;
  industry_rank: number;
  nse_as_of_date: string | null;
  bse_as_of_date: string | null;
  nse_stock_count: number | null;
  bse_stock_count: number | null;
}

export type RotationCategory = 'rotating_in' | 'leading' | 'rotating_out';

export interface IndustryRotationItem extends IndustryEodRow {
  category: RotationCategory;
  rank_change: number;      // positive = improved
  prev_rank: number | null; // rank N days ago
}

// ── Scan Engine Types ──

export type ExchangeTab = 'combined' | 'NSE' | 'BSE';

export interface ScanStock {
  equity_id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string | null;
  close: number;
  pct_chng: number | null;
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  rvol: number | null;
  sniper_inst: number | null;
  sniper_hot: number | null;
  accum_distrib: string | null;
  rss_value: number | null;
  rss_spread: number | null;
  sma_150: number | null;
  volume_divergence_flag: string | null;
  has_recent_svd: boolean;
  has_recent_sbd: boolean;
  has_recent_syd: boolean;
  // Migration 042 additions
  ema_20: number | null;
  atr_14: number | null;
  delivery_pct: number | null;
  w52_high: number | null;
  // Stage 2 / Weinstein additions
  sma_50: number | null;
  sma_200: number | null;
  w52_low: number | null;
  supertrend_dir: number | null;
  lifetime_high: number | null;
  // Sprint 3 additions
  open: number | null;
  high: number | null;
  low: number | null;
  mcap_cr: number | null;
  avg_amt_66d: number | null;
  xAmt: number | null;
  rel_5d_n50: number | null;
  rel_22d_n50: number | null;
  rel_66d_n50: number | null;
  rel_5d_n500: number | null;
  rel_22d_n500: number | null;
  rel_66d_n500: number | null;
  // Computed fields
  magicRsTrend: (boolean | null)[];
  reward: number | null;
  rewardPct: number | null;
  pctBelow52wHigh: number | null;
  vaniOpportunity: boolean;
  // Conviction Flow computed fields (null for all other scans)
  trade_date?: string;
  avg_amt_5d?: number | null;
  avg_amt_22d?: number | null;
  deliv_value_cr?: number | null;
  delivery_surge_x?: number | null;
  d_pct?: number | null;
  ret_5d?: number | null;
  ret_22d?: number | null;
  ret_66d?: number | null;
  // Breakout Surge computed fields (null for all other scans)
  breakout_level?: number | null;
  pct_from_breakout?: number | null;
  // Breakout Surge Daily — DB score/pct columns (migration 111)
  score_5d?: number | null;
  score_22d?: number | null;
  pct_5d?: number | null;
  pct_22d?: number | null;
  pct_66d?: number | null;
  surge_22d?: number | null;
  // Stage 2 Watch / VaNi Opportunity fields
  rs_percentile?: number | null;
  stage?: string | null;
  sma200_rising?: boolean | null;
  chartink_score?: number | null;
  is_vani_s2?: boolean | null;
  is_vani_strength?: boolean | null;
  is_vani_rs?: boolean | null;
  is_vani_weakness?: boolean | null;
  is_vani_distrib?: boolean | null;
  is_vani_smart?: boolean | null;
  is_vani_oversold?: boolean | null;
  is_vani_surge?: boolean | null;
  is_vani_breakout?: boolean | null;
}

export interface ScanDefinition {
  id: string;
  name: string;
  description: string;
  tooltip?: string;
  limit: number;
  universe: 'NSE_ONLY' | 'NSE_BSE';
  category: string;
  category_label: string;
  category_color: string;
  category_sort: number;
  is_default_tab: boolean;
  timeframe: 'daily' | 'weekly' | 'monthly';
  vani_rule?: string | null;
}

export interface VaniOpportunityConfig {
  id: number;
  config_name: string;
  description?: string;
  is_active: boolean;
  applies_to_presets: string[];
  parameters: {
    atr_multiplier: number;
    min_rvol: number;
    rs_zones: string[];
    flow_types: string[];
    min_reward_atr_multiple: number;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface ConvictionFlowStock {
  equity_id: number;
  symbol: string;
  trade_date: string;
  close: number;
  ema_20: number;
  d_pct: number;
  avg_amt_5d: number;
  avg_amt_22d: number;
  deliv_value_cr: number;
  delivery_surge_x: number;
  is_vani_opportunity: boolean;
}

export interface EquitySymbolRow {
  id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string | null;
  isin: string | null;
  is_active: boolean;
  mcap_cr: number | null;
}

export interface EquityEodSnapshot {
  equity_id: number;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prev_close: number | null;
  pct_chng: number | null;
  volume: number | null;
  rvol: number | null;
  tvol: number | null;
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  accum_distrib: string | null;
  sniper_inst: number | null;
  sniper_hot: number | null;
  rss_value: number | null;
  rss_spread: number | null;
  sma_150: number | null;
  volume_divergence_flag: string | null;
  value_cr: number | null;
  // Migration 042 additions
  ema_20: number | null;
  atr_14: number | null;
  delivery_pct: number | null;
  delivery_qty: number | null;
  w52_high: number | null;
  // Stage 2 / Weinstein additions
  sma_50: number | null;
  sma_200: number | null;
  w52_low: number | null;
  supertrend_dir: number | null;
  lifetime_high: number | null;
  // Pipeline step-6g pre-computed delivery scores (migration 094/095)
  avg_amt_5d?: number | null;
  avg_amt_22d?: number | null;
  delivery_surge_x?: number | null;
  // Migration 111 — server-computed score/pct/66d columns
  score_5d?: number | null;
  score_22d?: number | null;
  pct_5d?: number | null;
  pct_22d?: number | null;
  pct_66d?: number | null;
  avg_amt_66d?: number | null;
  surge_22d?: number | null;
  // VaNi flag columns (migration 099)
  is_vani_surge?: boolean | null;
  is_vani_breakout?: boolean | null;
  // Weinstein stage classification
  stage?: string | null;
  // Migration 112 — computed scanner fields
  ret_5d?: number | null;
  ret_22d?: number | null;
  ret_66d?: number | null;
  breakout_level?: number | null;
  pct_from_breakout?: number | null;
  pct_below_52w_high?: number | null;
  deliv_value_cr?: number | null;
}

// ── Astro Daily Signal (from km_astro_daily_signal) ──

export interface AstroSignal {
  trade_date: string;
  net_signal: string;
  net_score: number;
  primary_event: string | null;
  secondary_event: string | null;
  active_event_count: number;
  turning_date: boolean;
  strong_bullish_count: number;
  bullish_count: number;
  minor_bullish_count: number;
  neutral_count: number;
  minor_bearish_count: number;
  bearish_count: number;
  strong_bearish_count: number;
  sector_signals: Record<string, unknown> | null;
}

// ── Astro Transit (from km_astro_calendar where is_transit = true) ──

export interface AstroTransit {
  id: number;
  display_name: string;
  start_date: string;
  end_date: string | null;
  market_impact: string;
  inference: string | null;
}
