/**
 * Regime Intelligence — maps each regime to posture, behavioral framing,
 * and emotional-reinforcement copy. This is the "risk desk tone" layer.
 */

export interface RegimeIntel {
  posture: string;
  postureColor: string;
  postureBg: string;
  behaviorExpectation: string;
  counterMove: string;
  deploymentIntensity: string;
  deploymentLevel: 'high' | 'moderate' | 'low' | 'minimal';
  breakoutSustainability: string;
  persistence: string;
  participationIntensity: string;
  briefing: string;
}

const REGIME_INTEL: Record<string, RegimeIntel> = {
  'Capital Protection': {
    posture: 'Defensive',
    postureColor: 'text-risk-red',
    postureBg: 'bg-risk-red/8',
    behaviorExpectation: 'Elevated stress conditions. Reduce directional exposure and prioritize capital preservation.',
    counterMove: 'Counter-trend rallies are sharp but typically fail. Avoid chasing recoveries.',
    deploymentIntensity: 'Fresh capital deployment strongly discouraged.',
    deploymentLevel: 'minimal',
    breakoutSustainability: 'Low — breakdowns more probable than breakouts.',
    persistence: 'Historically persists 3–7 sessions before regime transition.',
    participationIntensity: 'Minimal',
    briefing: 'Conditions favor protection over participation. Exposure reduction warranted.',
  },
  'Distribution': {
    posture: 'Cautious',
    postureColor: 'text-risk-amber',
    postureBg: 'bg-risk-amber/8',
    behaviorExpectation: 'Market in distribution phase. Trend reliability is weakening.',
    counterMove: 'Counter-trend moves are frequent. Directional conviction should be low.',
    deploymentIntensity: 'New positions carry elevated risk-reward asymmetry.',
    deploymentLevel: 'low',
    breakoutSustainability: 'Low — rallies likely to face selling pressure.',
    persistence: 'Historically persists 2–5 sessions. Transition risk elevated.',
    participationIntensity: 'Low',
    briefing: 'Distribution conditions present. Reduce position sizing and widen stop parameters.',
  },
  'Expansion': {
    posture: 'Opportunistic',
    postureColor: 'text-accent-cyan',
    postureBg: 'bg-accent-cyan/8',
    behaviorExpectation: 'Favorable conditions emerging. Selective deployment appropriate.',
    counterMove: 'Pullbacks tend to be shallow and short-lived in this regime.',
    deploymentIntensity: 'Measured capital deployment supported by cycle conditions.',
    deploymentLevel: 'moderate',
    breakoutSustainability: 'Moderate — breakouts have reasonable follow-through probability.',
    persistence: 'Historically persists 3–8 sessions. Conditions tend to be stable.',
    participationIntensity: 'Moderate',
    briefing: 'Expansion phase supports measured participation. Favor trend-aligned positions.',
  },
  'Accumulation': {
    posture: 'Constructive',
    postureColor: 'text-risk-green',
    postureBg: 'bg-risk-green/8',
    behaviorExpectation: 'Low-stress environment. Conditions favor patient accumulation.',
    counterMove: 'Dips tend to be absorbed. Mean-reversion strategies well-supported.',
    deploymentIntensity: 'Capital deployment conditions are favorable.',
    deploymentLevel: 'high',
    breakoutSustainability: 'High — trends have historically sustained in this regime.',
    persistence: 'Historically persists 4–10 sessions. Most stable regime.',
    participationIntensity: 'High',
    briefing: 'Accumulation phase active. Conditions support full participation intensity.',
  },
};

export function getRegimeIntel(regime: string): RegimeIntel {
  return REGIME_INTEL[regime] ?? REGIME_INTEL['Distribution'];
}
