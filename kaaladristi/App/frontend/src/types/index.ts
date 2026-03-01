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

export interface KmIndexMaster {
  id: number;
  symbol: string;
  name: string;
  yahoo_ticker: string | null;
}

export interface KmIndexComposition {
  id: number;
  index_id: number;
  stock_symbol: string;
  sector: string | null;
  weight_pct: number | null;
  snapshot_date: string | null;
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
  vendor_codes: Record<string, string> | null;
  created_at: string;
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

export interface IndexWithComposition extends KmIndexMaster {
  composition: KmIndexComposition[];
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

// ── LuckyPop Indicator Types (matching km_luckypop_indicators table) ──

export interface LuckyPopIndicator {
  id: number;
  symbol_type: 'index' | 'equity';
  symbol_id: number;
  trade_date: string;

  // OHLCV
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  prev_close: number | null;
  volume: number | null;

  // SMA Lines
  sma_8: number | null;
  sma_21: number | null;
  sma_55: number | null;
  sma_89: number | null;
  sma_233: number | null;
  golden_line: number | null;

  // SMA Distances
  dist_sma_8: number | null;
  dist_sma_21: number | null;
  dist_sma_55: number | null;
  dist_golden: number | null;

  // SuperTrend
  supertrend_val: number | null;
  supertrend_dir: number | null;
  st_buy_signal: boolean;
  st_sell_signal: boolean;

  // Dot Signals
  svd_condition: boolean;
  sbd_condition: boolean;
  syd_condition: boolean;
  pre_syd_warning: boolean;

  // RSI / MFI / OBV
  rsi: number | null;
  mfi: number | null;
  mfi_rsi_cross: boolean;
  obv_trend: string | null;

  // Volume Metrics
  rel_volume: number | null;
  rvol: number | null;
  tvol: number | null;
  avg_range: number | null;

  // RSS
  rss_smooth: number | null;
  rss_spread: number | null;
  rss_direction: boolean | null;

  // IB30/IS30
  ib30_high: number | null;
  ib30_low: number | null;
  ib30_established: boolean;
  ib30_status: string | null;
  is30_bull_break: boolean;
  is30_bear_break: boolean;

  // Chartink Rules
  rule1_move_pct: number | null;
  rule1_satisfied: boolean;
  correction_pct: number | null;
  rule2_satisfied: boolean;
  volume_surge: boolean;
  ma_proximity: boolean;
  rule3_satisfied: boolean;
  chartink_score: number | null;
  chartink_status: string | null;

  // Order Flow
  delta: number | null;
  smoothed_delta: number | null;
  absorption: boolean;

  // Flow Classification
  flow_type: string | null;
  flow_meaning: string | null;

  // Vacuum / Accumulation / Distribution
  vacuum_status: string | null;
  accum_dist: string | null;

  // MagicRS
  magicrs_pts: number | null;
  magicrs_value: number | null;
  magicma_value: number | null;

  // SMA Crossover
  sma_cross_up: boolean;
  sma_cross_down: boolean;
  sma_cross_dist: number | null;

  // Confluence
  confluence: number | null;

  // Bias & Momentum
  bias_status: string | null;
  momentum_status: string | null;

  // Breakout Quality
  breakout_quality: number | null;
  breakout_label: string | null;

  // Recommendation
  recommendation: string | null;
  rec_reason: string | null;
  signal_score: number | null;
  display_mode: string | null;

  // Position Management
  position_rec: string | null;
  position_reason: string | null;

  // RSI Divergence
  div_type: string | null;
  div_bars_ago: number | null;
  div_freshness: string | null;

  // Pivot / Fibo / Gann
  pivot_pp: number | null;
  pivot_r1: number | null;
  pivot_r2: number | null;
  pivot_s1: number | null;
  pivot_s2: number | null;
  fibo_382: number | null;
  fibo_500: number | null;
  fibo_618: number | null;
  gann_250: number | null;
  gann_500: number | null;
  gann_750: number | null;

  // Swing High/Low
  is_swing_high: boolean;
  is_swing_low: boolean;

  // Sniper Dragon
  sniper_banker: number | null;
  sniper_hotmoney: number | null;
  sniper_rsi_line: number | null;

  // RSSI
  rssi_rss: number | null;
  rssi_rsi: number | null;
  rssi_new_high: boolean;
  rssi_bull_div: boolean;
  rssi_bear_div: boolean;
}
