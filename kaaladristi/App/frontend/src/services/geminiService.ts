import { GoogleGenAI } from "@google/genai";
import type { DayRiskReport, MarketSymbol, HistoricalProof } from "@/types";

const SYSTEM_INSTRUCTION = `You are Kala-Drishti AI.
Provide professional time-cycle risk intelligence for financial markets.
Output: Strict JSON.`;

// MOCK DATA for local UI development
const MOCK_REPORTS: Record<MarketSymbol, DayRiskReport> = {
  'NIFTY': {
    date: '2025-05-20',
    symbol: 'NIFTY',
    riskScore: 68,
    regime: 'Distribution',
    explanation: 'Major planetary alignment suggests structural resistance. Saturn in Aquarius square Mars creates aggressive selling pressure in heavyweight IT and Banking. Volatility likely to spike mid-session.',
    factors: { structural: 18, momentum: 22, volatility: 15, deception: 13 },
    planetarySummary: 'Saturn-Mars Square (92% intensity)',
    sectorImpacts: [
      { sector: 'IT Services', sensitivity: 85, weight: 14.2 },
      { sector: 'Banking', sensitivity: 72, weight: 32.5 },
      { sector: 'FMCG', sensitivity: 30, weight: 8.4 }
    ]
  },
  'BANKNIFTY': {
    date: '2025-05-20',
    symbol: 'BANKNIFTY',
    riskScore: 82,
    regime: 'Capital Protection',
    explanation: 'Lunar perigee coinciding with Mercury retrograde creates extreme informational noise. Financials are showing structural weakness against the current temporal cycle.',
    factors: { structural: 22, momentum: 15, volatility: 24, deception: 21 },
    planetarySummary: 'Mercury Retrograde / Lunar Perigee',
    sectorImpacts: [
      { sector: 'Private Banks', sensitivity: 88, weight: 65.0 },
      { sector: 'PSU Banks', sensitivity: 75, weight: 35.0 }
    ]
  },
  'FINNIFTY': {
    date: '2025-05-20',
    symbol: 'FINNIFTY',
    riskScore: 71,
    regime: 'Distribution',
    explanation: 'Financial services sector under pressure from Mercury-Rahu aspect. Insurance and NBFC names showing elevated deception risk.',
    factors: { structural: 16, momentum: 20, volatility: 18, deception: 17 },
    planetarySummary: 'Mercury-Rahu Conjunction (85% intensity)',
    sectorImpacts: [
      { sector: 'Insurance', sensitivity: 78, weight: 22.0 },
      { sector: 'NBFC', sensitivity: 82, weight: 28.0 },
      { sector: 'Housing Finance', sensitivity: 65, weight: 15.0 }
    ]
  },
  'MIDCPNIFTY': {
    date: '2025-05-20',
    symbol: 'MIDCPNIFTY',
    riskScore: 45,
    regime: 'Expansion',
    explanation: 'Midcap space showing resilience as Jupiter trine supports broader market participation. Selective opportunities emerging.',
    factors: { structural: 10, momentum: 12, volatility: 8, deception: 15 },
    planetarySummary: 'Jupiter Trine Uranus',
    sectorImpacts: []
  },
  'SENSEX': {
    date: '2025-05-20',
    symbol: 'SENSEX',
    riskScore: 62,
    regime: 'Distribution',
    explanation: 'Broad market under distribution pressure. Heavyweight names driving index lower. Saturn aspect creating structural ceiling.',
    factors: { structural: 15, momentum: 18, volatility: 14, deception: 15 },
    planetarySummary: 'Saturn Square Sun',
    sectorImpacts: [
      { sector: 'Reliance', sensitivity: 70, weight: 12.0 },
      { sector: 'TCS', sensitivity: 55, weight: 8.5 }
    ]
  }
};

const MOCK_PROOFS: HistoricalProof[] = [
  { date: 'May 12', score: 85, actualReturn: -1.2, volatility: 'High', isCorrect: true },
  { date: 'May 13', score: 40, actualReturn: 0.8, volatility: 'Low', isCorrect: true },
  { date: 'May 14', score: 20, actualReturn: 1.4, volatility: 'Med', isCorrect: true },
  { date: 'May 15', score: 75, actualReturn: -0.9, volatility: 'High', isCorrect: true },
  { date: 'May 16', score: 62, actualReturn: -0.1, volatility: 'Med', isCorrect: false }
];

export const getDailyRiskReport = async (symbol: MarketSymbol, date: string): Promise<DayRiskReport> => {
  const key = process.env.API_KEY;

  if (!key || key === "") {
    console.log(`[Demo Mode] Fetching Mock Report for ${symbol}`);
    await new Promise(r => setTimeout(r, 800));
    return MOCK_REPORTS[symbol] || MOCK_REPORTS['NIFTY'];
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Analyze risk for ${symbol} on ${date}.`,
    config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '{}');
};

export const getHistoricalProofs = async (symbol: MarketSymbol): Promise<HistoricalProof[]> => {
  const key = process.env.API_KEY;
  if (!key || key === "") {
    return MOCK_PROOFS;
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Recent proofs for ${symbol}.`,
    config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '[]');
};
