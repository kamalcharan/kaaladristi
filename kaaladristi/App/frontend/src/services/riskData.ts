import { addDays, format, getDay } from 'date-fns';
import type { MarketSymbol, DayRiskReport, HistoricalProof, WeekDay, RiskFactors } from '@/types';
import { getRegimeFromScore } from '@/lib/utils';

/**
 * Risk data service.
 *
 * Currently returns computed mock data. When transaction tables
 * (daily_risk_scores, planetary_positions_daily) are created in Supabase,
 * swap the implementations below to use supabase.from(...) queries.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Deterministic seed from string (so same date+symbol = same score) ──
function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededScore(date: string, symbol: string, salt = ''): number {
  const seed = hashSeed(`${date}-${symbol}-${salt}`);
  // Scores cluster 15-75 with occasional spikes
  return Math.min(100, Math.max(5, (seed % 70) + 5 + (seed % 17 > 12 ? 20 : 0)));
}

function seededFactors(date: string, symbol: string): RiskFactors {
  const total = seededScore(date, symbol);
  const s = hashSeed(`${date}-${symbol}-f`);
  const raw = [s % 25, (s >> 4) % 25, (s >> 8) % 25, (s >> 12) % 25];
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  // Scale so factors sum close to total
  return {
    structural: Math.round((raw[0] / sum) * total),
    momentum:   Math.round((raw[1] / sum) * total),
    volatility: Math.round((raw[2] / sum) * total),
    deception:  Math.round((raw[3] / sum) * total),
  };
}

const PLANET_SUMMARIES = [
  'Saturn in Aquarius (structural pressure)',
  'Mars conjunct Ketu (momentum surge)',
  'Moon in Gandanta zone (volatility spike)',
  'Mercury Retrograde (information noise)',
  'Jupiter trine Venus (expansion signal)',
  'Rahu transit Pisces (deception window)',
  'Sun-Mars opposition (aggressive energy)',
  'Venus in Bharani nakshatra (reversal zone)',
];

const EXPLANATIONS: Record<string, string[]> = {
  'Capital Protection': [
    'Multiple planetary stress factors converging. Heavy structural resistance from Saturn aspects combined with momentum disruption suggests extreme caution.',
    'High-risk temporal window. Mars-Ketu conjunction amplifying volatility while Mercury retrograde creates informational noise across sectors.',
  ],
  'Distribution': [
    'Transition phase detected. Cycle analysis shows deteriorating momentum with sector-specific vulnerability in financials and IT.',
    'Mixed signals from planetary alignments. Structural factors showing weakness while deception indicators suggest hidden selling pressure.',
  ],
  'Expansion': [
    'Favorable planetary alignment supporting upward momentum. Jupiter influence providing structural support to heavyweight sectors.',
    'Positive cycle window. Venus-Jupiter harmony reducing volatility while Moon in favorable nakshatra supports accumulation.',
  ],
  'Accumulation': [
    'Low-risk environment. Benign planetary configuration with minimal stress factors. Favorable for systematic accumulation.',
    'Calm temporal window. No major planetary aspects creating disruption. Baseline conditions support steady market behavior.',
  ],
};

// ── Public API ──

export async function fetchDayRisk(date: string, symbol: MarketSymbol): Promise<DayRiskReport> {
  // Simulate async (will become real Supabase query)
  await new Promise(r => setTimeout(r, 300));

  const score = seededScore(date, symbol);
  const factors = seededFactors(date, symbol);
  const regime = getRegimeFromScore(score);
  const seed = hashSeed(`${date}-${symbol}`);
  const explanations = EXPLANATIONS[regime] || EXPLANATIONS['Accumulation'];

  return {
    date,
    symbol,
    riskScore: score,
    regime,
    explanation: explanations[seed % explanations.length],
    factors,
    planetarySummary: PLANET_SUMMARIES[seed % PLANET_SUMMARIES.length],
    sectorImpacts: [
      { sector: 'Banking',     sensitivity: 40 + (seed % 50),     weight: 32.5 },
      { sector: 'IT Services', sensitivity: 30 + (seed % 55),     weight: 14.2 },
      { sector: 'FMCG',        sensitivity: 10 + (seed % 35),     weight: 8.4 },
    ],
  };
}

export async function fetchWeekRisk(startDate: string, symbol: MarketSymbol): Promise<WeekDay[]> {
  await new Promise(r => setTimeout(r, 200));

  const start = new Date(startDate);
  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const score = seededScore(dateStr, symbol);
    days.push({
      date: dateStr,
      dayName: DAY_NAMES[getDay(d)],
      riskScore: score,
      regime: getRegimeFromScore(score),
    });
  }

  return days;
}

export async function fetchHistoricalProofs(symbol: MarketSymbol): Promise<HistoricalProof[]> {
  await new Promise(r => setTimeout(r, 200));

  const today = new Date();
  const proofs: HistoricalProof[] = [];

  for (let i = 5; i >= 1; i--) {
    const d = addDays(today, -i);
    const dateStr = format(d, 'MMM dd');
    const score = seededScore(format(d, 'yyyy-MM-dd'), symbol);
    const seed = hashSeed(`${format(d, 'yyyy-MM-dd')}-${symbol}-ret`);
    const ret = ((seed % 30) - 15) / 10; // -1.5 to +1.5

    proofs.push({
      date: dateStr,
      score,
      actualReturn: Number(ret.toFixed(1)),
      volatility: score > 60 ? 'High' : score > 35 ? 'Med' : 'Low',
      isCorrect: (score > 50 && ret < 0) || (score <= 50 && ret >= 0),
    });
  }

  return proofs;
}
