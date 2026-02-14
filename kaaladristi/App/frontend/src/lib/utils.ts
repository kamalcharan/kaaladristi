import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskColor(score: number): string {
  if (score > 70) return 'text-risk-red';
  if (score > 40) return 'text-risk-amber';
  return 'text-risk-green';
}

export function getRiskHex(score: number): string {
  if (score > 70) return 'var(--risk-red)';
  if (score > 40) return 'var(--risk-amber)';
  return 'var(--risk-green)';
}

export function getRegimeFromScore(score: number): string {
  if (score >= 71) return 'Capital Protection';
  if (score >= 51) return 'Distribution';
  if (score >= 31) return 'Expansion';
  return 'Accumulation';
}

export function getRegimeColor(regime: string): string {
  switch (regime) {
    case 'Capital Protection': return 'bg-risk-red/10 border-risk-red/30 text-risk-red';
    case 'Distribution':       return 'bg-risk-amber/10 border-risk-amber/30 text-risk-amber';
    case 'Expansion':          return 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan';
    case 'Accumulation':       return 'bg-risk-green/10 border-risk-green/30 text-risk-green';
    default:                   return 'bg-accent-indigo/10 border-accent-indigo/30 text-accent-indigo';
  }
}
