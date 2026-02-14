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
