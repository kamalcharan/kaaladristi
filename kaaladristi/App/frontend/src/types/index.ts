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

// ── Snapshot Types (Phase 0: pre-computed daily dashboard blob) ──

export interface SnapshotRisk {
  composite_score: number | null;
  regime: string | null;
  structural: number;
  momentum: number;
  volatility: number;
  deception: number;
  explanation: string;
}

export interface SnapshotPanchang {
  tithi_num: number | null;
  tithi_name: string | null;
  paksha: string | null;
  nakshatra_name: string | null;
  nakshatra_pada: number | null;
  yoga_name: string | null;
  karana_name: string | null;
  vara: string | null;
  dlnl_match: boolean;
  is_sankranti: boolean;
  is_purnima: boolean;
  is_amavasya: boolean;
  is_ekadashi: boolean;
  sunrise: string | null;
}

export interface SnapshotPlanet {
  planet: string;
  longitude: number | null;
  speed: number | null;
  retrograde: boolean;
  sign: string | null;
  nakshatra: string | null;
  nakshatra_pada: number | null;
  combust: boolean;
}

export interface SnapshotAspect {
  planet_1: string;
  planet_2: string;
  aspect_type: string;
  angle: number | null;
  orb: number | null;
  exact: boolean;
}

export interface SnapshotEvent {
  event_type: string;
  planet: string;
  from_value: string | null;
  to_value: string | null;
  severity: string | null;
}

export interface SnapshotFiredRule {
  code: string;
  name: string;
  category: string;
  signal: string;
  strength: number;
}

export interface SnapshotSignals {
  net_score: number;
  classification: string;
  fired_count: number;
  total_rules: number;
  rules: SnapshotFiredRule[];
}

export interface SnapshotSector {
  sector: string;
  factor_type: string;
  volatility_multiplier: number;
  direction: string;
}

export interface SnapshotOutlookDay {
  date: string;
  score: number | null;
  regime: string | null;
}

export interface SnapshotMarket {
  trade_date: string;
  close: number | null;
  prev_close: number | null;
  change: number | null;
  pct_change: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  w52_high: number | null;
  w52_low: number | null;
}

/** The complete pre-computed daily snapshot — ONE fetch powers the entire Dashboard. */
export interface DailySnapshot {
  date: string;
  symbol: string;
  version: number;
  generated_at: string;
  risk: SnapshotRisk | null;
  panchang: SnapshotPanchang | null;
  planets: SnapshotPlanet[];
  aspects: SnapshotAspect[];
  events: SnapshotEvent[];
  signals: SnapshotSignals;
  sectors: SnapshotSector[];
  outlook: SnapshotOutlookDay[];
  market: SnapshotMarket | null;
}

// ── Calendar Types (Edge Function /api/calendar) ──

export interface CalendarDay {
  date: string;
  score: number | null;
  regime: string | null;
  nakshatra: string | null;
  tithi: string | null;
  paksha: string | null;
  vara: string | null;
  dlnl: boolean;
  sankranti: boolean;
  event_count: number;
  has_retrograde: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  symbol: string;
  days: CalendarDay[];
}

// ── EOD Chart Response (Edge Function /api/eod-chart) ──

export interface EodChartResponse {
  symbol: string;
  from: string | null;
  to: string;
  totalRows: number;
  chartPoints: number;
  chartData: ChartDataPoint[];
  stats: IndexStats | null;
}

// ── Proofs Response (Edge Function /api/proofs) ──

export interface ProofEntry {
  date: string;
  score: number;
  regime: string;
  actualReturn: number;
  dailyRange: number;
  volatility: string;
  isCorrect: boolean;
}

export interface ProofsResponse {
  symbol: string;
  count: number;
  accuracy: number;
  proofs: ProofEntry[];
}
