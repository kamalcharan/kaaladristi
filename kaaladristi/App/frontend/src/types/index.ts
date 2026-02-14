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

// ── Master Data Types (from Supabase km_ tables) ──

export interface Planet {
  id: number;
  name: string;
  vedic_name: string;
  symbol: string;
  type: string;
}

export interface Nakshatra {
  id: number;
  name: string;
  start_degree: number;
  end_degree: number;
  ruling_planet: string;
  deity: string;
  symbol: string;
}

export interface ZodiacSign {
  id: number;
  name: string;
  vedic_name: string;
  start_degree: number;
  end_degree: number;
  element: string;
  ruling_planet: string;
}

export interface Sector {
  id: number;
  name: string;
  nse_code: string;
}

export interface IndexMaster {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  index_type: string;
}

export interface IndexComposition {
  id: number;
  index_id: number;
  sector_id: number;
  weight_pct: number;
}
