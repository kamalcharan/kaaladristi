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
