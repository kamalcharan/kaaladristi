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
}

export type RotationCategory = 'rotating_in' | 'leading' | 'rotating_out';

export interface IndustryRotationItem extends IndustryEodRow {
  category: RotationCategory;
  rank_change: number;      // positive = improved
  prev_rank: number | null; // rank N days ago
}

// ── Scan Engine Types ──

export interface ScanStock {
  equity_id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  close: number;
  pct_chng: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  rvol: number | null;
  sniper_inst: number | null;
  accum_distrib: string | null;
  rss_value: number | null;
  volume_divergence_flag: string | null;
  has_recent_svd: boolean;
  has_recent_sbd: boolean;
  has_recent_syd: boolean;
}

export interface ScanDefinition {
  id: string;
  name: string;
  description: string;
  limit: number;
}

export interface EquitySymbolRow {
  id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  is_active: boolean;
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
  magic_rs: number | null;
  magic_rs_zone: string | null;
  flow_type: string | null;
  accum_distrib: string | null;
  sniper_inst: number | null;
  sniper_hot: number | null;
  rss_value: number | null;
  sma_150: number | null;
  volume_divergence_flag: string | null;
}
